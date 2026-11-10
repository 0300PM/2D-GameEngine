#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const DIGEST_FIXTURE = join(ROOT, "examples/determinism/expected.json");
const NATIVE_FIXTURE = join(ROOT, "examples/native-core/expected.json");

const { runDeterministicDigest } = await import(pathToFileURL(join(ROOT, "examples/determinism/src/digest.ts")).href);
const { runFixedFrames } = await import(pathToFileURL(join(ROOT, "examples/determinism/src/frames.ts")).href);

const digest = runDeterministicDigest({ objects: 256, frames: 120, seed: 1337 });
const frames = runFixedFrames({ objects: 512, frames: 240, seed: 424242 });

const payload = {
  digest: { objects: 256, frames: 120, seed: 1337, value: digest.digest },
  frames: { objects: 512, frames: 240, seed: 424242, componentUpdates: frames.componentUpdates, value: frames.digest }
};

writeFileSync(DIGEST_FIXTURE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`determinism: digest ${digest.digest}, frames ${frames.digest}, components ${frames.componentUpdates}`);

const { buildNativeExamples, ensureNativeExamples, runNativeExample, hasTool } = await import(
  pathToFileURL(join(ROOT, "tests/helpers/nativeExample.ts")).href
);

if (!hasTool("cmake")) {
  console.error("native-core: cmake is required to record the native fixture — https://cmake.org/download/");
  process.exit(2);
}

buildNativeExamples({ root: ROOT });
const sync = runNativeExample("b2d_native_example", { root: ROOT });
const asyncReport = runNativeExample("b2d_native_example_async", { root: ROOT });
const pick = ({ frames: frameCount, fixedSteps, objects, components, digest: value, scene }) => ({
  scene,
  frames: frameCount,
  fixedSteps,
  objects,
  components,
  digest: value
});
writeFileSync(NATIVE_FIXTURE, `${JSON.stringify({ sync: pick(sync), async: pick(asyncReport) }, null, 2)}\n`, "utf8");
console.log(`native-core: sync ${sync.digest}, async ${asyncReport.digest}`);
console.log(`zapisano ${DIGEST_FIXTURE}`);
console.log(`zapisano ${NATIVE_FIXTURE}`);
console.log(`binaries in ${ensureNativeExamples({ root: ROOT })}`);
