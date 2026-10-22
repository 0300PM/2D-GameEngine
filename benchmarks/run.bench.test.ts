import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runBenchmarks } from "./runner";
import { BENCHMARK_CASES } from "./cases";

const OUTPUT = resolve(__dirname, "latest.json");

describe("benchmarks", () => {
  it("measures every case and writes benchmarks/latest.json", () => {
    const report = runBenchmarks();
    expect(report.benchmarks).toHaveLength(BENCHMARK_CASES.length);
    for (const entry of report.benchmarks) {
      expect(entry.hz).toBeGreaterThan(0);
      expect(Number.isFinite(entry.meanMs)).toBe(true);
    }
    if (process.env.BENCH_NO_WRITE !== "1") {
      writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }
  }, 180_000);
});
