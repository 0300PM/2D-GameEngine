import { nativeCore } from "../wasm/NativeCore";

export type TimeState = {
  elapsed: number;
  realElapsed: number;
  deltaTime: number;
  realDeltaTime: number;
  frame: number;
  timeScale: number;
  paused: boolean;
  fixedDelta: number;
  fixedAlpha: number;
};

const MAX_SLOTS = 8;
const freeSlots: number[] = Array.from({ length: MAX_SLOTS }, (_, index) => MAX_SLOTS - 1 - index);

const acquireSlot = (): number => (freeSlots.length > 0 ? freeSlots.pop()! : -1);
const releaseSlot = (slot: number): void => {
  if (slot < 0 || freeSlots.includes(slot)) return;
  freeSlots.push(slot);
};

export class Time {
  private slot = acquireSlot();
  private useNative = false;
  private _elapsed = 0;
  private _realElapsed = 0;
  private _deltaTime = 0;
  private _realDeltaTime = 0;
  private _rawDeltaTime = 0;
  private _frame = 0;
  private _timeScale = 1;
  private _isPaused = false;
  private _maxDeltaTime: number;
  private _fixedDelta = 0;
  private _accumulator = 0;
  private _maxFixedSteps = 5;
  private _hz = 0;

  constructor(maxDeltaTime = 0.1) {
    this._maxDeltaTime = Math.max(0.001, maxDeltaTime);
  }

  get elapsed(): number {
    return this.read(0, this._elapsed);
  }

  get gameTime(): number {
    return this.elapsed;
  }

  get realElapsed(): number {
    return this.read(1, this._realElapsed);
  }

  get deltaTime(): number {
    return this.read(2, this._deltaTime);
  }

  get realDeltaTime(): number {
    return this.read(3, this._realDeltaTime);
  }

  get rawDeltaTime(): number {
    return this.read(4, this._rawDeltaTime);
  }

  get frame(): number {
    return this.read(8, this._frame);
  }

  get isPaused(): boolean {
    return this.read(10, this._isPaused ? 1 : 0) === 1;
  }

  get timeScale(): number {
    return this.read(5, this._timeScale);
  }

  set timeScale(value: number) {
    this.setTimeScale(value);
  }

  get maxDeltaTime(): number {
    return this._maxDeltaTime;
  }

  set maxDeltaTime(value: number) {
    this._maxDeltaTime = Math.max(0.001, value);
    if (this.bindNative()) nativeCore.number("b2d_time_set_max_delta", 0, this.slot, this._maxDeltaTime);
  }

  get fixedDelta(): number {
    return this.read(6, this._fixedDelta);
  }

  get fixedAlpha(): number {
    return this.read(7, this._fixedDelta > 0 ? this._accumulator / this._fixedDelta : 0);
  }

  get isClamped(): boolean {
    return this.read(11, this._rawDeltaTime > this._maxDeltaTime ? 1 : 0) === 1;
  }

  update(rawDeltaMs: number): void {
    if (this.bindNative()) {
      nativeCore.number("b2d_time_update", 0, this.slot, rawDeltaMs);
      return;
    }
    const raw = Number.isFinite(rawDeltaMs) && rawDeltaMs > 0 ? rawDeltaMs / 1000 : 0;
    this._rawDeltaTime = raw;
    this._frame += 1;
    if (this._isPaused) {
      this._deltaTime = 0;
      this._realDeltaTime = 0;
      return;
    }
    this._realDeltaTime = Math.min(raw, this._maxDeltaTime);
    this._deltaTime = this._realDeltaTime * this._timeScale;
    this._elapsed += this._deltaTime;
    this._realElapsed += this._realDeltaTime;
    if (this._fixedDelta > 0) {
      const limit = this._fixedDelta * this._maxFixedSteps;
      this._accumulator = Math.min(this._accumulator + this._deltaTime, limit);
    }
  }

  setTimeScale(value: number): this {
    this._timeScale = Number.isFinite(value) ? Math.max(0, value) : 1;
    if (this.bindNative()) nativeCore.number("b2d_time_set_scale", 0, this.slot, this._timeScale);
    return this;
  }

  setFixedStep(hz: number, maxSteps = 5): this {
    if (hz <= 0 || !Number.isFinite(hz)) {
      this._fixedDelta = 0;
      this._accumulator = 0;
      this._hz = 0;
      if (this.bindNative()) nativeCore.number("b2d_time_set_fixed_step", 0, this.slot, 0, 0);
      return this;
    }
    this._fixedDelta = 1 / hz;
    this._hz = hz;
    this._maxFixedSteps = Math.max(1, Math.floor(maxSteps));
    if (this.bindNative()) nativeCore.number("b2d_time_set_fixed_step", 0, this.slot, hz, this._maxFixedSteps);
    return this;
  }

  get pendingFixedSteps(): number {
    return this.read(9, this._pendingFallback());
  }

  consumeFixedStep(): boolean {
    if (this.bindNative()) return nativeCore.number("b2d_time_consume_fixed", 0, this.slot, 1) === 1;
    if (this._fixedDelta <= 0 || this._accumulator < this._fixedDelta) return false;
    this._accumulator -= this._fixedDelta;
    return true;
  }

  pause(): void {
    this._isPaused = true;
    this._deltaTime = 0;
    this._realDeltaTime = 0;
    if (this.bindNative()) nativeCore.number("b2d_time_pause", 0, this.slot);
  }

  resume(): void {
    this._isPaused = false;
    this._accumulator = 0;
    if (this.bindNative()) nativeCore.number("b2d_time_resume", 0, this.slot);
  }

  reset(): void {
    this._elapsed = 0;
    this._realElapsed = 0;
    this._deltaTime = 0;
    this._realDeltaTime = 0;
    this._rawDeltaTime = 0;
    this._frame = 0;
    this._isPaused = false;
    this._accumulator = 0;
    if (this.bindNative()) nativeCore.number("b2d_time_reset", 0, this.slot);
  }

  toState(): TimeState {
    return {
      elapsed: this.elapsed,
      realElapsed: this.realElapsed,
      deltaTime: this.deltaTime,
      realDeltaTime: this.realDeltaTime,
      frame: this.frame,
      timeScale: this.timeScale,
      paused: this.isPaused,
      fixedDelta: this.fixedDelta,
      fixedAlpha: this.fixedAlpha
    };
  }

  dispose(): void {
    releaseSlot(this.slot);
    this.slot = -1;
    this.useNative = false;
  }

  private bindNative(): boolean {
    if (this.slot < 0 || !nativeCore.isReady()) {
      this.useNative = false;
      return false;
    }
    if (!this.useNative) {
      this.useNative = true;
      nativeCore.number("b2d_time_reset", 0, this.slot);
      nativeCore.number("b2d_time_set_max_delta", 0, this.slot, this._maxDeltaTime);
      nativeCore.number("b2d_time_set_scale", 0, this.slot, this._timeScale);
      nativeCore.number("b2d_time_set_fixed_step", 0, this.slot, this._hz, this._maxFixedSteps);
    }
    return true;
  }

  private read(field: number, fallback: number): number {
    if (!this.useNative || !nativeCore.isReady()) return fallback;
    return nativeCore.number("b2d_time_get", fallback, this.slot, field);
  }

  private _pendingFallback(): number {
    if (this._fixedDelta <= 0) return 0;
    return Math.floor(this._accumulator / this._fixedDelta);
  }
}
