import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildNativeArguments, nativeBinaryPath, NATIVE_EXAMPLES, type NativeExampleTarget } from "../../config/native";

export type NativeExampleReport = {
  format: "b2d-native-example";
  scene: string;
  frames: number;
  fixedSteps: number;
  objects: number;
  components: number;
  elapsed: number;
  digest: string;
  error?: string;
};

export type NativeExampleOptions = {
  root: string;
  buildDir?: string;
  targets?: NativeExampleTarget[];
  timeoutMs?: number;
};

export const CMAKE_REQUIRED_MESSAGE = "cmake is required: https://cmake.org/download/";

const REQUIRED_REPORT_FIELDS = ["frames", "fixedSteps", "objects", "components", "elapsed"] as const;

export const hasTool = (command: string, args: readonly string[] = ["--version"]): boolean => {
  try {
    execFileSync(command, [...args], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

export const nativeExamplePaths = (root: string, buildDir = "build-native") => {
  const build = join(root, buildDir);
  return {
    build,
    source: join(root, "native/core"),
    binary: (target: NativeExampleTarget) => nativeBinaryPath(build, target),
    stamp: join(build, "examples.stamp")
  };
};

export const buildNativeExamples = (options: NativeExampleOptions): string => {
  const paths = nativeExamplePaths(options.root, options.buildDir);
  const targets = options.targets ?? NATIVE_EXAMPLES;
  if (!hasTool("cmake")) throw new Error(CMAKE_REQUIRED_MESSAGE);
  execFileSync("cmake", buildNativeArguments({ sourceDir: paths.source, buildDir: paths.build, target: targets[0] }), {
    stdio: "inherit"
  });
  for (const target of targets) {
    execFileSync("cmake", ["--build", paths.build, "--config", "Release", "--target", target], { stdio: "inherit" });
  }
  mkdirSync(paths.build, { recursive: true });
  writeFileSync(paths.stamp, `${targets.join(",")}\n`, "utf8");
  return paths.build;
};

export const ensureNativeExamples = (options: NativeExampleOptions): string => {
  const paths = nativeExamplePaths(options.root, options.buildDir);
  const targets = options.targets ?? NATIVE_EXAMPLES;
  const built = targets.every((target) => existsSync(paths.binary(target)));
  if (built) return paths.build;
  return buildNativeExamples(options);
};

export const parseNativeReport = (output: string, target: string): NativeExampleReport => {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("{") && entry.includes("b2d-native-example"))
    .pop();
  if (!line) throw new Error(`${target}: no JSON report on stdout`);
  const report = JSON.parse(line) as NativeExampleReport;
  if (report.format !== "b2d-native-example") throw new Error(`${target}: unexpected report format "${report.format}"`);
  if (report.error) throw new Error(`${target}: ${report.error}`);
  for (const field of REQUIRED_REPORT_FIELDS) {
    const value = report[field];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(`${target}: report field "${field}" is not a finite number`);
  }
  if (!/^[0-9a-f]{8}$/.test(String(report.digest)))
    throw new Error(`${target}: digest "${report.digest}" is not FNV-1a hex32`);
  if (report.frames <= 0 || report.objects <= 0 || report.fixedSteps <= 0)
    throw new Error(`${target}: report describes an empty run`);
  return report;
};

export const runNativeExample = (target: NativeExampleTarget, options: NativeExampleOptions): NativeExampleReport => {
  const paths = nativeExamplePaths(options.root, options.buildDir);
  const binary = paths.binary(target);
  if (!existsSync(binary)) throw new Error(`${target}: binary missing at ${binary} (run buildNativeExamples first)`);
  const output = execFileSync(binary, [], {
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    windowsHide: true
  });
  return parseNativeReport(output, target);
};

export const readFixture = (root: string): Record<string, NativeExampleReport> | null => {
  const path = join(root, "examples/native-core/expected.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, NativeExampleReport>;
};
