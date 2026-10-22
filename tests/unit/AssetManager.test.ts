import { describe, it, expect } from "vitest";
import { AssetManager } from "../../packages/engine/src/systems/AssetManager";

describe("AssetManager", () => {
  it("registers and detects duplicates", () => {
    const m = new AssetManager();
    m.register({ id: "player", type: "image", src: "/a.png" });
    expect(() => m.register({ id: "player", type: "image", src: "/b.png" })).toThrow();
  });
  it("accepts the same descriptor declared twice", () => {
    const m = new AssetManager();
    const descriptor = { id: "player", type: "image" as const, src: "/a.png" };
    m.register(descriptor);
    expect(() => m.register({ ...descriptor })).not.toThrow();
    expect(m.count()).toBe(1);
  });

  it("rejects the same id with a different source", () => {
    const m = new AssetManager();
    m.register({ id: "coin", type: "image", src: "/a.png" });
    expect(() => m.register({ id: "coin", type: "image", src: "/b.png" })).toThrow(/Duplicate asset id/);
  });

  it("has and count", () => {
    const m = new AssetManager();
    m.registerMany([
      { id: "a", type: "image", src: "/a.png" },
      { id: "b", type: "image", src: "/b.png" }
    ]);
    expect(m.count()).toBe(2);
    expect(m.has("a")).toBe(true);
  });
});

import { FakeAssetBackend } from "../helpers/harness";

describe("AssetManager with an asset backend", () => {
  const build = () => {
    const manager = new AssetManager();
    const backend = new FakeAssetBackend();
    manager.attachBackend(backend);
    return { manager, backend };
  };

  it("queues only pending descriptors", () => {
    const { manager, backend } = build();
    manager.registerMany([
      { id: "a", type: "image", src: "/a.png" },
      { id: "b", type: "image", src: "/b.png" }
    ]);
    manager.queue();
    expect(backend.queued).toEqual(["a", "b"]);

    manager.markLoaded("a");
    manager.queue();
    expect(backend.queued).toEqual(["a", "b"]);

    manager.cancel();
    manager.queue();
    expect(backend.queued).toEqual(["a", "b", "b"]);
  });

  it("reports progress and errors through handlers", () => {
    const { manager } = build();
    const progress: number[] = [];
    manager.onProgress((state) => progress.push(state.percent));
    manager.register({ id: "a", type: "image", src: "/a.png" });
    manager.reportProgress(1, 1);

    expect(progress).toEqual([100]);
  });

  it("delegates texture checks to the backend", () => {
    const { manager, backend } = build();
    manager.register({ id: "hero", type: "image", src: "/hero.png" });
    expect(manager.hasTexture("hero")).toBe(false);

    backend.textures.add("hero");
    expect(manager.hasTexture("hero")).toBe(true);
  });

  it("unloads through the backend", () => {
    const { manager, backend } = build();
    manager.register({ id: "hero", type: "image", src: "/hero.png" });
    manager.markLoaded("hero");
    backend.textures.add("hero");

    manager.unload("hero");
    expect(backend.textures.has("hero")).toBe(false);
    expect(manager.isLoaded("hero")).toBe(false);
  });
});
