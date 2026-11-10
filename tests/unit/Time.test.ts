import { beforeEach, describe, expect, it } from "vitest";
import { installTestCore } from "../helpers/native";
import { nativeCore } from "../../packages/engine/src/wasm/NativeCore";
import { Time } from "../../packages/engine/src/core/Time";

const time = (): Time => new Time(0.1);

beforeEach(() => {
  installTestCore();
});

describe("Time", () => {
  it("converts milliseconds into seconds", () => {
    const clock = time();
    clock.update(16);
    expect(clock.deltaTime).toBeCloseTo(0.016, 5);
    expect(clock.rawDeltaTime).toBeCloseTo(0.016, 5);
    expect(clock.realDeltaTime).toBeCloseTo(0.016, 5);
    expect(clock.frame).toBe(1);
    clock.dispose();
  });

  it("accumulates game time and real time separately", () => {
    const clock = time();
    clock.setTimeScale(0.5);
    clock.update(20);
    clock.update(20);
    expect(clock.elapsed).toBeCloseTo(0.02, 5);
    expect(clock.realElapsed).toBeCloseTo(0.04, 5);
    clock.dispose();
  });

  it("clamps long frames and reports them", () => {
    const clock = time();
    clock.update(1000);
    expect(clock.isClamped).toBe(true);
    expect(clock.deltaTime).toBeCloseTo(0.1, 5);
    expect(clock.rawDeltaTime).toBeCloseTo(1, 5);
    clock.dispose();
  });

  it("does not report clamping for normal frames", () => {
    const clock = time();
    clock.update(16);
    expect(clock.isClamped).toBe(false);
    clock.dispose();
  });

  it("freezes game time while paused but keeps counting frames", () => {
    const clock = time();
    clock.pause();
    clock.update(16);
    clock.update(16);
    expect(clock.deltaTime).toBe(0);
    expect(clock.elapsed).toBe(0);
    expect(clock.frame).toBe(2);
    clock.resume();
    clock.update(16);
    expect(clock.deltaTime).toBeCloseTo(0.016, 5);
    clock.dispose();
  });

  it("treats invalid deltas as zero", () => {
    const clock = time();
    clock.update(Number.NaN);
    expect(clock.deltaTime).toBe(0);
    clock.update(-5);
    expect(clock.deltaTime).toBe(0);
    clock.dispose();
  });

  it("clamps timeScale to non-negative values", () => {
    const clock = time();
    clock.timeScale = -2;
    expect(clock.timeScale).toBe(0);
    clock.setTimeScale(Number.NaN);
    expect(clock.timeScale).toBe(1);
    clock.dispose();
  });

  it("produces the same number of fixed steps for the same input", () => {
    const run = (): number[] => {
      const clock = time();
      clock.setFixedStep(60, 5);
      const counts: number[] = [];
      for (let index = 0; index < 10; index += 1) {
        clock.update(16.6667);
        let steps = 0;
        while (clock.consumeFixedStep()) steps += 1;
        counts.push(steps);
      }
      clock.dispose();
      return counts;
    };
    expect(run()).toEqual(run());
  });

  it("never exceeds maxSteps for one frame", () => {
    const clock = time();
    clock.setFixedStep(60, 3);
    clock.update(1000);
    expect(clock.pendingFixedSteps).toBeLessThanOrEqual(3);
    clock.dispose();
  });

  it("reports fixed alpha inside the unit range", () => {
    const clock = time();
    clock.setFixedStep(10, 5);
    clock.update(50);
    expect(clock.fixedAlpha).toBeGreaterThanOrEqual(0);
    expect(clock.fixedAlpha).toBeLessThan(1);
    clock.dispose();
  });

  it("disables the fixed step when hz is invalid", () => {
    const clock = time();
    clock.setFixedStep(0);
    clock.update(100);
    expect(clock.fixedDelta).toBe(0);
    expect(clock.pendingFixedSteps).toBe(0);
    expect(clock.consumeFixedStep()).toBe(false);
    clock.dispose();
  });

  it("resets all counters", () => {
    const clock = time();
    clock.update(50);
    clock.pause();
    clock.reset();
    const state = clock.toState();
    expect(state.elapsed).toBe(0);
    expect(state.realElapsed).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.frame).toBe(0);
    clock.dispose();
  });

  it("runs on the native core", () => {
    expect(nativeCore.impl).toBe("cpp");
    expect(nativeCore.abi).toBe(1);
  });
});
