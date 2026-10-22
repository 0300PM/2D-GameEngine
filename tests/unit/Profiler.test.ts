import { describe, expect, it } from "vitest";
import { Profiler } from "../../packages/engine/src/debug/Profiler";

describe("Profiler", () => {
  it("records named spans and aggregates calls", () => {
    const profiler = new Profiler(true, 8);
    profiler.startFrame();
    profiler.begin("engine.update");
    profiler.record("engine.update", 4);
    profiler.end("engine.update");
    profiler.record("engine.update", 2);
    profiler.endFrame();

    const stats = profiler.getStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe("engine.update");
    expect(stats[0].calls).toBe(3);
    expect(stats[0].total).toBeGreaterThanOrEqual(6);
    expect(stats[0].average).toBeGreaterThan(0);
  });

  it("reports the last frame breakdown sorted by cost", () => {
    const profiler = new Profiler(true, 8);
    profiler.startFrame();
    profiler.record("cheap", 1);
    profiler.record("expensive", 9);
    profiler.endFrame();

    const lastFrame = profiler.getLastFrame();
    expect(lastFrame.expensive).toBe(9);
    expect(lastFrame.cheap).toBe(1);
    expect(Object.keys(lastFrame)).toEqual(["cheap", "expensive"]);
  });

  it("averages frame time over the window and derives fps", () => {
    const profiler = new Profiler(true, 3);
    for (let index = 0; index < 5; index += 1) {
      profiler.startFrame();
      profiler.record("work", 1);
      profiler.endFrame();
    }
    const snapshot = profiler.snapshot();
    expect(snapshot.frame).toBe(5);
    expect(snapshot.samples).toBe(3);
    expect(snapshot.frameTime).toBeGreaterThanOrEqual(0);
    expect(snapshot.fps).toBeGreaterThan(0);
  });

  it("keeps per-frame averages per name", () => {
    const profiler = new Profiler(true, 4);
    for (const value of [2, 4, 6, 8]) {
      profiler.startFrame();
      profiler.record("phase", value);
      profiler.endFrame();
    }
    expect(profiler.getAverage("phase")).toBeCloseTo(5, 5);
  });

  it("is a no-op when disabled", () => {
    const profiler = new Profiler(false);
    profiler.startFrame();
    profiler.begin("engine.update");
    profiler.endFrame();
    expect(profiler.getStats()).toEqual([]);
    expect(profiler.getLastFrame()).toEqual({});
    expect(profiler.end("engine.update")).toBe(0);
    expect(profiler.measure("work", () => 7)).toBe(7);
  });

  it("measure returns the callback result and records a span even on throw", () => {
    const profiler = new Profiler(true, 4);
    profiler.startFrame();
    expect(profiler.measure("work", () => 7)).toBe(7);
    expect(() =>
      profiler.measure("throwing", () => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    profiler.endFrame();
    const names = profiler.getStats().map((entry) => entry.name);
    expect(names).toContain("work");
    expect(names).toContain("throwing");
  });

  it("ignores unknown marks and negative durations", () => {
    const profiler = new Profiler(true, 4);
    expect(profiler.end("missing")).toBe(0);
    profiler.startFrame();
    profiler.record("odd", Number.NaN);
    profiler.endFrame();
    expect(profiler.getStats()[0].total).toBe(0);
  });

  it("reset clears accumulators and window", () => {
    const profiler = new Profiler(true, 4);
    profiler.startFrame();
    profiler.record("work", 3);
    profiler.endFrame();
    profiler.reset();
    expect(profiler.getStats()).toEqual([]);
    expect(profiler.snapshot().samples).toBe(0);
    expect(profiler.getFps()).toBe(0);
  });

  it("toggling enabled stops collecting", () => {
    const profiler = new Profiler(true, 4);
    profiler.startFrame();
    profiler.record("work", 1);
    profiler.endFrame();
    profiler.setEnabled(false);
    profiler.startFrame();
    profiler.record("work", 5);
    profiler.endFrame();
    expect(profiler.isEnabled()).toBe(false);
    expect(profiler.getStats()[0].total).toBe(1);
  });
});
