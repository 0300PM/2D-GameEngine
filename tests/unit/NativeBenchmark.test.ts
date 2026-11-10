import { describe, expect, it } from "vitest";
import { benchmarkNativeCore, formatBenchmark } from "../../packages/engine/src/debug/nativeBenchmark";

describe("native core benchmark", () => {
  it("measures the native time loop", () => {
    const report = benchmarkNativeCore({ frames: 240, objects: 256, seed: 7 });
    expect(report.frames).toBe(240);
    expect(report.ticksPerSecond).toBeGreaterThan(0);
    expect(report.msPerFrame).toBeGreaterThanOrEqual(0);
    expect(report.deterministicDigest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic for the same seed and size", () => {
    const first = benchmarkNativeCore({ frames: 64, objects: 32, seed: 11 });
    const second = benchmarkNativeCore({ frames: 64, objects: 32, seed: 11 });
    expect(first.deterministicDigest).toBe(second.deterministicDigest);
  });

  it("produces a different digest for a different seed", () => {
    const first = benchmarkNativeCore({ frames: 64, objects: 32, seed: 1 });
    const second = benchmarkNativeCore({ frames: 64, objects: 32, seed: 2 });
    expect(first.deterministicDigest).not.toBe(second.deterministicDigest);
  });

  it("formats a one-line summary", () => {
    const report = benchmarkNativeCore({ frames: 32, objects: 16, seed: 3 });
    expect(formatBenchmark(report)).toMatch(/core · \d+ frames · \d+ objects · \d+ ticks\/s · [0-9a-f]{8}/);
  });
});
