export type ProfileStat = {
  name: string;
  calls: number;
  total: number;
  max: number;
  average: number;
};

export type ProfileSnapshot = {
  enabled: boolean;
  frame: number;
  samples: number;
  fps: number;
  frameTime: number;
  stats: ProfileStat[];
  lastFrame: Record<string, number>;
};

type FrameRecord = {
  frame: number;
  time: number;
  marks: Map<string, number>;
};

type Accumulator = {
  calls: number;
  total: number;
  max: number;
};

const clock = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

export class Profiler {
  private enabled: boolean;
  private windowSize: number;
  private ring: FrameRecord[] = [];
  private accumulators = new Map<string, Accumulator>();
  private open = new Map<string, number>();
  private current: FrameRecord | null = null;
  private frameNumber = 0;
  private frameStart = 0;
  private lastFrame: Record<string, number> = {};

  constructor(enabled = true, windowSize = 120) {
    this.enabled = enabled;
    this.windowSize = Math.max(2, Math.floor(windowSize));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.open.clear();
      this.current = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  begin(name: string): void {
    if (!this.enabled) return;
    this.open.set(name, clock());
  }

  end(name: string): number {
    if (!this.enabled) return 0;
    const started = this.open.get(name);
    if (started === undefined) return 0;
    this.open.delete(name);
    return this.record(name, clock() - started);
  }

  record(name: string, milliseconds: number): number {
    if (!this.enabled) return 0;
    const duration = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
    let accumulator = this.accumulators.get(name);
    if (!accumulator) {
      accumulator = { calls: 0, total: 0, max: 0 };
      this.accumulators.set(name, accumulator);
    }
    accumulator.calls += 1;
    accumulator.total += duration;
    if (duration > accumulator.max) accumulator.max = duration;
    if (this.current) this.current.marks.set(name, (this.current.marks.get(name) ?? 0) + duration);
    return duration;
  }

  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) return fn();
    this.begin(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }

  startFrame(): void {
    if (!this.enabled) return;
    this.frameNumber += 1;
    this.frameStart = clock();
    this.current = { frame: this.frameNumber, time: 0, marks: new Map() };
  }

  endFrame(): void {
    if (!this.enabled) return;
    const current = this.current;
    this.current = null;
    if (!current) return;
    current.time = clock() - this.frameStart;
    this.lastFrame = Object.fromEntries(current.marks);
    this.ring.push(current);
    if (this.ring.length > this.windowSize) this.ring.shift();
  }

  getFrameNumber(): number {
    return this.frameNumber;
  }

  getLastFrame(): Record<string, number> {
    return { ...this.lastFrame };
  }

  getFrameTime(): number {
    if (this.ring.length === 0) return 0;
    const total = this.ring.reduce((sum, record) => sum + record.time, 0);
    return total / this.ring.length;
  }

  getFps(): number {
    const frameTime = this.getFrameTime();
    return frameTime > 0 ? 1000 / frameTime : 0;
  }

  getAverage(name: string): number {
    if (this.ring.length === 0) return 0;
    let total = 0;
    for (const record of this.ring) total += record.marks.get(name) ?? 0;
    return total / this.ring.length;
  }

  getStats(): ProfileStat[] {
    const stats: ProfileStat[] = [];
    for (const [name, accumulator] of this.accumulators) {
      stats.push({
        name,
        calls: accumulator.calls,
        total: accumulator.total,
        max: accumulator.max,
        average: accumulator.calls > 0 ? accumulator.total / accumulator.calls : 0
      });
    }
    return stats.sort((a, b) => b.total - a.total);
  }

  snapshot(): ProfileSnapshot {
    return {
      enabled: this.enabled,
      frame: this.frameNumber,
      samples: this.ring.length,
      fps: this.getFps(),
      frameTime: this.getFrameTime(),
      stats: this.getStats(),
      lastFrame: this.getLastFrame()
    };
  }

  reset(): void {
    this.ring = [];
    this.accumulators.clear();
    this.open.clear();
    this.current = null;
    this.lastFrame = {};
  }
}
