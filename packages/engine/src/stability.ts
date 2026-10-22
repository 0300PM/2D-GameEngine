import { API_LEVEL, API_STABILITY, ENGINE_VERSION } from "./version";

export const STABILITY_CHANNELS = ["stable", "experimental", "internal"] as const;

export type StabilityChannel = (typeof STABILITY_CHANNELS)[number];

export type FeatureStatus = {
  id: string;
  channel: StabilityChannel;
  since: string;
  note: string;
  deprecatedIn?: string;
  removeIn?: string;
};

const status = (
  id: string,
  channel: StabilityChannel,
  since: string,
  note: string,
  extra: Pick<FeatureStatus, "deprecatedIn" | "removeIn"> = {}
): FeatureStatus => ({ id, channel, since, note, ...extra });

export const FEATURE_STATUS: Readonly<Record<string, FeatureStatus>> = Object.freeze({
  "engine-core": status("engine-core", "stable", "0.1.0", "Engine, lifecycle, time, scheduler, random"),
  scenes: status("scenes", "stable", "0.1.0", "SceneManager, Scene base class, transitions"),
  objects: status("objects", "stable", "0.1.0", "GameObject, hierarchy, transforms, queries, groups"),
  components: status("components", "stable", "0.1.0", "Component lifecycle and system order"),
  input: status("input", "stable", "0.1.0", "Action mapping, keyboard, pointer"),
  physics: status("physics", "stable", "0.1.0", "Arcade colliders, overlaps, sensors"),
  camera: status("camera", "stable", "0.1.0", "Follow, bounds, zoom, effects"),
  assets: status("assets", "stable", "0.1.0", "Manifest, pipeline, holds, diagnostics"),
  audio: status("audio", "stable", "0.1.0", "Channels, volumes, autoplay queue"),
  animation: status("animation", "stable", "0.1.0", "Tweens, easings, frame animations"),
  "project-format": status("project-format", "stable", "0.1.0", "JSON format v2 with v1 migration"),
  saves: status("saves", "stable", "0.1.0", "Player saves, repository, checksums"),
  "save-stores": status("save-stores", "stable", "0.1.0", "Memory, localStorage, IndexedDB, file system, HTTP"),
  "sql-saves": status("sql-saves", "stable", "0.1.0", "PostgreSQL and MySQL dialects with parity tests"),
  plugins: status("plugins", "stable", "0.1.0", "Manifest, registries, lifecycle, error isolation"),
  debug: status("debug", "stable", "0.1.0", "Overlay, log panel, debug views, profiler"),
  diagnostics: status("diagnostics", "stable", "0.1.0", "Report sections, findings, JSON export"),
  "tiled-import": status("tiled-import", "experimental", "0.1.0", "Tiled layers and objects; API may change in a minor"),
  wasm: status("wasm", "experimental", "0.1.0", "Optional C++23 bridge, never on the critical path"),
  ecs: status("ecs", "experimental", "0.1.0", "Prototype evaluated in benchmarks, not wired into the public API"),
  "adapter-contract": status("adapter-contract", "internal", "0.1.0", "Ports and adapters, outside semver guarantees")
});

const UNKNOWN: FeatureStatus = status("unknown", "internal", "0.1.0", "Feature not registered");

export const getFeatureStatus = (id: string): FeatureStatus => FEATURE_STATUS[id] ?? { ...UNKNOWN, id };

export const listFeatures = (channel?: StabilityChannel): FeatureStatus[] => {
  const all = Object.values(FEATURE_STATUS).sort((left, right) => left.id.localeCompare(right.id));
  return channel ? all.filter((feature) => feature.channel === channel) : all;
};

export const isStable = (id: string): boolean => getFeatureStatus(id).channel === "stable";

export type StabilityReport = {
  version: string;
  apiLevel: number;
  apiStability: StabilityChannel;
  counts: Record<StabilityChannel, number>;
  features: FeatureStatus[];
};

export const getStabilityReport = (): StabilityReport => {
  const features = listFeatures();
  const counts: Record<StabilityChannel, number> = { stable: 0, experimental: 0, internal: 0 };
  for (const feature of features) counts[feature.channel] += 1;
  return {
    version: ENGINE_VERSION,
    apiLevel: API_LEVEL,
    apiStability: API_STABILITY,
    counts,
    features
  };
};

export const isExperimental = (id: string): boolean => getFeatureStatus(id).channel === "experimental";
