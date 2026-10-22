import { describe, expect, it } from "vitest";
import { Time } from "../../packages/engine/src/core/Time";

describe("Time", () => {
  it("converts milliseconds into seconds", () => {
    const time = new Time();
    time.update(16);
    expect(time.deltaTime).toBeCloseTo(0.016, 5);
    expect(time.rawDeltaTime).toBeCloseTo(0.016, 5);
    expect(time.realDeltaTime).toBeCloseTo(0.016, 5);
    expect(time.frame).toBe(1);
  });

  it("accumulates game time and real time separately", () => {
    const time = new Time();
    time.setTimeScale(0.5);
    time.update(20);
    time.update(20);
    expect(time.elapsed).toBeCloseTo(0.02, 5);
    expect(time.realElapsed).toBeCloseTo(0.04, 5);
  });

  it("clamps long frames and reports them", () => {
    const time = new Time(0.1);
    time.update(1000);
    expect(time.isClamped).toBe(true);
    expect(time.deltaTime).toBeCloseTo(0.1, 5);
    expect(time.rawDeltaTime).toBeCloseTo(1, 5);
  });

  it("does not report clamping for normal frames", () => {
    const time = new Time(0.1);
    time.update(16);
    expect(time.isClamped).toBe(false);
  });

  it("freezes game time while paused but keeps counting frames", () => {
    const time = new Time();
    time.pause();
    time.update(16);
    time.update(16);
    expect(time.deltaTime).toBe(0);
    expect(time.elapsed).toBe(0);
    expect(time.frame).toBe(2);
    time.resume();
    time.update(16);
    expect(time.deltaTime).toBeCloseTo(0.016, 5);
  });

  it("treats invalid deltas as zero", () => {
    const time = new Time();
    time.update(Number.NaN);
    expect(time.deltaTime).toBe(0);
    time.update(-5);
    expect(time.deltaTime).toBe(0);
  });

  it("clamps timeScale to non-negative values", () => {
    const time = new Time();
    time.timeScale = -2;
    expect(time.timeScale).toBe(0);
    time.setTimeScale(Number.NaN);
    expect(time.timeScale).toBe(1);
  });

  it("produces the same number of fixed steps for the same input", () => {
    const run = (): number[] => {
      const time = new Time(0.1);
      time.setFixedStep(60, 5);
      const counts: number[] = [];
      for (let index = 0; index < 10; index += 1) {
        time.update(16.6667);
        let steps = 0;
        while (time.consumeFixedStep()) steps += 1;
        counts.push(steps);
      }
      return counts;
    };
    expect(run()).toEqual(run());
  });

  it("never exceeds maxSteps for one frame", () => {
    const time = new Time(0.1);
    time.setFixedStep(60, 3);
    time.update(1000);
    expect(time.pendingFixedSteps).toBeLessThanOrEqual(3);
  });

  it("reports fixed alpha inside the unit range", () => {
    const time = new Time();
    time.setFixedStep(10, 5);
    time.update(50);
    expect(time.fixedAlpha).toBeGreaterThanOrEqual(0);
    expect(time.fixedAlpha).toBeLessThan(1);
  });

  it("disables the fixed step when hz is invalid", () => {
    const time = new Time();
    time.setFixedStep(0);
    time.update(100);
    expect(time.fixedDelta).toBe(0);
    expect(time.pendingFixedSteps).toBe(0);
    expect(time.consumeFixedStep()).toBe(false);
  });

  it("resets all counters", () => {
    const time = new Time();
    time.update(50);
    time.pause();
    time.reset();
    const state = time.toState();
    expect(state.elapsed).toBe(0);
    expect(state.realElapsed).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.frame).toBe(0);
  });
});
