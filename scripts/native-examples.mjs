#!/usr/bin/env node
import { resolve } from "node:path";
import { runNativeExample, readFixture } from "../tests/helpers/nativeExample.ts";

const ROOT = resolve(process.cwd());
const run = (target) => runNativeExample(target, { root: ROOT });
const expected = readFixture(ROOT);
const failures = [];

const check = (label, actual, wanted) => {
  if (wanted === undefined) return;
  if (actual === wanted) {
    console.log(`  ${label.padEnd(28)} ${actual}`);
    return;
  }
  failures.push(`${label}: expected ${wanted}, got ${actual}`);
  console.error(`  ${label.padEnd(28)} ${actual} (expected ${wanted})`);
};

const sync = run("b2d_native_example");
console.log("native-core example (sync)");
for (const field of ["frames", "fixedSteps", "objects", "components", "digest"])
  check(field, sync[field], expected?.sync?.[field]);

const asyncReport = run("b2d_native_example_async");
console.log("native-core example (async)");
for (const field of ["frames", "fixedSteps", "objects", "components", "digest"])
  check(field, asyncReport[field], expected?.async?.[field]);

if (failures.length > 0) {
  console.error(`native examples drifted from examples/native-core/expected.json:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("native examples: deterministic reports match the fixture");
