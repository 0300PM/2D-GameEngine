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

export class Time {
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

  constructor(maxDeltaTime = 0.1) {
    this._maxDeltaTime = Math.max(0.001, maxDeltaTime);
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get gameTime(): number {
    return this._elapsed;
  }

  get realElapsed(): number {
    return this._realElapsed;
  }

  get deltaTime(): number {
    return this._deltaTime;
  }

  get realDeltaTime(): number {
    return this._realDeltaTime;
  }

  get rawDeltaTime(): number {
    return this._rawDeltaTime;
  }

  get frame(): number {
    return this._frame;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get timeScale(): number {
    return this._timeScale;
  }

  set timeScale(value: number) {
    this.setTimeScale(value);
  }

  get maxDeltaTime(): number {
    return this._maxDeltaTime;
  }

  set maxDeltaTime(value: number) {
    this._maxDeltaTime = Math.max(0.001, value);
  }

  get fixedDelta(): number {
    return this._fixedDelta;
  }

  get fixedAlpha(): number {
    return this._fixedDelta > 0 ? this._accumulator / this._fixedDelta : 0;
  }

  get isClamped(): boolean {
    return this._rawDeltaTime > this._maxDeltaTime;
  }

  update(rawDeltaMs: number): void {
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
    return this;
  }

  setFixedStep(hz: number, maxSteps = 5): this {
    if (hz <= 0 || !Number.isFinite(hz)) {
      this._fixedDelta = 0;
      this._accumulator = 0;
      return this;
    }
    this._fixedDelta = 1 / hz;
    this._maxFixedSteps = Math.max(1, Math.floor(maxSteps));
    return this;
  }

  get pendingFixedSteps(): number {
    if (this._fixedDelta <= 0) return 0;
    return Math.floor(this._accumulator / this._fixedDelta);
  }

  consumeFixedStep(): boolean {
    if (this._fixedDelta <= 0 || this._accumulator < this._fixedDelta) return false;
    this._accumulator -= this._fixedDelta;
    return true;
  }

  pause(): void {
    this._isPaused = true;
    this._deltaTime = 0;
    this._realDeltaTime = 0;
  }

  resume(): void {
    this._isPaused = false;
    this._accumulator = 0;
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
  }

  toState(): TimeState {
    return {
      elapsed: this._elapsed,
      realElapsed: this._realElapsed,
      deltaTime: this._deltaTime,
      realDeltaTime: this._realDeltaTime,
      frame: this._frame,
      timeScale: this._timeScale,
      paused: this._isPaused,
      fixedDelta: this._fixedDelta,
      fixedAlpha: this.fixedAlpha
    };
  }
}
