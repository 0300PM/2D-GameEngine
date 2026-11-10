import { existsSync } from "node:fs";
import { nativeBinaryPath } from "../../../config/native";
import {
  hasTool,
  nativeExamplePaths,
  parseNativeReport,
  runNativeExample,
  type NativeExampleReport
} from "../../../tests/helpers/nativeExample";

const ROOT = process.cwd();
const paths = nativeExamplePaths(ROOT);
const buildNative = process.env.B2D_NATIVE_BUILD === "1" && hasTool("cmake");
const binary = (target: "b2d_native_example" | "b2d_native_example_async") => nativeBinaryPath(paths.build, target);

const SAMPLE =
  '{"format":"b2d-native-example","scene":"native-core","frames":600,"fixedSteps":600,"objects":2048,"components":2048,"elapsed":10.0,"digest":"1f0c4a9b"}';

describe("native example host contract", () => {
  it("parses the JSON report a host prints on stdout", () => {
    const report = parseNativeReport(`noise\n${SAMPLE}\n`, "b2d_native_example");
    expect(report).toMatchObject({ scene: "native-core", frames: 600, objects: 2048, digest: "1f0c4a9b" });
  });

  it("rejects a report that is missing, empty or not deterministic hex", () => {
    expect(() => parseNativeReport("", "host")).toThrow(/no JSON report/);
    expect(() => parseNativeReport('{"format":"b2d-native-example","frames":0,"objects":0}', "host")).toThrow(
      /finite number/
    );
    expect(() => parseNativeReport(SAMPLE.replace("1f0c4a9b", "zzzz"), "host")).toThrow(/FNV-1a/);
    expect(() => parseNativeReport(SAMPLE.replace('"frames":600', '"frames":0'), "host")).toThrow(/empty run/);
    expect(() => parseNativeReport('{"format":"b2d-native-example","error":"boom"}', "host")).toThrow(/boom/);
  });

  it("keeps every host in one build directory with a platform suffix", () => {
    expect(paths.build.endsWith("build-native")).toBe(true);
    expect(binary("b2d_native_example")).toContain(
      process.platform === "win32" ? "Release/b2d_native_example.exe" : "b2d_native_example"
    );
  });
});

const reports: Record<string, NativeExampleReport> = {};
const scenarios: Array<"b2d_native_example" | "b2d_native_example_async"> = [
  "b2d_native_example",
  "b2d_native_example_async"
];

describe.skipIf(!buildNative)("native example hosts (cmake build)", () => {
  for (const target of scenarios) {
    it(`${target} prints a deterministic report`, () => {
      expect(existsSync(binary(target)), `missing ${binary(target)}`).toBe(true);
      const report = runNativeExample(target, { root: ROOT });
      reports[target] = report;
      expect(report.frames).toBeGreaterThan(0);
      expect(report.fixedSteps).toBe(report.frames);
      expect(report.objects).toBeGreaterThan(0);
      expect(report.components).toBe(report.objects);
      expect(report.elapsed).toBeGreaterThan(0);
    });
  }

  it("is reproducible run to run", () => {
    const first = runNativeExample("b2d_native_example", { root: ROOT });
    const second = runNativeExample("b2d_native_example", { root: ROOT });
    expect(second.digest).toBe(first.digest);
    expect(second.frames).toBe(first.frames);
  });

  it("uses different scenes so the two hosts cannot share state", () => {
    expect(reports.b2d_native_example?.scene).toBe("native-core");
    expect(reports.b2d_native_example_async?.scene).toBe("native-core-async");
  });
});
