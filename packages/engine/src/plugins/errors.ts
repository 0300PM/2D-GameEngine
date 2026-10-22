import type { PluginManifestIssue } from "./manifest";

export type PluginErrorCode =
  | "invalid-manifest"
  | "duplicate-id"
  | "incompatible-engine"
  | "missing-dependency"
  | "dependency-cycle"
  | "permission-denied"
  | "activate-failed"
  | "deactivate-failed"
  | "runtime-error"
  | "system-disabled"
  | "duplicate-importer"
  | "unknown-importer"
  | "duplicate-panel";

export class PluginError extends Error {
  readonly code: PluginErrorCode;
  readonly pluginId: string;
  readonly issues: readonly PluginManifestIssue[];

  constructor(code: PluginErrorCode, pluginId: string, message: string, issues: readonly PluginManifestIssue[] = []) {
    super(message);
    this.name = "PluginError";
    this.code = code;
    this.pluginId = pluginId;
    this.issues = issues;
  }
}

export class PluginPermissionError extends PluginError {
  readonly permission: string;

  constructor(pluginId: string, permission: string, capability: string) {
    super(
      "permission-denied",
      pluginId,
      `Plugin "${pluginId}" tried to use "${capability}" without the "${permission}" permission`
    );
    this.name = "PluginPermissionError";
    this.permission = permission;
  }
}

export const pluginErrorOf = (error: unknown, pluginId: string, code: PluginErrorCode): PluginError => {
  if (error instanceof PluginError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new PluginError(code, pluginId, message);
};
