import { ENGINE_VERSION } from "./version";

export type DeprecationRecord = {
  id: string;
  replacement: string | null;
  since: string;
  removeIn: string;
  message: string;
};

const REGISTRY = new Map<string, DeprecationRecord>();
const EMITTED = new Set<string>();

export const registerDeprecation = (record: DeprecationRecord): DeprecationRecord => {
  REGISTRY.set(record.id, { ...record });
  return { ...record };
};

export const getDeprecations = (): DeprecationRecord[] =>
  [...REGISTRY.values()].sort((left, right) => left.id.localeCompare(right.id));

export const findDeprecation = (id: string): DeprecationRecord | null => {
  const record = REGISTRY.get(id);
  return record ? { ...record } : null;
};

export const formatDeprecation = (record: DeprecationRecord): string =>
  `${record.id} is deprecated since ${record.since}` +
  `${record.replacement ? ` — use ${record.replacement}` : ""}` +
  ` (removed in ${record.removeIn})`;

export type DeprecationSink = (message: string, record: DeprecationRecord) => void;

export const resetDeprecationNotices = (): void => {
  EMITTED.clear();
};

export const deprecate = (id: string, sink?: DeprecationSink): DeprecationRecord | null => {
  const record = REGISTRY.get(id);
  if (!record) return null;
  if (!EMITTED.has(id)) {
    EMITTED.add(id);
    sink?.(formatDeprecation(record), { ...record });
  }
  return { ...record };
};

export const deprecationReport = () => ({
  version: ENGINE_VERSION,
  registered: getDeprecations().length,
  notified: [...EMITTED].sort(),
  entries: getDeprecations()
});

export const clearDeprecations = (): void => {
  REGISTRY.clear();
  EMITTED.clear();
};

registerDeprecation({
  id: "scene.createSprite",
  replacement: 'scene.spawn("sprite", options)',
  since: "0.1.0",
  removeIn: "0.3.0",
  message: "createSprite(asset, options) keeps the positional asset argument"
});

registerDeprecation({
  id: "engine.getDiagnostics().toJSON()",
  replacement: "engine.getDiagnosticsReport()",
  since: "0.1.0",
  removeIn: "0.3.0",
  message: "toJSON() returns the same sections as the report, but without findings"
});
