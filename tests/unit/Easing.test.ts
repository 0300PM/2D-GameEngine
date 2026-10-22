import { describe, expect, it } from "vitest";
import { EASINGS, EASING_NAMES, resolveEasing, type EasingName } from "../../packages/engine/src/animation/Easing";

describe("Easing", () => {
  it("keeps linear as the identity function", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(EASINGS.linear(t)).toBeCloseTo(t, 10);
    }
  });

  it("maps every easing from 0 to 1", () => {
    for (const name of EASING_NAMES) {
      const easing = EASINGS[name];
      expect(easing(0), `${name} at 0`).toBeCloseTo(0, 6);
      expect(easing(1), `${name} at 1`).toBeCloseTo(1, 6);
    }
  });

  it("produces finite values across the whole range", () => {
    for (const name of EASING_NAMES) {
      for (let step = 0; step <= 100; step += 1) {
        const value = EASINGS[name](step / 100);
        expect(Number.isFinite(value), `${name} at ${step / 100}`).toBe(true);
      }
    }
  });

  it("overshoots for back and elastic easings", () => {
    expect(EASINGS.backOut(0.75)).toBeGreaterThan(1);
    expect(EASINGS.elasticOut(0.2)).toBeGreaterThan(1);
  });

  it("is symmetric for in-out variants", () => {
    for (const name of ["quadInOut", "cubicInOut", "sineInOut", "bounceInOut"] as EasingName[]) {
      const easing = EASINGS[name];
      expect(easing(0.5), name).toBeCloseTo(0.5, 6);
    }
  });

  it("falls back to linear when no easing is given", () => {
    expect(resolveEasing(undefined)(0.3)).toBeCloseTo(0.3, 10);
  });

  it("accepts a custom function", () => {
    const fn = resolveEasing(() => 0.42);
    expect(fn(0.9)).toBe(0.42);
  });

  it("throws on an unknown easing name", () => {
    expect(() => resolveEasing("quadraticWow" as EasingName)).toThrow(/Unknown easing/);
  });
});
