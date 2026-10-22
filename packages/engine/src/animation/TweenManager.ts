import type { Easing } from "./Easing";
import { Tween, type TweenMode, type TweenOptions, type TweenTarget, type TweenValues } from "./Tween";

export type TweenStep = {
  target: TweenTarget;
  props: TweenValues;
  duration?: number;
  delay?: number;
  easing?: Easing;
  mode?: TweenMode;
  onStart?: (tween: Tween) => void;
  onUpdate?: (tween: Tween) => void;
  onComplete?: (tween: Tween) => void;
};

export type SequenceOptions = {
  owner?: string;
  repeat?: number;
  onStart?: (sequence: TweenSequence) => void;
  onComplete?: (sequence: TweenSequence) => void;
  onCancel?: (sequence: TweenSequence) => void;
};

export type SequenceState = "idle" | "running" | "paused" | "completed" | "cancelled";

let nextSequenceId = 1;

export class TweenSequence {
  readonly id = nextSequenceId++;
  readonly owner: string;
  private readonly steps: TweenStep[];
  private readonly repeat: number;
  private readonly options: SequenceOptions;
  private index = 0;
  private iteration = 0;
  private current: Tween | null = null;
  private state: SequenceState = "idle";
  private started = false;

  constructor(steps: TweenStep[], options: SequenceOptions = {}) {
    if (steps.length === 0) throw new Error("A tween sequence needs at least one step");
    this.steps = steps.slice();
    this.options = options;
    this.owner = options.owner ?? "default";
    this.repeat = Math.max(0, Math.floor(options.repeat ?? 0));
  }

  get isPlaying(): boolean {
    return this.state === "running";
  }

  get isFinished(): boolean {
    return this.state === "completed" || this.state === "cancelled";
  }

  get stateName(): SequenceState {
    return this.state;
  }

  get stepIndex(): number {
    return this.index;
  }

  get iterationIndex(): number {
    return this.iteration;
  }

  play(): this {
    if (this.state === "completed" || this.state === "cancelled") return this;
    this.state = "running";
    return this;
  }

  pause(): this {
    if (this.state === "running") {
      this.state = "paused";
      this.current?.pause();
    }
    return this;
  }

  resume(): this {
    if (this.state === "paused") {
      this.state = "running";
      this.current?.resume();
    }
    return this;
  }

  cancel(): this {
    if (this.isFinished) return this;
    this.current?.cancel();
    this.state = "cancelled";
    this.options.onCancel?.(this);
    return this;
  }

  update(deltaTime: number): boolean {
    if (this.state === "completed" || this.state === "cancelled") return false;
    if (this.state === "paused") return true;
    if (this.state === "idle") this.play();
    let remaining = deltaTime;
    let guard = 0;
    while (guard < 128) {
      guard += 1;
      if (this.state !== "running") return false;
      if (!this.current) {
        if (!this.started) {
          this.started = true;
          this.options.onStart?.(this);
        }
        this.current = this.createStep(this.steps[this.index]);
        this.current.play();
      }
      const result = this.current.consume(remaining);
      if (result.alive) return true;
      this.current = null;
      remaining -= result.consumed;
      this.advance();
      if (this.state !== "running") return false;
      if (remaining <= 0) return true;
    }
    return true;
  }

  private advance(): void {
    if (this.index + 1 < this.steps.length) {
      this.index += 1;
      return;
    }
    if (this.iteration < this.repeat) {
      this.iteration += 1;
      this.index = 0;
      return;
    }
    this.state = "completed";
    this.options.onComplete?.(this);
  }

  private createStep(step: TweenStep): Tween {
    const options: TweenOptions = {
      duration: step.duration,
      delay: step.delay,
      easing: step.easing,
      owner: this.owner,
      onStart: step.onStart,
      onUpdate: step.onUpdate,
      onComplete: step.onComplete
    };
    return step.mode === "from" ? Tween.from(step.target, step.props, options) : Tween.to(step.target, step.props, options);
  }
}

export class TweenManager {
  private tweens: Tween[] = [];
  private sequences: TweenSequence[] = [];
  private paused = false;

  get size(): number {
    return this.tweens.length;
  }

  get sequenceCount(): number {
    return this.sequences.length;
  }

  get activeCount(): number {
    return this.tweens.length + this.sequences.length;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  to(target: TweenTarget, props: TweenValues, options: TweenOptions = {}): Tween {
    const tween = Tween.to(target, props, options);
    return this.add(tween);
  }

  from(target: TweenTarget, props: TweenValues, options: TweenOptions = {}): Tween {
    return this.add(Tween.from(target, props, options));
  }

  delay(seconds: number, onComplete?: (tween: Tween) => void, options: TweenOptions = {}): Tween {
    const target: TweenTarget = { value: 0 };
    const tween = Tween.to(target, { value: 1 }, { ...options, duration: Math.max(0, seconds), onComplete });
    return this.add(tween);
  }

  sequence(steps: TweenStep[], options: SequenceOptions = {}): TweenSequence {
    const sequence = new TweenSequence(steps, options);
    this.sequences.push(sequence);
    sequence.play();
    return sequence;
  }

  add(tween: Tween): Tween {
    this.tweens.push(tween);
    if (!this.paused) tween.play();
    return tween;
  }

  update(deltaTime: number): void {
    if (this.paused || deltaTime <= 0) return;
    if (this.tweens.length > 0) {
      const snapshot = this.tweens.slice();
      for (const tween of snapshot) {
        if (!tween.update(deltaTime)) this.removeTween(tween);
      }
    }
    if (this.sequences.length > 0) {
      const snapshot = this.sequences.slice();
      for (const sequence of snapshot) {
        if (!sequence.update(deltaTime)) this.removeSequence(sequence);
      }
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    for (const tween of this.tweens) tween.pause();
    for (const sequence of this.sequences) sequence.pause();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const tween of this.tweens) tween.resume();
    for (const sequence of this.sequences) sequence.resume();
  }

  cancel(tween: Tween): boolean {
    if (tween.isFinished) return false;
    tween.cancel();
    this.removeTween(tween);
    return true;
  }

  stopOwner(owner: string): number {
    let removed = 0;
    for (const tween of this.tweens.slice()) {
      if (tween.owner !== owner) continue;
      tween.cancel();
      this.removeTween(tween);
      removed += 1;
    }
    for (const sequence of this.sequences.slice()) {
      if (sequence.owner !== owner) continue;
      sequence.cancel();
      this.removeSequence(sequence);
      removed += 1;
    }
    return removed;
  }

  stopAll(): void {
    for (const tween of this.tweens.slice()) {
      tween.cancel();
    }
    for (const sequence of this.sequences.slice()) sequence.cancel();
    this.tweens = [];
    this.sequences = [];
  }

  private removeTween(tween: Tween): void {
    const index = this.tweens.indexOf(tween);
    if (index >= 0) this.tweens.splice(index, 1);
  }

  private removeSequence(sequence: TweenSequence): void {
    const index = this.sequences.indexOf(sequence);
    if (index >= 0) this.sequences.splice(index, 1);
  }
}
