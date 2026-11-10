#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const BINARY = join(ROOT, "build-native", process.platform === "win32" ? "Release/bench_core.exe" : "bench_core");
const OUTPUT = join(ROOT, "benchmarks", "native-latest.json");

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
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, cpu: cpus()[0]?.model.trim() ?? "unknown", recordedAt: new Date().toISOString() },
  benchmarks
};

mkdirSync(join(ROOT, "benchmarks"), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
for (const entry of benchmarks) console.log(`${entry.name.padEnd(28)} ${entry.meanMs.toFixed(3).padStart(10)} ms ${String(entry.opsPerSecond).padStart(14)} ops/s`);
console.log(`zapisano ${OUTPUT}`);
