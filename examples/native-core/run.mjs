import { resolve } from "node:path";
import {
  ensureNativeExamples,
  nativeExamplePaths,
  readFixture,
  runNativeExample
} from "../../tests/helpers/nativeExample.ts";

const ROOT = resolve(process.cwd());
const TARGETS = ["b2d_native_example", "b2d_native_example_async"];

ensureNativeExamples({ root: ROOT, targets: TARGETS });
const expected = readFixture(ROOT) ?? {};
const failures = [];

for (const target of TARGETS) {
  const report = runNativeExample(target, { root: ROOT });
  console.log(JSON.stringify(report));
  const key = target === "b2d_native_example" ? "sync" : "async";
  for (const field of ["frames", "fixedSteps", "objects", "components", "digest"]) {
    const wanted = expected[key]?.[field];
    if (wanted === undefined || wanted === report[field]) continue;
    failures.push(`${target}.${field}: expected ${wanted}, got ${report[field]}`);
  }
}

if (failures.length > 0) {
  console.error(`native-core example: deterministic report drifted\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`native-core example: ${TARGETS.length} hosts, binaries in ${nativeExamplePaths(ROOT).build}`);
