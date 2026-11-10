import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildNativeArguments, WASM_TARGET } from "../../config/native";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BUILD = join(ROOT, "build-wasm");
const DIST = join(ROOT, "dist");
const MODULE = join(BUILD, "core.js");
const WASM = join(BUILD, "core.wasm");

const step = (label, command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) {
    console.error(`wasm: ${label} failed with exit code ${result.status ?? "null"}`);
    process.exit(result.status ?? 1);
  }
};

step("configure", "emcmake", [
  "cmake",
  ...buildNativeArguments({
    sourceDir: join(ROOT, "native/core"),
    buildDir: BUILD,
    target: WASM_TARGET,
    examples: false
  })
]);
step("build", "cmake", ["--build", BUILD, "--config", "Release", "--target", "core_wasm"]);

for (const artifact of [MODULE, WASM]) {
  if (!existsSync(artifact)) {
    console.error(
      `wasm: expected artifact ${artifact} is missing — configure with emcmake and an Emscripten SDK on PATH`
    );
    process.exit(1);
  }
}

mkdirSync(join(DIST, "assets"), { recursive: true });
copyFileSync(WASM, join(DIST, "assets/core.wasm"));

const module = await import(pathToFileURL(MODULE).href);
const factory = module.default ?? module.createB2DCore;
const instance = await factory({ locateFile: () => join(DIST, "assets/core.wasm") });
const abi = Number(instance.b2d_abi_version());
if (abi !== 1) {
  console.error(`wasm: unexpected ABI ${abi}`);
  process.exit(1);
}
const frames = Number(instance.b2d_bench_scene(1024, 60));
writeFileSync(
  join(DIST, "wasm.json"),
  `${JSON.stringify({ abi, objects: frames, bytes: readFileSync(WASM).length, builtAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8"
);
console.log(`wasm: core.wasm ABI ${abi}, bench scene objects ${frames}, copied to dist/assets/core.wasm`);
