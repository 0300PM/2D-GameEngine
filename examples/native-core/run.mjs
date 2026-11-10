import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const CORE = join(ROOT, "native/core");
const BUILD = join(ROOT, "build-native");
const BINARY = join(BUILD, process.platform === "win32" ? "b2d_native_example.exe" : "b2d_native_example");

const has = (command) => {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

if (!has("cmake")) {
  console.error("native-core example: cmake is required (https://cmake.org/download/)");
  process.exit(2);
}

if (!existsSync(BINARY)) {
  execFileSync(
    "cmake",
    ["-S", CORE, "-B", BUILD, "-DCMAKE_BUILD_TYPE=Release", "-DB2D_CORE_BUILD_TESTS=OFF", "-DB2D_CORE_BUILD_BENCH=OFF"],
    { stdio: "inherit" }
  );
  execFileSync("cmake", ["--build", BUILD, "--target", "b2d_native_example", "--config", "Release"], { stdio: "inherit" });
}

const output = execFileSync(BINARY, [], { encoding: "utf8" }).trim();
const report = JSON.parse(output);
console.log(output);
if (report.frames !== 600 || report.objects !== 2048) {
  console.error("native-core example: unexpected scene size");
  process.exit(1);
}
