import { checksum } from "../core/Checksum";
import type { SaveStore } from "./SaveStore";

export const CURRENT_SAVE_VERSION = 1;
export const SAVE_KEY_PREFIX = "save:";
export const PROJECT_KEY_PREFIX = "project:";

export type PlayerSave = {
  version: number;
  playerId: string;
  slot: string;
  updatedAt: string;
  progress: Record<string, unknown>;
  checksum?: string;
};

export class SaveCorruptionError extends Error {
  constructor(
    message: string,
    public key: string
  ) {
    super(message);
    this.name = "SaveCorruptionError";
  }
}

export const projectKey = (id = "default"): string => `${PROJECT_KEY_PREFIX}${id}`;

export const saveKey = (playerId: string, slot: string): string => `${SAVE_KEY_PREFIX}${playerId}:${slot}`;

const parseSaveKey = (key: string): { playerId: string; slot: string } | null => {
  if (!key.startsWith(SAVE_KEY_PREFIX)) return null;
  const rest = key.slice(SAVE_KEY_PREFIX.length);
  const separator = rest.lastIndexOf(":");
  if (separator <= 0) return null;
  return { playerId: rest.slice(0, separator), slot: rest.slice(separator + 1) };
};

export const migrateSave = (input: Record<string, unknown>): Record<string, unknown> => {
  if (input["version"] === CURRENT_SAVE_VERSION) return input;
  if (typeof input["version"] !== "number") {
    return { ...input, version: CURRENT_SAVE_VERSION, progress: (input["progress"] as Record<string, unknown>) ?? {} };
  }
  return input;
};

export type SaveRepositoryOptions = {
  now?: () => string;
};

export class PlayerSaveRepository {
  private now: () => string;

  constructor(
    private store: SaveStore,
    options: SaveRepositoryOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async save(playerId: string, slot: string, progress: Record<string, unknown>): Promise<PlayerSave> {
    if (!playerId.trim()) throw new Error("playerId must not be empty");
    if (!slot.trim()) throw new Error("slot must not be empty");
    const base = {
      version: CURRENT_SAVE_VERSION,
      playerId,
      slot,
      updatedAt: this.now(),
      progress
    };
    const record: PlayerSave = { ...base, checksum: checksum(base) };
    await this.store.set(saveKey(playerId, slot), JSON.stringify(record));
    return record;
  }

  async load(playerId: string, slot: string): Promise<PlayerSave | null> {
    const key = saveKey(playerId, slot);
    const raw = await this.store.get(key);
    if (raw === null) return null;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (cause) {
      throw new SaveCorruptionError(`Save "${key}" is not valid JSON: ${(cause as Error).message}`, key);
    }
    const migrated = migrateSave(parsed);
    const expected = migrated["checksum"];
    if (typeof expected === "string") {
      const { checksum: _ignored, ...rest } = migrated;
      void _ignored;
      const actual = checksum(rest);
      if (actual !== expected) throw new SaveCorruptionError(`Save "${key}" failed its integrity check`, key);
    }
    const version = Number(migrated["version"] ?? CURRENT_SAVE_VERSION);
    if (!Number.isInteger(version) || version < 1) {
      throw new SaveCorruptionError(`Save "${key}" has an invalid version: ${String(migrated["version"])}`, key);
    }
    if (version > CURRENT_SAVE_VERSION) {
      throw new SaveCorruptionError(
        `Save "${key}" uses format ${version} but this build supports ${CURRENT_SAVE_VERSION}`,
        key
      );
    }
    return {
      version,
      playerId: String(migrated["playerId"] ?? playerId),
      slot: String(migrated["slot"] ?? slot),
      updatedAt: String(migrated["updatedAt"] ?? ""),
      progress: (migrated["progress"] as Record<string, unknown>) ?? {},
      checksum: typeof expected === "string" ? expected : undefined
    };
  }

  async remove(playerId: string, slot: string): Promise<boolean> {
    return this.store.delete(saveKey(playerId, slot));
  }

  async list(playerId?: string): Promise<{ playerId: string; slot: string; key: string }[]> {
    const keys = await this.store.keys();
    const entries: { playerId: string; slot: string; key: string }[] = [];
    for (const key of keys) {
      const parsed = parseSaveKey(key);
      if (!parsed) continue;
      if (playerId && parsed.playerId !== playerId) continue;
      entries.push({ ...parsed, key });
    }
    return entries;
  }
}
