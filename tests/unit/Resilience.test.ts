import { describe, expect, it } from "vitest";
import { PlayerSaveRepository, SaveCorruptionError } from "../../packages/engine/src/save/PlayerSave";
import { HttpStore, LocalStorageStore, MemoryStore } from "../../packages/engine/src/save/SaveStore";

import { importProject } from "../../packages/engine/src/project/Serialize";
import { validateProject } from "../../packages/engine/src/project/Validate";

describe("network failures", () => {
  it("rejects with a readable message when fetch throws", async () => {
    const impl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const store = new HttpStore({ endpoint: "https://example.test", fetchImpl: impl });
    await expect(store.get("slot")).rejects.toThrow(/Failed to fetch/);
  });

  it("lets the game continue when the save server is unreachable", async () => {
    const impl = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    const repository = new PlayerSaveRepository(new HttpStore({ endpoint: "https://example.test", fetchImpl: impl }));
    const loaded = await repository.load("demo", "auto").catch(() => null);
    expect(loaded).toBeNull();
  });

  it("keeps working with an in-memory fallback", async () => {
    const repository = new PlayerSaveRepository(new MemoryStore());
    await repository.save("demo", "auto", { collected: ["a"], completed: false, crystals: 1 });
    const loaded = await repository.load("demo", "auto");
    expect((loaded?.progress as { crystals: number }).crystals).toBe(1);
  });
});

describe("corrupted browser storage", () => {
  it("ignores a broken localStorage entry", async () => {
    localStorage.setItem("b2d:save:demo:auto", "{ not json");
    const repository = new PlayerSaveRepository(new LocalStorageStore("b2d:"));
    const loaded = await repository.load("demo", "auto").catch(() => null);
    expect(loaded).toBeNull();
    localStorage.clear();
  });

  it("rejects a save written by a newer build instead of half-reading it", async () => {
    localStorage.setItem("b2d:save:demo:auto", JSON.stringify({ version: 99, playerId: "demo", slot: "auto", progress: {} }));
    const repository = new PlayerSaveRepository(new LocalStorageStore("b2d:"));
    const error = await repository.load("demo", "auto").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SaveCorruptionError);
    expect(String((error as Error).message)).toContain("99");
    localStorage.clear();
  });

  it("detects a tampered checksum", async () => {
    const store = new MemoryStore();
    const repository = new PlayerSaveRepository(store);
    await repository.save("demo", "auto", { crystals: 1 });
    const key = "save:demo:auto";
    const record = JSON.parse((await store.get(key)) ?? "{}") as Record<string, unknown>;
    record.progress = { crystals: 99 };
    await store.set(key, JSON.stringify(record));
    const error = await repository.load("demo", "auto").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SaveCorruptionError);
  });
});

describe("invalid project data", () => {
  it("never throws on arbitrary JSON shapes", () => {
    const inputs = [null, 42, "text", [], [[]], { formatVersion: "2" }, { formatVersion: 2, scenes: "nope" }];
    for (const input of inputs) {
      expect(() => validateProject(input)).not.toThrow();
      expect(validateProject(input).valid).toBe(false);
    }
  });

  it("never throws on arbitrary text", () => {
    for (const text of ["", "{", "[]", "null", "{\"formatVersion\": 1e999}"]) {
      expect(() => importProject(text)).not.toThrow();
    }
  });

  it("reports the first blocking problem for a broken scene", () => {
    const result = validateProject({
      formatVersion: 2,
      name: "Broken",
      settings: { width: 800, height: 600, scaleMode: "fit", backgroundColor: "#000000" },
      assets: [],
      scenes: [{ id: "main", objects: [{ id: "hero", asset: "missing" }] }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("broken-reference");
  });
});
