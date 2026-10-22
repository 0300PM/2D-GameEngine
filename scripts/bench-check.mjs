#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, value = "true"] = argument.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const baselinePath = resolve(root, args.get("baseline") ?? "benchmarks/baseline.json");
const latestPath = resolve(root, args.get("latest") ?? "benchmarks/latest.json");
const tolerance = Number(args.get("tolerance") ?? process.env.BENCH_TOLERANCE ?? 0.4);

if (!existsSync(latestPath)) {
  console.error(`Missing ${latestPath}. Run: npm run bench`);
  process.exit(2);
}

if (args.has("update")) {
  copyFileSync(latestPath, baselinePath);
  console.log(`Baseline updated: ${baselinePath}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${baselinePath}. Record it first: npm run bench:baseline`);
  process.exit(2);
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const baseline = read(baselinePath);
const latest = read(latestPath);

if (baseline.format !== "b2d-benchmarks" || latest.format !== "b2d-benchmarks") {
  console.error("Unsupported benchmark report format");
  process.exit(2);
}

const key = (entry) => `${entry.group}/${entry.name}`;
const baselineIndex = new Map(baseline.benchmarks.map((entry) => [key(entry), entry]));
const latestIndex = new Map(latest.benchmarks.map((entry) => [key(entry), entry]));

const rows = [];
const regressions = [];
const missing = [];

for (const [name, base] of baselineIndex) {
  const current = latestIndex.get(name);
  if (!current) {
    missing.push(name);
    continue;
  }
  const ratio = current.hz / base.hz;
  const delta = (ratio - 1) * 100;
  const regressed = ratio < 1 - tolerance;
  rows.push({ name, base: base.hz, current: current.hz, delta, regressed });
  if (regressed) regressions.push({ name, base: base.hz, current: current.hz, delta });
}

const added = [...latestIndex.keys()].filter((name) => !baselineIndex.has(name));

const pad = (value, width) => String(value).padEnd(width);
console.log(`Benchmark comparison (tolerance ${(tolerance * 100).toFixed(0)}%)`);
console.log(`  baseline: ${baseline.environment.recordedAt} · ${baseline.environment.cpu} · node ${baseline.environment.node}`);
console.log(`  latest:   ${latest.environment.recordedAt} · ${latest.environment.cpu} · node ${latest.environment.node}`);
console.log("");
console.log(`  ${pad("benchmark", 54)}${pad("baseline hz", 14)}${pad("current hz", 14)}delta`);
for (const row of rows) {
  const marker = row.regressed ? "REGRESSION" : "";
  console.log(
    `  ${pad(row.name, 54)}${pad(row.base.toFixed(0), 14)}${pad(row.current.toFixed(0), 14)}${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)}% ${marker}`
  );
}

if (added.length > 0) console.log(`\n  new benchmarks: ${added.join(", ")}`);
if (missing.length > 0) console.log(`\n  missing from latest run: ${missing.join(", ")}`);
if (latest.environment.cpu !== baseline.environment.cpu) {
  console.log("\n  warning: CPU differs from the baseline machine; re-record with npm run bench:baseline");
}

if (regressions.length > 0) {
  console.error(`\n${regressions.length} benchmark(s) regressed beyond ${(tolerance * 100).toFixed(0)}%`);
  process.exit(1);
}

console.log("\nAll benchmarks within tolerance");
