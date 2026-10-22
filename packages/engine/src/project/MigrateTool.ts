import { CURRENT_PROJECT_VERSION } from "./Schema";
import { migrateProject } from "./Migrate";
import { validateProject } from "./Validate";
import { CURRENT_SAVE_VERSION, migrateSave } from "../save/PlayerSave";

export type MigrationIssue = { code: string; path?: string; message: string };

export type TextMigrationResult = {
  ok: boolean;
  kind: "project" | "save";
  from: number | null;
  to: number | null;
  applied: string[];
  errors: MigrationIssue[];
  warnings: string[];
  text: string | null;
};

const parseObject = (text: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch (error) {
    return null;
  }
};

const parseIssue = (text: string): MigrationIssue => {
  try {
    JSON.parse(text);
  } catch (error) {
    return { code: "invalid-json", message: error instanceof Error ? error.message : String(error) };
  }
  return { code: "invalid-shape", message: "Root value must be a JSON object" };
};

export const migrateProjectText = (text: string, options: { requireLicenses?: boolean } = {}): TextMigrationResult => {
  const record = parseObject(text);
  if (!record) {
    return {
      ok: false,
      kind: "project",
      from: null,
      to: null,
      applied: [],
      errors: [parseIssue(text)],
      warnings: [],
      text: null
    };
  }

  const rawVersion = record["formatVersion"];
  const from = typeof rawVersion === "number" && Number.isInteger(rawVersion) ? rawVersion : null;
  const migration = migrateProject(record);

  if (!migration.ok || !migration.project) {
    return {
      ok: false,
      kind: "project",
      from,
      to: null,
      applied: migration.applied,
      errors: migration.errors.map((problem) => ({ code: problem.code, path: problem.path, message: problem.message })),
      warnings: [],
      text: null
    };
  }

  const validation = validateProject(migration.project, { requireLicenses: options.requireLicenses ?? false });
  if (!validation.valid) {
    return {
      ok: false,
      kind: "project",
      from,
      to: CURRENT_PROJECT_VERSION,
      applied: migration.applied,
      errors: validation.errors.map((problem) => ({ code: problem.code, path: problem.path, message: problem.message })),
      warnings: validation.warnings.map((warning) => `${warning.code} @ ${warning.path}: ${warning.message}`),
      text: null
    };
  }

  return {
    ok: true,
    kind: "project",
    from,
    to: CURRENT_PROJECT_VERSION,
    applied: migration.applied,
    errors: [],
    warnings: validation.warnings.map((warning) => `${warning.code} @ ${warning.path}: ${warning.message}`),
    text: `${JSON.stringify(migration.project, null, 2)}\n`
  };
};

export const migrateSaveText = (text: string): TextMigrationResult => {
  const record = parseObject(text);
  if (!record) {
    return {
      ok: false,
      kind: "save",
      from: null,
      to: null,
      applied: [],
      errors: [parseIssue(text)],
      warnings: [],
      text: null
    };
  }

  const rawVersion = record["version"];
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 1) {
    return {
      ok: false,
      kind: "save",
      from: null,
      to: null,
      applied: [],
      errors: [{ code: "invalid-version", message: `Save has no valid version: ${String(rawVersion)}` }],
      warnings: [],
      text: null
    };
  }

  if (rawVersion > CURRENT_SAVE_VERSION) {
    return {
      ok: false,
      kind: "save",
      from: rawVersion,
      to: CURRENT_SAVE_VERSION,
      applied: [],
      errors: [
        {
          code: "future-version",
          message: `Save version ${rawVersion} is newer than supported ${CURRENT_SAVE_VERSION}`
        }
      ],
      warnings: [],
      text: null
    };
  }

  const migrated = migrateSave(record);
  return {
    ok: true,
    kind: "save",
    from: rawVersion,
    to: CURRENT_SAVE_VERSION,
    applied: rawVersion === CURRENT_SAVE_VERSION ? [] : [`${rawVersion} -> ${CURRENT_SAVE_VERSION}`],
    errors: [],
    warnings: [],
    text: `${JSON.stringify(migrated, null, 2)}\n`
  };
};

export const migrateText = (text: string, kind: "project" | "save", options: { requireLicenses?: boolean } = {}): TextMigrationResult =>
  kind === "project" ? migrateProjectText(text, options) : migrateSaveText(text);

export const formatMigrationSummary = (result: TextMigrationResult): string => {
  if (!result.ok) {
    const details = result.errors.map((problem) => `${problem.code}${problem.path ? ` @ ${problem.path}` : ""}: ${problem.message}`);
    return `${result.kind}: FAILED (${details.join("; ")})`;
  }
  if (result.applied.length === 0) return `${result.kind}: version ${result.to}, migration not required`;
  return `${result.kind}: ${result.from} -> ${result.to} (${result.applied.join(", ")})`;
};
