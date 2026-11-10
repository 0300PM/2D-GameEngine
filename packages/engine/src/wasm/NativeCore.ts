export type NativeCoreStats = {
  impl: "cpp" | "typescript";
  abi: number;
  reason: string | null;
};

const ABI_VERSION = 1;

const isMemory = (value: unknown): value is WebAssembly.Memory => value instanceof WebAssembly.Memory;

export class NativeCore {
  private exports: Record<string, unknown> | null = null;
  private memory: WebAssembly.Memory | null = null;
  private reason: string | null = null;

  get impl(): "cpp" | "typescript" {
    return this.exports ? "cpp" : "typescript";
  }

  get abi(): number {
    return this.exports ? Number((this.exports.b2d_abi_version as () => number)()) : 0;
  }

  isReady(): boolean {
    return this.exports !== null;
  }

  stats(): NativeCoreStats {
    return { impl: this.impl, abi: this.exports ? this.abi : 0, reason: this.reason };
  }

  attach(instance: WebAssembly.Instance): boolean {
    const exports = instance.exports as Record<string, unknown>;
    const abi = exports.b2d_abi_version;
    if (typeof abi !== "function") {
      this.reason = "missing-abi";
      return false;
    }
    const version = Number((abi as () => number)());
    if (version !== ABI_VERSION) {
      this.reason = `unsupported-abi:${version}`;
      return false;
    }
    const memory = exports.memory;
    if (!isMemory(memory)) {
      this.reason = "missing-memory";
      return false;
    }
    this.exports = exports;
    this.memory = memory;
    this.reason = null;
    return true;
  }

  detach(): void {
    this.exports = null;
    this.memory = null;
  }

  private fn<T>(name: string): T | null {
    const candidate = this.exports?.[name];
    return typeof candidate === "function" ? (candidate as T) : null;
  }

  number(name: string, fallback = 0, ...args: number[]): number {
    const fn = this.fn<(...values: number[]) => number>(name);
    if (!fn) return fallback;
    const result = fn(...args);
    return Number.isFinite(result) ? result : fallback;
  }

  write(values: readonly number[]): number {
    if (!this.memory) return 0;
    const buffer = this.fn<(bytes: number) => number>("b2d_buffer");
    if (!buffer) return 0;
    const pointer = buffer(values.length);
    if (!pointer) return 0;
    const heap = new Float64Array(this.memory.buffer, pointer, values.length);
    heap.set(values);
    return pointer;
  }

  read(pointer: number, count: number): number[] {
    if (!this.memory || !pointer || count <= 0) return [];
    const heap = new Float64Array(this.memory.buffer, pointer, count);
    return Array.from(heap);
  }

  text(name: string, pointer: number, length: number): string {
    const fn = this.fn<(data: number, size: number) => number>(name);
    return fn ? String(fn(pointer, length)) : "";
  }

  push(text: string): number {
    if (!this.memory) return 0;
    const write = this.fn<(pointer: number, length: number) => number>("b2d_write_utf8");
    if (!write) return 0;
    const bytes = text.length;
    const pointer = this.fn<(size: number) => number>("b2d_buffer")!(bytes + 1);
    if (!pointer) return 0;
    const view = new Uint8Array(this.memory.buffer, pointer, bytes);
    for (let index = 0; index < bytes; index += 1) view[index] = text.charCodeAt(index) & 0xff;
    write(pointer, bytes);
    return pointer;
  }
}

export const nativeCore = new NativeCore();
