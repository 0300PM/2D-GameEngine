import { nativeCore } from "../../packages/engine/src/wasm/NativeCore";

type Memory = { buffer: ArrayBuffer };

const heap = (memory: Memory, pointer: number, count: number): Float64Array =>
  new Float64Array(memory.buffer, pointer, count);

const slots = {
  time: new Map<number, { state: number[]; scale: number; maxDelta: number; fixedDelta: number; accumulator: number; maxSteps: number }>(),
  random: new Map<number, { seed: number; state: number }>(),
  buffers: new Map<number, Float64Array>(),
  strings: new Map<number, string>()
};

const nextRandom = (state: { state: number }): number => {
  state.state = (state.state + 0x6d2b79f5) >>> 0;
  let value = state.state;
  value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0;
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const fnv = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const timeSlot = (slot: number) => {
  let entry = slots.time.get(slot);
  if (!entry) {
    entry = { state: new Array(12).fill(0), scale: 1, maxDelta: 0.1, fixedDelta: 0, accumulator: 0, maxSteps: 5 };
    entry.state[5] = 1;
    slots.time.set(slot, entry);
  }
  return entry;
};

const updateTime = (slot: number, rawDeltaMs: number): number => {
  const entry = timeSlot(slot);
  const raw = Number.isFinite(rawDeltaMs) && rawDeltaMs > 0 ? rawDeltaMs / 1000 : 0;
  entry.state[4] = raw;
  entry.state[8] += 1;
  if (entry.state[10] === 1) {
    entry.state[2] = 0;
    entry.state[3] = 0;
    return 0;
  }
  entry.state[3] = Math.min(raw, entry.maxDelta);
  entry.state[2] = entry.state[3] * entry.scale;
  entry.state[0] += entry.state[2];
  entry.state[1] += entry.state[3];
  if (entry.fixedDelta > 0) {
    const limit = entry.fixedDelta * entry.maxSteps;
    entry.accumulator = Math.min(entry.accumulator + entry.state[2], limit);
  }
  entry.state[11] = raw > entry.maxDelta ? 1 : 0;
  return entry.state[2];
};

export const installTestCore = (): void => {
  const memory = new WebAssembly.Memory({ initial: 256 });
  const exports: Record<string, unknown> = {
    memory,
    b2d_abi_version: () => 1,
    b2d_time_update: (slot: number, raw: number) => updateTime(slot, raw),
    b2d_time_get: (slot: number, field: number) => {
      const entry = timeSlot(slot);
      if (field === 7) return entry.fixedDelta > 0 ? entry.accumulator / entry.fixedDelta : 0;
      if (field === 9) return entry.fixedDelta > 0 ? Math.floor(entry.accumulator / entry.fixedDelta) : 0;
      return entry.state[field] ?? 0;
    },
    b2d_time_set_scale: (slot: number, value: number) => {
      const entry = timeSlot(slot);
      entry.scale = Number.isFinite(value) ? Math.max(0, value) : 1;
      entry.state[5] = entry.scale;
    },
    b2d_time_set_fixed_step: (slot: number, hz: number, maxSteps: number) => {
      const entry = timeSlot(slot);
      if (!(hz > 0) || !Number.isFinite(hz)) {
        entry.fixedDelta = 0;
        entry.accumulator = 0;
        entry.state[6] = 0;
        return;
      }
      entry.fixedDelta = 1 / hz;
      entry.maxSteps = Math.max(1, Math.floor(maxSteps));
      entry.state[6] = entry.fixedDelta;
    },
    b2d_time_set_max_delta: (slot: number, value: number) => {
      timeSlot(slot).maxDelta = Math.max(0.001, value);
    },
    b2d_time_pause: (slot: number) => {
      timeSlot(slot).state[10] = 1;
    },
    b2d_time_resume: (slot: number) => {
      const entry = timeSlot(slot);
      entry.state[10] = 0;
      entry.accumulator = 0;
    },
    b2d_time_reset: (slot: number) => {
      const entry = timeSlot(slot);
      entry.state = new Array(12).fill(0);
      entry.state[5] = entry.scale;
      entry.accumulator = 0;
    },
    b2d_time_consume_fixed: (slot: number, limit: number) => {
      const entry = timeSlot(slot);
      let steps = 0;
      while (steps < limit && entry.fixedDelta > 0 && entry.accumulator >= entry.fixedDelta) {
        entry.accumulator -= entry.fixedDelta;
        steps += 1;
      }
      return steps;
    },
    b2d_random_seed: (slot: number, seed: number) => {
      const normalised = (seed >>> 0) || 1;
      slots.random.set(slot, { seed: normalised, state: normalised });
    },
    b2d_random_state: (slot: number, state: number) => {
      const entry = slots.random.get(slot) ?? { seed: state >>> 0 || 1, state: 0 };
      entry.state = state >>> 0;
      slots.random.set(slot, entry);
    },
    b2d_random_get_state: (slot: number) => slots.random.get(slot)?.state ?? 0,
    b2d_random_reset: (slot: number) => {
      const entry = slots.random.get(slot);
      if (entry) entry.state = entry.seed;
    },
    b2d_random_fill: (slot: number, _requested: number, count: number) => {
      const entry = slots.random.get(slot);
      if (!entry) return 0;
      const pointer = 4096;
      const view = heap(memory, pointer, count);
      for (let index = 0; index < count; index += 1) view[index] = nextRandom(entry);
      slots.buffers.set(pointer, Array.from(view) as unknown as Float64Array);
      return pointer;
    },
    b2d_random_skip: (slot: number, count: number) => {
      const entry = slots.random.get(slot);
      if (!entry) return 0;
      for (let index = 0; index < count; index += 1) nextRandom(entry);
      return count;
    },
    b2d_random_fork: (slot: number, pointer: number, length: number, target: number) => {
      const source = slots.random.get(slot);
      const salt = slots.strings.get(pointer) ?? "";
      if (!source) return 0;
      const state = (source.state ^ fnv(salt.slice(0, length))) >>> 0;
      slots.random.set(target, { seed: state, state });
      return state;
    },
    b2d_buffer: (capacity: number) => {
      const pointer = 8192;
      slots.buffers.set(pointer, heap(memory, pointer, capacity));
      return pointer;
    },
    b2d_write_utf8: (pointer: number, length: number) => {
      slots.strings.set(pointer, "");
      return length;
    },
    b2d_scratch: (pointer: number, length: number) => {
      slots.strings.set(pointer, "");
      return length;
    }
  };
  nativeCore.attach({ exports } as unknown as WebAssembly.Instance);
  const push = (text: string): number => {
    const pointer = 1024;
    slots.strings.set(pointer, text);
    return pointer;
  };
  (nativeCore as unknown as { push: (text: string) => number }).push = push;
};

export const readBuffer = (pointer: number): Float64Array | undefined => slots.buffers.get(pointer);
