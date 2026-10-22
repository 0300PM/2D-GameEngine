import { AssetManifest } from "../assets/AssetManifest";
import { CURRENT_PROJECT_VERSION, type ProjectFormatV2, type ProjectIssue } from "./Schema";

const toRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const splitKnown = (input: Record<string, unknown>, known: readonly string[]): Record<string, unknown> | undefined => {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) if (!known.includes(key)) extra[key] = value;
  return Object.keys(extra).length > 0 ? extra : undefined;
};

export type MigrationStep = {
  from: number;
  to: number;
  description: string;
  apply(input: Record<string, unknown>): Record<string, unknown>;
};

const migrateV1ToV2: MigrationStep = {
  from: 1,
  to: 2,
  description: "Split game settings from project root, add scenes array and keep unknown fields",
  apply(input) {
    const game = toRecord(input["game"]) ?? {};
    const assets = asArray(input["assets"]).map((asset) => ({ ...(toRecord(asset) ?? {}) }));
    const scenes = asArray(input["scenes"]).map((scene) => ({ ...(toRecord(scene) ?? {}) }));
    const settingsExtra = splitKnown(game, ["width", "height", "scaleMode", "backgroundColor"]);
    return {
      formatVersion: 2,
      name: input["name"],
      settings: {
        width: typeof game["width"] === "number" ? game["width"] : 1280,
        height: typeof game["height"] === "number" ? game["height"] : 720,
        scaleMode: typeof game["scaleMode"] === "string" ? game["scaleMode"] : "fit",
        backgroundColor: typeof game["backgroundColor"] === "string" ? game["backgroundColor"] : "#151515",
        unknownFields: settingsExtra
      },
      assets,
      scenes,
      unknownFields: splitKnown(input, ["formatVersion", "name", "game", "assets", "scenes"])
    };
  }
};

export const MIGRATIONS: readonly MigrationStep[] = [migrateV1ToV2];

export type MigrationResult = {
  ok: boolean;
  applied: string[];
  errors: ProjectIssue[];
  project?: ProjectFormatV2;
  original?: Record<string, unknown>;
};

const error = (message: string, path = ""): ProjectIssue => ({ code: "unsupported-version", severity: "error", message, path });

export const migrateProject = (input: unknown): MigrationResult => {
  const record = toRecord(input);
  const applied: string[] = [];
  if (!record) {
    return { ok: false, applied, errors: [error("Project must be a JSON object")] };
  }
  const rawVersion = record["formatVersion"];
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion)) {
    return { ok: false, applied, errors: [error("Project has no numeric formatVersion", "formatVersion")], original: record };
  }
  if (rawVersion > CURRENT_PROJECT_VERSION) {
    return {
      ok: false,
      applied,
      errors: [error(`Project format ${rawVersion} is newer than supported ${CURRENT_PROJECT_VERSION}`, "formatVersion")],
      original: record
    };
  }
  if (rawVersion < 1) {
    return { ok: false, applied, errors: [error(`Project format ${rawVersion} is not supported`, "formatVersion")], original: record };
  }

  let current = record;
  let version = rawVersion;
  while (version < CURRENT_PROJECT_VERSION) {
    const step = MIGRATIONS.find((entry) => entry.from === version);
    if (!step) {
      return {
        ok: false,
        applied,
        errors: [error(`No migration path from format ${version}`, "formatVersion")],
        original: record
      };
    }
    try {
      current = step.apply(current);
    } catch (cause) {
      return {
        ok: false,
        applied,
        errors: [error(`Migration ${step.from} -> ${step.to} failed: ${(cause as Error).message}`, "formatVersion")],
        original: record
      };
    }
    applied.push(`${step.from}->${step.to}`);
    version = step.to;
  }

  const assets = asArray(current["assets"]);
  const manifest = new AssetManifest();
  for (const asset of assets) {
    const descriptor = toRecord(asset);
    if (!descriptor || typeof descriptor["id"] !== "string" || typeof descriptor["src"] !== "string") {
      return { ok: false, applied, errors: [error("Migrated project has an invalid asset entry", "assets")], original: record };
    }
    if (manifest.has(descriptor["id"])) {
      return {
        ok: false,
        applied,
        errors: [{ code: "duplicate-id", severity: "error", message: `Duplicate asset id "${descriptor["id"]}"`, path: "assets" }],
        original: record
      };
    }
    manifest.register(descriptor as never);
  }

  return { ok: true, applied, errors: [], project: current as unknown as ProjectFormatV2, original: record };
};
