import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDeterministicDigest } from "../src/digest";
import { runFixedFrames } from "../src/frames";

type Fixture = {
  digest: { objects: number; frames: number; seed: number; value: string };
  frames: { objects: number; frames: number; seed: number; componentUpdates: number; value: string };
};

const fixture = JSON.parse(readFileSync(join(process.cwd(), "examples/determinism/expected.json"), "utf8")) as Fixture;

describe("determinism example: golden digests", () => {
  it("reproduces the recorded fixed-step digest", () => {
    const report = runDeterministicDigest({
      objects: fixture.digest.objects,
      frames: fixture.digest.frames,
      seed: fixture.digest.seed
    });
    expect(report.digest).toBe(fixture.digest.value);
  });

  it("reproduces the recorded scene frame digest", () => {
    const report = runFixedFrames({
      objects: fixture.frames.objects,
      frames: fixture.frames.frames,
      seed: fixture.frames.seed
    });
    expect(report.digest).toBe(fixture.frames.value);
    expect(report.componentUpdates).toBe(fixture.frames.componentUpdates);
    expect(report.orderStable).toBe(true);
  });
});
