import { CURRENT_PROJECT_VERSION, type ProjectFormatV2, type ProjectIssue } from "./Schema";
import { migrateProject } from "./Migrate";
import { validateProject, type ProjectValidationResult, type ProjectValidateOptions } from "./Validate";
import { byteLength, mergeLimits, type ProjectLimits } from "./Limits";

export const PROJECT_ENVELOPE_FORMAT = "browser2d-project";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) continue;
      sorted[key] = canonical(entry);
    }
    return sorted;
  }
  return value;
};

export const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value));

export const checksum = (value: unknown): string => {
  const text = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export type ProjectEnvelope = {
  format: typeof PROJECT_ENVELOPE_FORMAT;
  formatVersion: number;
  checksum: string;
  project: ProjectFormatV2;
};

export const exportProjectEnvelope = (project: ProjectFormatV2): ProjectEnvelope => ({
  format: PROJECT_ENVELOPE_FORMAT,
  formatVersion: project.formatVersion,
  checksum: checksum(project),
  project
});

export const exportProject = (project: ProjectFormatV2, pretty = true): string => {
  const envelope = exportProjectEnvelope(project);
  return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
};

export type ProjectImportResult = ProjectValidationResult & { migrated: string[]; checksum?: string };

const fail = (code: ProjectIssue["code"], message: string, path = ""): ProjectImportResult => ({
  valid: false,
  errors: [{ code, severity: "error", message, path }],
  warnings: [],
  migrated: []
});

export type ProjectImportOptions = ProjectValidateOptions & { verifyChecksum?: boolean };

export const importProject = (text: string, options: ProjectImportOptions = {}): ProjectImportResult => {
  const limits: ProjectLimits = mergeLimits(options.limits);
  const size = byteLength(text);
  if (size > limits.maxBytes) {
    return fail("limit-exceeded", `Project payload is ${size} bytes, limit ${limits.maxBytes}`, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return fail("invalid-json", `Invalid JSON: ${(cause as Error).message}`);
  }
  return importProjectValue(parsed, options);
};

export const importProjectValue = (parsed: unknown, options: ProjectImportOptions = {}): ProjectImportResult => {
  if (typeof parsed !== "object" || parsed === null) return fail("invalid-type", "Project must be a JSON object");

  const record = parsed as Record<string, unknown>;
  const isEnvelope = record["format"] === PROJECT_ENVELOPE_FORMAT;
  const projectValue = isEnvelope ? record["project"] : parsed;
  const expectedChecksum = isEnvelope ? record["checksum"] : undefined;

  if (isEnvelope && typeof expectedChecksum !== "string") {
    return fail("checksum-mismatch", "Envelope has no checksum", "checksum");
  }
  if (isEnvelope && (options.verifyChecksum ?? true)) {
    const actual = checksum(projectValue);
    if (actual !== expectedChecksum) {
      return fail("checksum-mismatch", `Checksum mismatch: expected ${String(expectedChecksum)}, got ${actual}`, "checksum");
    }
  }

  const version = (projectValue as Record<string, unknown>)["formatVersion"];
  let migrated: string[] = [];
  let candidate: unknown = projectValue;
  if (version !== CURRENT_PROJECT_VERSION) {
    const migration = migrateProject(projectValue);
    if (!migration.ok || !migration.project) {
      return { valid: false, errors: migration.errors, warnings: [], migrated: migration.applied };
    }
    migrated = migration.applied;
    candidate = migration.project;
  }

  const validation = validateProject(candidate, { requireLicenses: options.requireLicenses, limits: options.limits });
  return { ...validation, migrated, checksum: typeof expectedChecksum === "string" ? expectedChecksum : checksum(candidate) };
};
