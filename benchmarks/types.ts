export type BenchEnvironment = {
  node: string;
  platform: string;
  cpu: string;
  cores: number;
  recordedAt: string;
};

export type BenchmarkResult = {
  group: string;
  name: string;
  hz: number;
  meanMs: number;
  medianMs: number;
  iterations: number;
};

export type BenchmarkReport = {
  format: "b2d-benchmarks";
  version: 1;
  environment: BenchEnvironment;
  benchmarks: BenchmarkResult[];
};
