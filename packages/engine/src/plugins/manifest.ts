import { isValidRange, parseVersion } from "./semver";

export const PLUGIN_PERMISSIONS = ["systems", "importers", "panels", "events", "scenes", "assets", "storage"] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export type PluginManifest = {
  id: string;
  version: string;
  engine: string;
  name?: string;
  description?: string;
  author?: string;
  dependencies?: Readonly<Record<string, string>>;
  permissions?: readonly PluginPermission[];
};

export type PluginManifestIssueCode =
  | "missing-field"
  | "invalid-field"
  | "invalid-id"
  | "invalid-version"
  | "invalid-range"
  | "unknown-permission";

export type PluginManifestIssue = {
  code: PluginManifestIssueCode;
  field: string;
  message: string;
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export const isPluginPermission = (value: unknown): value is PluginPermission =>
  typeof value === "string" && (PLUGIN_PERMISSIONS as readonly string[]).includes(value);

export const validatePluginManifest = (raw: unknown): PluginManifestIssue[] => {
  const issues: PluginManifestIssue[] = [];
  if (typeof raw !== "object" || raw === null) {
    return [{ code: "invalid-field", field: "manifest", message: "Manifest must be an object" }];
  }
  const manifest = raw as Record<string, unknown>;
  const required = ["id", "version", "engine"] as const;
  for (const field of required) {
    if (typeof manifest[field] !== "string" || (manifest[field] as string).trim() === "") {
      issues.push({ code: "missing-field", field, message: `Manifest needs a non-empty "${field}"` });
    }
  }
  if (typeof manifest.id === "string" && manifest.id.trim() !== "" && !ID_PATTERN.test(manifest.id)) {
    issues.push({
      code: "invalid-id",
      field: "id",
      message: 'Plugin id must be lowercase kebab-case, for example "my-plugin"'
    });
  }
  if (typeof manifest.version === "string" && manifest.version.trim() !== "" && !parseVersion(manifest.version)) {
    issues.push({ code: "invalid-version", field: "version", message: `"${manifest.version}" is not a valid version` });
  }
  if (typeof manifest.engine === "string" && manifest.engine.trim() !== "" && !isValidRange(manifest.engine)) {
    issues.push({ code: "invalid-range", field: "engine", message: `"${manifest.engine}" is not a valid version range` });
  }
  for (const field of ["name", "description", "author"] as const) {
    const value = manifest[field];
    if (value !== undefined && typeof value !== "string") {
      issues.push({ code: "invalid-field", field, message: `"${field}" must be a string` });
    }
  }
  if (manifest.dependencies !== undefined) {
    if (typeof manifest.dependencies !== "object" || manifest.dependencies === null) {
      issues.push({ code: "invalid-field", field: "dependencies", message: '"dependencies" must be an object' });
    } else {
      for (const [id, range] of Object.entries(manifest.dependencies as Record<string, unknown>)) {
        if (!ID_PATTERN.test(id)) {
          issues.push({ code: "invalid-id", field: `dependencies.${id}`, message: `"${id}" is not a valid plugin id` });
        }
        if (typeof range !== "string" || !isValidRange(range)) {
          issues.push({
            code: "invalid-range",
            field: `dependencies.${id}`,
            message: `Dependency "${id}" needs a valid version range`
          });
        }
      }
    }
  }
  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      issues.push({ code: "invalid-field", field: "permissions", message: '"permissions" must be an array' });
    } else {
      for (const permission of manifest.permissions) {
        if (!isPluginPermission(permission)) {
          issues.push({
            code: "unknown-permission",
            field: "permissions",
            message: `Unknown permission "${String(permission)}". Allowed: ${PLUGIN_PERMISSIONS.join(", ")}`
          });
        }
      }
    }
  }
  return issues;
};

export const normalizePluginManifest = (raw: unknown): PluginManifest => {
  const manifest = raw as Record<string, unknown>;
  const permissions = Array.isArray(manifest.permissions) ? (manifest.permissions as PluginPermission[]) : [];
  const dependencies = (manifest.dependencies ?? {}) as Record<string, string>;
  return Object.freeze({
    id: String(manifest.id),
    version: String(manifest.version),
    engine: String(manifest.engine),
    name: typeof manifest.name === "string" ? manifest.name : undefined,
    description: typeof manifest.description === "string" ? manifest.description : undefined,
    author: typeof manifest.author === "string" ? manifest.author : undefined,
    dependencies: Object.freeze({ ...dependencies }),
    permissions: Object.freeze([...new Set(permissions)])
  });
};
