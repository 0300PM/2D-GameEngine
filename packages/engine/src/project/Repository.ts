import { exportProject, importProject } from "./Serialize";
import { validateProject } from "./Validate";
import type { ProjectFormatV2, ProjectIssue } from "./Schema";
import type { SaveStore } from "../save/SaveStore";
import { projectKey } from "../save/PlayerSave";
import { checksum } from "../core/Checksum";

export type RepositoryOptions = {
  key?: string;
  keepBackup?: boolean;
};

export type LoadResult = {
  project: ProjectFormatV2 | null;
  errors: ProjectIssue[];
  warnings: ProjectIssue[];
  migrated: string[];
  checksum?: string;
};

export type SaveResult = {
  ok: boolean;
  errors: ProjectIssue[];
  warnings: ProjectIssue[];
  checksum?: string;
  bytes?: number;
};

const failure = (message: string, path = ""): SaveResult => ({
  ok: false,
  errors: [{ code: "invalid-field", severity: "error", message, path }],
  warnings: []
});

export class ProjectRepository {
  private key: string;
  private keepBackup: boolean;

  constructor(
    private store: SaveStore,
    options: RepositoryOptions = {}
  ) {
    this.key = options.key ?? projectKey();
    this.keepBackup = options.keepBackup ?? true;
  }

  getKey(): string {
    return this.key;
  }

  getBackupKey(): string {
    return `${this.key}.backup`;
  }

  async exists(): Promise<boolean> {
    return (await this.store.get(this.key)) !== null;
  }

  async load(): Promise<LoadResult> {
    const raw = await this.store.get(this.key);
    if (raw === null) return { project: null, errors: [], warnings: [], migrated: [] };
    const result = importProject(raw);
    return {
      project: result.project ?? null,
      errors: result.errors,
      warnings: result.warnings,
      migrated: result.migrated,
      checksum: result.checksum
    };
  }

  async save(project: ProjectFormatV2): Promise<SaveResult> {
    const validation = validateProject(project);
    if (!validation.valid || !validation.project) {
      return { ok: false, errors: validation.errors, warnings: validation.warnings };
    }
    const normalized = validation.project;
    const json = exportProject(normalized, true);
    const expected = checksum(normalized);
    const previous = await this.store.get(this.key);
    const tempKey = `${this.key}.tmp`;

    try {
      await this.store.set(tempKey, json);
    } catch (cause) {
      return failure(`Could not write the temporary copy: ${(cause as Error).message}`, tempKey);
    }

    const written = await this.store.get(tempKey);
    if (written !== json) {
      await this.store.delete(tempKey).catch(() => undefined);
      return failure("Temporary copy read back different content; project left untouched", tempKey);
    }

    try {
      if (this.keepBackup && previous !== null) await this.store.set(this.getBackupKey(), previous);
      await this.store.set(this.key, json);
    } catch (cause) {
      if (previous !== null) await this.store.set(this.key, previous).catch(() => undefined);
      else await this.store.delete(this.key).catch(() => undefined);
      await this.store.delete(tempKey).catch(() => undefined);
      return failure(`Commit failed, previous project restored: ${(cause as Error).message}`, this.key);
    }

    await this.store.delete(tempKey).catch(() => undefined);
    return { ok: true, errors: [], warnings: validation.warnings, checksum: expected, bytes: json.length };
  }

  async restoreBackup(): Promise<boolean> {
    const backup = await this.store.get(this.getBackupKey());
    if (backup === null) return false;
    await this.store.set(this.key, backup);
    return true;
  }

  async remove(): Promise<void> {
    await this.store.delete(this.key);
    await this.store.delete(this.getBackupKey());
  }
}
