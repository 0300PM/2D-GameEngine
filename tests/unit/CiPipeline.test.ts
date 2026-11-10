import { describe, expect, it } from "vitest";
import { runDeterministicDigest } from "../../examples/determinism/src/digest";
import { runFixedFrames } from "../../examples/determinism/src/frames";
import { buildNativeArguments, nativeBuildPlan, WASM_TARGET } from "../../config/native";
import { parseNativeReport } from "../helpers/nativeExample";

describe("CI/CD contract", () => {
  it("keeps the determinism example wired into the unit suite", () => {
    const digest = runDeterministicDigest({ objects: 16, frames: 4, seed: 5 });
    expect(digest.digest).toMatch(/^[0-9a-f]{8}$/);
    expect(runFixedFrames({ objects: 16, frames: 2, seed: 5 }).orderStable).toBe(true);
  });

  it("builds the native examples without the test and bench targets", () => {
    const plan = nativeBuildPlan();
    expect(plan.configure).toContain("-DB2D_CORE_BUILD_TESTS=OFF");
    expect(plan.configure).toContain("-DB2D_CORE_BUILD_BENCH=OFF");
    expect(plan.configure).toContain("-DB2D_CORE_BUILD_EXAMPLES=ON");
    expect(plan.targets).toEqual(["b2d_native_example", "b2d_native_example_async"]);
    const wasm = buildNativeArguments({
      buildDir: "build-wasm",
      target: WASM_TARGET,
      sourceDir: "native/core",
      examples: false
    });
    expect(wasm).toContain("-DB2D_CORE_BUILD_EXAMPLES=OFF");
    expect(wasm).toContain("-DB2D_CORE_BUILD_TESTS=OFF");
    expect(wasm).toContain("-DB2D_CORE_BUILD_BENCH=OFF");
  });

  it("parses a native host report without trusting it", () => {
    const report = parseNativeReport(
      '{"format":"b2d-native-example","scene":"native-core","frames":600,"fixedSteps":600,"objects":2048,"components":2048,"elapsed":10,"digest":"1f0c4a9b"}',
      "host"
    );
    expect(report.fixedSteps).toBe(report.frames);
    expect(() => parseNativeReport('{"format":"b2d-native-example","frames":1}', "host")).toThrow();
  });
});
