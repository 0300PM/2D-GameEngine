export type MemoryInfo = {
  used: number;
  total: number;
  limit: number;
  source: "performance.memory";
};

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
};

export const readMemory = (): MemoryInfo | null => {
  if (typeof performance === "undefined") return null;
  const memory = (performance as PerformanceWithMemory).memory;
  if (!memory) return null;
  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    source: "performance.memory"
  };
};

export const formatMegabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const formatMemory = (info: MemoryInfo | null): string =>
  info ? `${formatMegabytes(info.used)} / ${formatMegabytes(info.limit)}` : "n/a";
