export type NativeTarget =
  "core" | "test_core" | "test_scene" | "bench_core" | "b2d_native_example" | "b2d_native_example_async" | "core_wasm";

export type NativeExampleTarget = "b2d_native_example" | "b2d_native_example_async";

export type NativeBuildRequest = {
  sourceDir?: string;
  buildDir?: string;
  target: NativeTarget;
  tests?: boolean;
  bench?: boolean;
  examples?: boolean;
};

export const NATIVE_EXAMPLES: readonly NativeExampleTarget[] = ["b2d_native_example", "b2d_native_example_async"];

export const WASM_TARGET: NativeTarget = "core_wasm";

const flag = (value: boolean): string => (value ? "ON" : "OFF");

export const buildNativeArguments = (request: NativeBuildRequest): string[] => [
  "-S",
  request.sourceDir ?? "native/core",
  "-B",
  request.buildDir ?? "build-native",
  "-DCMAKE_BUILD_TYPE=Release",
  `-DB2D_CORE_BUILD_TESTS=${flag(request.tests ?? false)}`,
  `-DB2D_CORE_BUILD_BENCH=${flag(request.bench ?? false)}`,
  `-DB2D_CORE_BUILD_EXAMPLES=${flag(request.examples ?? true)}`,
  `-DB2D_CORE_TARGET=${request.target}`
];

export type NativeBuildPlan = {
  configure: string[];
  targets: NativeExampleTarget[];
  build: string[][];
};

export const nativeBuildPlan = (buildDir = "build-native"): NativeBuildPlan => ({
  configure: buildNativeArguments({
    buildDir,
    target: "b2d_native_example",
    tests: false,
    bench: false,
    examples: true
  }),
  targets: [...NATIVE_EXAMPLES],
  build: NATIVE_EXAMPLES.map((target) => ["--build", buildDir, "--config", "Release", "--target", target])
});

export const nativeBinaryPath = (
  buildDir: string,
  target: NativeTarget,
  platform: NodeJS.Platform = process.platform
): string => (platform === "win32" ? `${buildDir}/Release/${target}.exe` : `${buildDir}/${target}`);
