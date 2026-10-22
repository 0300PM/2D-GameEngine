import { resolveEasing, type Easing, type EasingFunction } from "./Easing";

export type TweenTarget = object;
export type TweenValues = Record<string, number>;
export type TweenState = "idle" | "running" | "paused" | "completed" | "cancelled";
export type TweenMode = "to" | "from";

export type TweenOptions = {
  duration?: number;
  delay?: number;
  easing?: Easing;
  repeat?: number;
  yoyo?: boolean;
  owner?: string;
  onStart?: (tween: Tween) => void;
  onUpdate?: (tween: Tween) => void;
  onRepeat?: (tween: Tween, iteration: number) => void;
  onComplete?: (tween: Tween) => void;
  onCancel?: (tween: Tween) => void;
};

const readPath = (target: TweenTarget, path: string): unknown => {
  let cursor: unknown = target as Record<string, unknown>;
  for (const segment of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const writePath = (target: TweenTarget, path: string, value: number): void => {
  const segments = path.split(".");
  let cursor: Record<string, unknown> = target as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const next = cursor[segments[index]];
    if (next === null || typeof next !== "object") {
      throw new Error(`Cannot tween "${path}": "${segments.slice(0, index + 1).join(".")}" is not an object`);
    }
    cursor = next as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
};

const numericValue = (target: TweenTarget, path: string, mode: TweenMode): number => {
  const value = readPath(target, path);
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`Cannot tween "${path}" ${mode === "to" ? "to" : "from"} a non-numeric value (${String(value)})`);
  }
  return value;
};

let nextTweenId = 1;

export class Tween {
  readonly id = nextTweenId++;
  readonly owner: string;
  readonly target: TweenTarget;
  readonly mode: TweenMode;
  readonly duration: number;
  private endValues: TweenValues = {};
  private startValues: TweenValues = {};
  private currentValues: TweenValues = {};
  private delayRemaining: number;
  private elapsed = 0;
  private iteration = 0;
  private readonly totalIterations: number;
  private readonly yoyo: boolean;
  private readonly easing: EasingFunction;
  private readonly callbacks: TweenOptions;
  private direction = 1;
  private state: TweenState = "idle";
  private started = false;

  constructor(target: TweenTarget, props: TweenValues, options: TweenOptions = {}, mode: TweenMode = "to") {
    this.target = target;
    this.mode = mode;
    this.owner = options.owner ?? "default";
    this.duration = Math.max(0, options.duration ?? 0.3);
    this.delayRemaining = Math.max(0, options.delay ?? 0);
    this.totalIterations = Math.max(1, Math.floor((options.repeat ?? 0) + 1));
    this.yoyo = options.yoyo ?? false;
    this.easing = resolveEasing(options.easing);
    this.callbacks = options;
    for (const path of Object.keys(props)) {
      const current = numericValue(target, path, mode);
      const propsValue = props[path];
      if (mode === "to") {
        this.startValues[path] = current;
        this.endValues[path] = propsValue;
      } else {
        this.startValues[path] = propsValue;
        this.endValues[path] = current;
      }
      this.currentValues[path] = this.startValues[path];
    }
  }

  static to(target: TweenTarget, props: TweenValues, options?: TweenOptions): Tween {
    return new Tween(target, props, options, "to");
  }

  static from(target: TweenTarget, props: TweenValues, options?: TweenOptions): Tween {
    return new Tween(target, props, options, "from");
  }

  get progress(): number {
    return this.duration <= 0 ? 1 : Math.min(1, this.elapsed / this.duration);
  }

  get totalProgress(): number {
    return Math.min(1, (this.iteration + this.progress) / this.totalIterations);
  }

  get values(): TweenValues {
    return { ...this.currentValues };
  }

  get isPlaying(): boolean {
    return this.state === "running";
  }

  get isPaused(): boolean {
    return this.state === "paused";
  }

  get isFinished(): boolean {
    return this.state === "completed" || this.state === "cancelled";
  }

  get isCancelled(): boolean {
    return this.state === "cancelled";
  }

  get stateName(): TweenState {
    return this.state;
  }

  play(): this {
    if (this.state === "completed" || this.state === "cancelled") return this;
    this.state = "running";
    return this;
  }

  pause(): this {
    if (this.state === "running") this.state = "paused";
    return this;
  }

  resume(): this {
    if (this.state === "paused") this.state = "running";
    return this;
  }

  restart(): this {
    this.state = "running";
    this.started = false;
    this.elapsed = 0;
    this.iteration = 0;
    this.direction = 1;
    return this;
  }

  cancel(): this {
    if (this.state === "cancelled" || this.state === "completed") return this;
    this.state = "cancelled";
    this.callbacks.onCancel?.(this);
    return this;
  }

  complete(): this {
    if (this.isFinished) return this;
    if (!this.started) this.begin();
    this.writeAt(this.direction === 1 ? 1 : 0);
    this.state = "completed";
    this.callbacks.onComplete?.(this);
    return this;
  }

  update(deltaTime: number): boolean {
    return this.consume(deltaTime).alive;
  }

  consume(deltaTime: number): { alive: boolean; consumed: number } {
    if (this.state === "completed" || this.state === "cancelled") return { alive: false, consumed: 0 };
    if (this.state === "paused") return { alive: true, consumed: 0 };
    if (this.state === "idle") this.play();
    if (!this.started) this.begin();
    let remaining = deltaTime;
    if (this.delayRemaining > 0) {
      const applied = Math.min(this.delayRemaining, remaining);
      this.delayRemaining -= applied;
      remaining -= applied;
      if (this.delayRemaining > 0) return { alive: true, consumed: applied };
    }
    while (remaining > 0 && this.state === "running") {
      if (this.duration <= 0) {
        this.advanceIteration();
        continue;
      }
      const left = this.duration - this.elapsed;
      const step = Math.min(left, remaining);
      this.elapsed += step;
      remaining -= step;
      const raw = Math.min(1, this.elapsed / this.duration);
      this.writeAt(this.direction === 1 ? raw : 1 - raw);
      this.callbacks.onUpdate?.(this);
      if (raw >= 1) this.advanceIteration();
    }
    return { alive: this.isLiveState, consumed: deltaTime - remaining };
  }

  private get isLiveState(): boolean {
    return this.state === "running" || this.state === "paused";
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.state = "running";
    this.callbacks.onStart?.(this);
    this.writeAt(this.direction === 1 ? 0 : 1);
  }

  private advanceIteration(): void {
    if (this.iteration + 1 < this.totalIterations) {
      this.iteration += 1;
      this.elapsed = 0;
      if (this.yoyo) this.direction = -this.direction;
      this.callbacks.onRepeat?.(this, this.iteration);
      return;
    }
    this.elapsed = this.duration;
    this.writeAt(this.direction === 1 ? 1 : 0);
    this.state = "completed";
    this.callbacks.onComplete?.(this);
  }

  private writeAt(rawProgress: number): void {
    const eased = this.easing(Math.min(1, Math.max(0, rawProgress)));
    for (const path of Object.keys(this.startValues)) {
      const start = this.startValues[path];
      const end = this.endValues[path];
      const value = start + (end - start) * eased;
      this.currentValues[path] = value;
      writePath(this.target, path, value);
    }
  }
}
