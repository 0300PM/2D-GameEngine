export class Random {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed = 0x9e3779b9) {
    this.initialSeed = seed >>> 0 || 1;
    this.state = this.initialSeed;
  }

  get seed(): number {
    return this.initialSeed;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0;
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
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
    return this.state;
  }

  loadState(state: number): this {
    this.state = state >>> 0;
    return this;
  }

  reset(): this {
    this.state = this.initialSeed;
    return this;
  }

  fork(salt: string | number): Random {
    const text = String(salt);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return new Random((this.state ^ hash) >>> 0);
  }
}
