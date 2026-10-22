export type ProjectLimits = {
  maxBytes: number;
  maxDepth: number;
  maxScenes: number;
  maxObjects: number;
  maxObjectsPerScene: number;
  maxAssets: number;
  maxStringLength: number;
  maxIdLength: number;
  maxTagsPerObject: number;
  maxPropertiesPerRecord: number;
  maxCoordinate: number;
  maxInputActions: number;
  maxKeysPerAction: number;
};

export const DEFAULT_PROJECT_LIMITS: Readonly<ProjectLimits> = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxDepth: 12,
  maxScenes: 200,
  maxObjects: 20_000,
  maxObjectsPerScene: 10_000,
  maxAssets: 2_000,
  maxStringLength: 4_096,
  maxIdLength: 96,
  maxTagsPerObject: 32,
  maxPropertiesPerRecord: 256,
  maxCoordinate: 1_000_000,
  maxInputActions: 128,
  maxKeysPerAction: 16
});

export const mergeLimits = (partial?: Partial<ProjectLimits>): ProjectLimits => {
  const limits: ProjectLimits = { ...DEFAULT_PROJECT_LIMITS };
  if (!partial) return limits;
  for (const key of Object.keys(DEFAULT_PROJECT_LIMITS) as (keyof ProjectLimits)[]) {
    const value = partial[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) limits[key] = Math.floor(value);
  }
  return limits;
};

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const findUnsafeKey = (value: unknown, path = "", depth = 0, maxDepth = 64): string | null => {
  if (depth > maxDepth) return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findUnsafeKey(value[index], `${path}[${index}]`, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (UNSAFE_KEYS.has(key)) return childPath;
    const found = findUnsafeKey((value as Record<string, unknown>)[key], childPath, depth + 1, maxDepth);
    if (found) return found;
  }
  return null;
};

export const measureDepth = (value: unknown, depth = 0): number => {
  if (depth > 256) return depth;
  if (Array.isArray(value)) {
    let max = depth;
    for (const entry of value) max = Math.max(max, measureDepth(entry, depth + 1));
    return max;
  }
  if (typeof value !== "object" || value === null) return depth;
  let max = depth;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, measureDepth(entry, depth + 1));
  }
  return max;
};

export const byteLength = (text: string): number =>
  typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length;

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
