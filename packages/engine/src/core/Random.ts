import { nativeCore } from "../wasm/NativeCore";

export class Random {
  private slot = -1;
  private useNative = false;
  private buffer: number[] = [];
  private cursor = 0;
  private drained = 0;
  private nativeState = 0;
  private readonly initialSeed: number;

  constructor(seed = 0x9e3779b9) {
    this.initialSeed = seed >>> 0 || 1;
  }

  get seed(): number {
    return this.initialSeed;
  }

  next(): number {
    if (!this.bindNative()) throw new Error("Random: native core is required");
    const pointer = nativeCore.number("b2d_random_fill", 0, this.slot, 0, 1);
    return pointer > 0 ? nativeCore.read(pointer, 1)[0] : 0;
  }

  float(min = 0, max = 1): number {
    if (max < min) throw new Error(`Random.float: max (${max}) must be >= min (${min})`);
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    if (max < min) throw new Error(`Random.int: max (${max}) must be >= min (${min})`);
    return Math.floor(this.float(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Random.pick: empty collection");
    return items[Math.floor(this.next() * items.length)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(this.next() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  saveState(): number {
    this.bindNative();
    if (this.cursor < this.buffer.length && this.nativeState !== 0) return this.nativeState;
    return nativeCore.number("b2d_random_get_state", 0, this.slot) >>> 0;
  }

  loadState(state: number): this {
    this.bindNative();
    this.cursor = 0;
    this.buffer = [];
    nativeCore.number("b2d_random_skip", 0, this.slot, this.drained);
    nativeCore.number("b2d_random_state", 0, this.slot, state >>> 0);
    this.nativeState = 0;
    this.drained = 0;
    return this;
  }

  reset(): this {
    this.bindNative();
    this.cursor = 0;
    this.buffer = [];
    this.drained = 0;
    nativeCore.number("b2d_random_reset", 0, this.slot);
    this.nativeState = 0;
    return this;
  }

  fork(salt: string | number): Random {
    const text = String(salt);
    const child = new Random(0);
    child.bindNative();
    this.bindNative();
    const pointer = nativeCore.push(text);
    if (pointer === 0) {
      child.dispose();
      throw new Error("Random.fork: native scratch buffer rejected the salt");
    }
    if (child.slot < 0) throw new Error("Random.fork: no free native slot");
    nativeCore.number("b2d_random_fork", 0, this.slot, pointer, text.length, child.slot);
    child.buffer = [];
    child.cursor = 0;
    return child;
  }

  dispose(): void {
    if (this.slot >= 0 && !Random.freeSlots.includes(this.slot)) Random.freeSlots.push(this.slot);
    this.slot = -1;
    this.useNative = false;
    this.buffer = [];
  }

  private bindNative(): boolean {
    if (!nativeCore.isReady()) {
      this.useNative = false;
      return false;
    }
    if (!this.useNative) {
      this.slot = Random.acquire();
      this.useNative = true;
      nativeCore.number("b2d_random_seed", 0, this.slot, this.initialSeed);
      this.buffer = [];
      this.cursor = 0;
      this.drained = 0;
      this.nativeState = 0;
    }
    return true;
  }

  private refill(count: number): void {
    const pointer = nativeCore.number("b2d_random_fill", 0, this.slot, 0, count);
    this.buffer = pointer > 0 ? nativeCore.read(pointer, count) : [];
    this.cursor = 0;
    this.drained = count;
    this.nativeState = 0;
  }

  private static freeSlots = [7, 6, 5, 4, 3, 2, 1, 0];

  private static acquire(): number {
    return Random.freeSlots.pop() ?? -1;
  }
}
