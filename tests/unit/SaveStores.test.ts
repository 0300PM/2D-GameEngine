import { describe, expect, it, vi } from "vitest";
import {
  FileSystemStore,
  HttpStore,
  IndexedDbStore,
  LocalStorageStore,
  MemoryStore,
  type SaveStore
} from "../../packages/engine/src/save/SaveStore";
import { PlayerSaveRepository, SaveCorruptionError, projectKey, saveKey } from "../../packages/engine/src/save/PlayerSave";

const fakeFetch = (handlers: { get?: (key: string) => Response; put?: (key: string, body: string) => Response; del?: (key: string) => Response; list?: () => Response }) => {
  const calls: string[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    const key = decodeURIComponent(url.split("/v1/entries/")[1] ?? "");
    if (url.endsWith("/v1/entries") && (!init?.method || init.method === "GET")) {
      return handlers.list?.() ?? new Response(JSON.stringify({ keys: [] }), { status: 200 });
    }
    if (init?.method === "PUT") return handlers.put?.(key, String(init.body)) ?? new Response("{}", { status: 200 });
    if (init?.method === "DELETE") return handlers.del?.(key) ?? new Response("{}", { status: 200 });
    return handlers.get?.(key) ?? new Response("{}", { status: 404 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
};

describe("save stores", () => {
  it("stores, lists and clears entries in memory", async () => {
    const store = new MemoryStore();
    await store.set("a", "1");
    await store.set("b", "2");
    expect(await store.get("a")).toBe("1");
    expect(await store.keys()).toEqual(["a", "b"]);
    expect(await store.delete("a")).toBe(true);
    expect(await store.delete("a")).toBe(false);
    await store.clear();
    expect(await store.keys()).toEqual([]);
  });

  it("uses localStorage with an isolated prefix", async () => {
    localStorage.clear();
    localStorage.setItem("foreign", "keep");
    const store = new LocalStorageStore("test:");
    await store.set("save:1", "value");
    expect(localStorage.getItem("test:save:1")).toBe("value");
    expect(await store.keys()).toEqual(["save:1"]);
    expect(await store.delete("save:1")).toBe(true);
    expect(localStorage.getItem("foreign")).toBe("keep");
    await store.clear();
    expect(localStorage.getItem("foreign")).toBe("keep");
  });

  it("reports IndexedDB availability instead of failing silently", () => {
    expect(IndexedDbStore.isAvailable()).toBe(false);
    expect(() => new IndexedDbStore()).toThrow(/IndexedDB/);
  });

  it("talks to the save server over HTTP", async () => {
    const store = new Map<string, string>();
    const { impl, calls } = fakeFetch({
      get: (key) => (store.has(key) ? new Response(JSON.stringify({ key, value: store.get(key) }), { status: 200 }) : new Response("{}", { status: 404 })),
      put: (key, body) => {
        store.set(key, JSON.parse(body).value);
        return new Response("{}", { status: 200 });
      },
      del: (key) => new Response("{}", { status: store.delete(key) ? 200 : 404 }),
      list: () => new Response(JSON.stringify({ keys: [...store.keys()].sort() }), { status: 200 })
    });
    const http = new HttpStore({ endpoint: "http://localhost:8787", token: "secret", fetchImpl: impl });

    expect(await http.get("missing")).toBeNull();
    await http.set("save:1:auto", "hello");
    expect(await http.get("save:1:auto")).toBe("hello");
    expect(await http.keys()).toEqual(["save:1:auto"]);
    expect(await http.delete("save:1:auto")).toBe(true);
    expect(await http.delete("save:1:auto")).toBe(false);
    expect(calls.some((call) => call.includes("save%3A1%3Aauto"))).toBe(true);
  });

  it("surfaces HTTP failures with the status code", async () => {
    const { impl } = fakeFetch({ get: () => new Response("{}", { status: 500 }) });
    const http = new HttpStore({ endpoint: "http://localhost:8787", fetchImpl: impl });
    await expect(http.get("x")).rejects.toThrow(/500/);
  });

  it("reports health of the save server", async () => {
    const impl = (async () => new Response(JSON.stringify({ ok: true, backend: "postgres" }), { status: 200 })) as unknown as typeof fetch;
    const http = new HttpStore({ endpoint: "http://localhost:8787", fetchImpl: impl });
    expect(await http.health()).toEqual({ ok: true, backend: "postgres" });
  });

  it("stores to the file system when a node fs is provided", async () => {
    const files = new Map<string, string>();
    const fs = {
      mkdir: async () => undefined,
      readFile: async (path: string) => {
        if (!files.has(path)) throw new Error("ENOENT");
        return files.get(path)!;
      },
      writeFile: async (path: string, data: string) => {
        files.set(path, data);
      },
      readdir: async () => [...files.keys()].map((path) => path.split("/").pop()!),
      unlink: async (path: string) => {
        files.delete(path);
      },
      rm: async () => {
        files.clear();
      }
    };
    const store = new FileSystemStore("/saves", async () => fs as never);
    await store.set("project:default", "{}");
    expect(await store.get("project:default")).toBe("{}");
    expect(await store.keys()).toEqual(["project:default"]);
    expect(await store.delete("project:default")).toBe(true);
  });
});

describe("PlayerSaveRepository", () => {
  const build = (store: SaveStore = new MemoryStore()) => ({
    store,
    saves: new PlayerSaveRepository(store, { now: () => "2026-10-22T10:00:00.000Z" })
  });

  it("saves and loads progress with an integrity checksum", async () => {
    const { saves } = build();
    const saved = await saves.save("p1", "auto", { crystals: 3, level: "game" });
    expect(saved.version).toBe(1);
    expect(saved.updatedAt).toBe("2026-10-22T10:00:00.000Z");
    expect(saved.checksum).toMatch(/^[0-9a-f]{8}$/);
    const loaded = await saves.load("p1", "auto");
    expect(loaded?.progress).toEqual({ crystals: 3, level: "game" });
  });

  it("returns null for an empty slot", async () => {
    const { saves } = build();
    expect(await saves.load("p1", "manual")).toBeNull();
  });

  it("keeps project data and player progress in separate namespaces", async () => {
    const { store, saves } = build();
    await saves.save("p1", "auto", { crystals: 1 });
    await store.set(projectKey("default"), "{}");
    const keys = await store.keys();
    expect(keys).toContain(saveKey("p1", "auto"));
    expect(keys).toContain("project:default");
    const savesOnly = await saves.list();
    expect(savesOnly).toEqual([{ playerId: "p1", slot: "auto", key: "save:p1:auto" }]);
  });

  it("detects corrupted saves", async () => {
    const { store, saves } = build();
    await saves.save("p1", "auto", { crystals: 1 });
    const raw = JSON.parse((await store.get(saveKey("p1", "auto")))!);
    raw.progress.crystals = 99;
    await store.set(saveKey("p1", "auto"), JSON.stringify(raw));
    await expect(saves.load("p1", "auto")).rejects.toBeInstanceOf(SaveCorruptionError);
  });

  it("rejects invalid JSON in a slot", async () => {
    const { store, saves } = build();
    await store.set(saveKey("p1", "auto"), "not json");
    await expect(saves.load("p1", "auto")).rejects.toThrow(/not valid JSON/);
  });

  it("migrates saves without a version field", async () => {
    const { store, saves } = build();
    await store.set(saveKey("p1", "auto"), JSON.stringify({ playerId: "p1", slot: "auto", progress: { crystals: 2 } }));
    const loaded = await saves.load("p1", "auto");
    expect(loaded?.version).toBe(1);
    expect(loaded?.progress).toEqual({ crystals: 2 });
  });

  it("lists slots per player and removes them", async () => {
    const { saves } = build();
    await saves.save("p1", "auto", {});
    await saves.save("p1", "manual", {});
    await saves.save("p2", "auto", {});
    expect((await saves.list()).length).toBe(3);
    expect((await saves.list("p1")).map((entry) => entry.slot).sort()).toEqual(["auto", "manual"]);
    expect(await saves.remove("p1", "auto")).toBe(true);
    expect((await saves.list("p1")).map((entry) => entry.slot)).toEqual(["manual"]);
  });

  it("validates player and slot identifiers", async () => {
    const { saves } = build();
    await expect(saves.save("", "auto", {})).rejects.toThrow(/playerId/);
    await expect(saves.save("p1", " ", {})).rejects.toThrow(/slot/);
  });

  it("reports localStorage as unavailable when the accessor throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError: sandboxed");
      }
    });
    try {
      expect(LocalStorageStore.isAvailable()).toBe(false);
      expect(() => new LocalStorageStore("b2d:")).toThrow(/localStorage is not available/);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });

  it("never touches localStorage when a store is injected", async () => {
    const backing = new Map<string, string>();
    const storage = {
      get length() {
        return backing.size;
      },
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      key: (index: number) => Array.from(backing.keys())[index] ?? null,
      clear: () => backing.clear()
    };
    const store = new LocalStorageStore("b2d:", storage);
    await store.set("save:a:b", "1");
    expect(await store.get("save:a:b")).toBe("1");
    expect(await store.keys()).toEqual(["save:a:b"]);
    expect(await store.delete("save:a:b")).toBe(true);
    expect(await store.get("save:a:b")).toBe(null);
    expect(LocalStorageStore.isAvailable()).toBe(true);
  });
});
