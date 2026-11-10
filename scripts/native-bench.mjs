#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const BUILD = join(ROOT, "build-native");
const CANDIDATES = [
  join(BUILD, process.platform === "win32" ? "Release/bench_core.exe" : "bench_core"),
  join(BUILD, "bench_core")
];
const BINARY = CANDIDATES.find((path) => existsSync(path)) ?? CANDIDATES[0];
const OUTPUT = join(ROOT, "benchmarks", "native-latest.json");
const BASELINE = join(ROOT, "benchmarks", "native-baseline.json");
const CHECK = process.argv.includes("--check");
const UPDATE = process.argv.includes("--update");
const TOLERANCE = Number(process.env.NATIVE_BENCH_TOLERANCE ?? 0.35);

if (!existsSync(BINARY)) {
  console.error(`Missing ${BINARY}. Run: npm run native:bench`);
  process.exit(2);
}

const lines = execFileSync(BINARY, [], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /^[a-z]/.test(line) && line.includes(" ms "));

const benchmarks = lines.map((line) => {
  const [name, ms, ops] = line.split(/\s{2,}/);
  return { name, meanMs: Number(ms), opsPerSecond: Number(String(ops).replace(/\s.*$/, "")) };
});

const report = {
  format: "b2d-native-benchmarks",
  version: 1,
  environment: {
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model.trim() ?? "unknown",
    recordedAt: new Date().toISOString()
  },
  benchmarks
};

mkdirSync(join(ROOT, "benchmarks"), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const entry of benchmarks)
  console.log(
    `${entry.name.padEnd(28)} ${entry.meanMs.toFixed(3).padStart(10)} ms ${String(entry.opsPerSecond).padStart(14)} ops/s`
  );
console.log(`zapisano ${OUTPUT}`);

if (UPDATE || (!existsSync(BASELINE) && CHECK)) {
  writeFileSync(BASELINE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`zapisano bazę ${BASELINE}`);
  process.exit(0);
}

if (!CHECK) process.exit(0);

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const index = new Map(baseline.benchmarks.map((entry) => [entry.name, entry]));
const regressions = [];
console.log(`Native benchmarks (tolerance ${(TOLERANCE * 100).toFixed(0)}%)`);
for (const entry of benchmarks) {
  const before = index.get(entry.name);
  if (!before) {
    console.log(`  ${entry.name.padEnd(28)} new`);
    continue;
  }
  const ratio = entry.opsPerSecond / before.opsPerSecond - 1;
  console.log(
    `  ${entry.name.padEnd(28)} ${String(Math.round(before.opsPerSecond)).padStart(12)} -> ${String(Math.round(entry.opsPerSecond)).padStart(12)} ops/s ${(ratio * 100).toFixed(1)}%`
  );
  if (ratio < -TOLERANCE) regressions.push(`${entry.name}: ${(ratio * 100).toFixed(1)}%`);
}
if (regressions.length > 0) {
  console.error(`Native benchmark regressions:\n  ${regressions.join("\n  ")}`);
  process.exit(1);
}
console.log("OK: native benchmarks within tolerance");
