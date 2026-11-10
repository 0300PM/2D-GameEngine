import { describe, expect, it } from "vitest";
import { runDeterministicDigest } from "../src/digest";
import { runFixedFrames } from "../src/frames";

describe("determinism example: fixed-step digest", () => {
  it("produces the same digest for the same seed", () => {
    const first = runDeterministicDigest({ objects: 128, frames: 60, seed: 1337 });
    const second = runDeterministicDigest({ objects: 128, frames: 60, seed: 1337 });
    expect(second).toEqual(first);
    expect(first.impl).toBe("typescript");
    expect(first.objects).toBe(128);
    expect(first.frames).toBe(60);
    expect(first.digest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("changes the digest when the seed changes", () => {
    const base = runDeterministicDigest({ objects: 64, frames: 30, seed: 1 });
    const other = runDeterministicDigest({ objects: 64, frames: 30, seed: 2 });
    expect(other.digest).not.toBe(base.digest);
  });

  it("scales with the requested object count", () => {
    expect(runDeterministicDigest({ objects: 512, frames: 5 }).objects).toBe(512);
    expect(runDeterministicDigest({ objects: 1, frames: 5 }).objects).toBe(1);
  });
});

describe("determinism example: scene frames", () => {
  it("keeps component order stable across frames", () => {
    const report = runFixedFrames({ objects: 128, frames: 30, seed: 7 });
    expect(report.orderStable).toBe(true);
    expect(report.componentUpdates).toBe(128 * 30);
    expect(report.objects).toBe(128);
    expect(report.digest).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is reproducible for the same seed and differs across seeds", () => {
    const first = runFixedFrames({ objects: 64, frames: 20, seed: 11 });
    const second = runFixedFrames({ objects: 64, frames: 20, seed: 11 });
    const other = runFixedFrames({ objects: 64, frames: 20, seed: 12 });
    expect(second.digest).toBe(first.digest);
    expect(other.digest).not.toBe(first.digest);
  });

  it("moves objects on every frame the component runs", () => {
    const short = runFixedFrames({ objects: 32, frames: 1, seed: 3 });
    const long = runFixedFrames({ objects: 32, frames: 10, seed: 3 });
    expect(short.digest).not.toBe(long.digest);
    expect(long.componentUpdates).toBeGreaterThan(short.componentUpdates);
  });
});
