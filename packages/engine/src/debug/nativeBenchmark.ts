import { nativeCore } from "../wasm/NativeCore";
import { Random } from "../core/Random";
import { Time } from "../core/Time";

export type BenchmarkOptions = {
  frames: number;
  objects: number;
  seed: number;
};

export type BenchmarkReport = {
  impl: "cpp" | "typescript";
  frames: number;
  objects: number;
  ticksPerSecond: number;
  msPerFrame: number;
  deterministicDigest: string;
};

export const DEFAULT_BENCHMARK: BenchmarkOptions = { frames: 600, objects: 512, seed: 1337 };

export const benchmarkNativeCore = (options: Partial<BenchmarkOptions> = {}): BenchmarkReport => {
  const config = { ...DEFAULT_BENCHMARK, ...options };
  const time = new Time(0.1);
  time.setFixedStep(60, 5);
  const random = new Random(config.seed);
  const started = performance.now();
  let digest = 0x811c9dc5;
  for (let frame = 0; frame < config.frames; frame += 1) {
    time.update(16.6667);
    while (time.consumeFixedStep()) {
      for (let index = 0; index < config.objects; index += 1) {
        digest = Math.imul(digest ^ Math.floor(random.next() * 0xffff), 0x01000193) >>> 0;
      }
    }
  }
  const elapsed = performance.now() - started;
  const report: BenchmarkReport = {
    impl: nativeCore.impl,
    frames: config.frames,
    objects: config.objects,
    ticksPerSecond: elapsed > 0 ? Math.round((config.frames / elapsed) * 1000) : 0,
    msPerFrame: config.frames > 0 ? elapsed / config.frames : 0,
    deterministicDigest: (digest >>> 0).toString(16).padStart(8, "0")
  };
  time.dispose();
  random.dispose();
  return report;
};

export const formatBenchmark = (report: BenchmarkReport): string =>
  `${report.impl} core · ${report.frames} frames · ${report.objects} objects · ${report.ticksPerSecond} ticks/s · ${report.deterministicDigest}`;
