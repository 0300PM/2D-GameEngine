import { describe, expect, it } from "vitest";
import { ProjectRepository } from "../../packages/engine/src/project/Repository";
import { MemoryStore, type SaveStore } from "../../packages/engine/src/save/SaveStore";
import { createDefaultProject } from "../../packages/engine/src/project/Schema";

class FlakyStore extends MemoryStore implements SaveStore {
  failOn: string | null = null;

  override async set(key: string, value: string): Promise<void> {
    if (this.failOn && key === this.failOn) throw new Error("disk full");
    await super.set(key, value);
  }
}

const project = (name: string) => ({
  ...createDefaultProject(name),
  scenes: [{ id: "game", objects: [{ id: "player" }] }]
});

describe("ProjectRepository", () => {
  it("saves and loads a project round trip", async () => {
    const store = new MemoryStore();
    const repository = new ProjectRepository(store);
    const result = await repository.save(project("Round trip"));
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);

    const loaded = await repository.load();
    expect(loaded.project?.name).toBe("Round trip");
    expect(loaded.project?.scenes[0].id).toBe("game");
    expect(loaded.errors).toEqual([]);
  });

  it("returns null when nothing is stored", async () => {
    const repository = new ProjectRepository(new MemoryStore());
    const loaded = await repository.load();
    expect(loaded.project).toBeNull();
    expect(await repository.exists()).toBe(false);
  });

  it("writes through a temporary key and removes it afterwards", async () => {
    const store = new MemoryStore();
    const repository = new ProjectRepository(store);
    await repository.save(project("Atomic"));
    const keys = await store.keys();
    expect(keys).toContain("project:default");
    expect(keys.some((key) => key.endsWith(".tmp"))).toBe(false);
  });

  it("does not touch the store when validation fails", async () => {
    const store = new MemoryStore();
    const repository = new ProjectRepository(store);
    await repository.save(project("Valid"));
    const before = await store.get("project:default");

    const invalid = await repository.save({ ...project("Broken"), settings: { ...project("Broken").settings, width: 0 } });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
    expect(await store.get("project:default")).toBe(before);
  });

  it("keeps the previous project when the commit fails", async () => {
    const store = new FlakyStore();
    const repository = new ProjectRepository(store);
    await repository.save(project("First"));
    const before = await store.get("project:default");

    store.failOn = "project:default";
    const result = await repository.save(project("Second"));
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toContain("restored");
    expect(await store.get("project:default")).toBe(before);
  });

  it("fails when the temporary copy cannot be written", async () => {
    const store = new FlakyStore();
    const repository = new ProjectRepository(store);
    store.failOn = "project:default.tmp";
    const result = await repository.save(project("No temp"));
    expect(result.ok).toBe(false);
    expect(await store.get("project:default")).toBeNull();
  });

  it("keeps a recovery copy and restores it", async () => {
    const store = new MemoryStore();
    const repository = new ProjectRepository(store);
    await repository.save(project("First"));
    await repository.save(project("Second"));

    const backup = await store.get(repository.getBackupKey());
    expect(backup).toContain("First");

    expect(await repository.restoreBackup()).toBe(true);
    const loaded = await repository.load();
    expect(loaded.project?.name).toBe("First");
  });

  it("reports a missing backup instead of throwing", async () => {
    const repository = new ProjectRepository(new MemoryStore());
    expect(await repository.restoreBackup()).toBe(false);
  });

  it("loads a legacy project through migration", async () => {
    const store = new MemoryStore();
    await store.set(
      "project:default",
      JSON.stringify({
        formatVersion: 1,
        name: "Legacy",
        game: { width: 640, height: 480, scaleMode: "fit", backgroundColor: "#000000" },
        assets: []
      })
    );
    const loaded = await new ProjectRepository(store).load();
    expect(loaded.migrated).toEqual(["1->2"]);
    expect(loaded.project?.settings.width).toBe(640);
  });

  it("surfaces corrupted storage as errors", async () => {
    const store = new MemoryStore();
    await store.set("project:default", "{not json");
    const loaded = await new ProjectRepository(store).load();
    expect(loaded.project).toBeNull();
    expect(loaded.errors[0].code).toBe("invalid-json");
  });

  it("supports a custom key and removes everything", async () => {
    const store = new MemoryStore();
    const repository = new ProjectRepository(store, { key: "project:slot-b" });
    await repository.save(project("Custom"));
    expect(await store.keys()).toContain("project:slot-b");
    await repository.remove();
    expect(await store.keys()).toEqual([]);
  });
});
