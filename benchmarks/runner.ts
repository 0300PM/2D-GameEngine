import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { BENCHMARK_CASES } from "./cases";
import type { BenchmarkResult, BenchmarkReport, BenchEnvironment } from "./types";

export type MeasureOptions = {
  warmupMs?: number;
  sampleMs?: number;
  samples?: number;
};

const environment = (): BenchEnvironment => ({
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  cpu: cpus()[0]?.model.trim() ?? "unknown",
  cores: cpus().length,
  recordedAt: new Date().toISOString()
});

export const measure = (
  name: string,
  group: string,
  run: () => void,
  options: MeasureOptions = {}
): BenchmarkResult => {
  const warmupMs = options.warmupMs ?? 120;
  const sampleMs = options.sampleMs ?? 200;
  const samples = options.samples ?? 5;

  const warmupDeadline = performance.now() + warmupMs;
  while (performance.now() < warmupDeadline) run();

  const times: number[] = [];
  let iterations = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const started = performance.now();
    let count = 0;
    let now = started;
    while (now - started < sampleMs) {
      run();
      count += 1;
      now = performance.now();
    }
    iterations += count;
    times.push((now - started) / count);
  }

  times.sort((a, b) => a - b);
  const meanMs = times.reduce((sum, value) => sum + value, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  return {
    group,
    name,
    hz: median > 0 ? 1000 / median : 0,
    meanMs,
    medianMs: median,
    iterations
  };
};

export const runBenchmarks = (options: MeasureOptions = {}): BenchmarkReport => ({
  format: "b2d-benchmarks",
  version: 1,
  environment: environment(),
  benchmarks: BENCHMARK_CASES.map((entry) => measure(entry.name, entry.group, entry.run, options))
});
