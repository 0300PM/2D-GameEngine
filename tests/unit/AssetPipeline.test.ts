import { describe, expect, it, vi } from "vitest";
import { AssetManager } from "../../packages/engine/src/systems/AssetManager";
import { AssetError } from "../../packages/engine/src/systems/AssetManager";
import { AssetManifest } from "../../packages/engine/src/assets/AssetManifest";
import { FakeAssetBackend } from "../helpers/harness";

const build = () => {
  const manager = new AssetManager();
  const backend = new FakeAssetBackend();
  manager.attachBackend(backend);
  manager.registerMany([
    { id: "hero", type: "image", src: "/hero.png", group: "world", bytes: 2048 },
    { id: "coin", type: "image", src: "/coin.png", group: "world", bytes: 1024 },
    { id: "menu-bg", type: "image", src: "/menu.png", group: "ui", bytes: 4096 }
  ]);
  return { manager, backend };
};

describe("AssetManager pipeline", () => {
  it("tracks status through the load lifecycle", () => {
    const { manager } = build();
    expect(manager.status("hero")).toBe("idle");
    manager.load(["hero"]);
    expect(manager.status("hero")).toBe("queued");
    manager.markLoading("hero");
    expect(manager.status("hero")).toBe("loading");
    manager.markLoaded("hero");
    expect(manager.status("hero")).toBe("ready");
    expect(manager.isLoaded("hero")).toBe(true);
  });

  it("loads everything or an explicit subset", () => {
    const { manager, backend } = build();
    manager.load(["coin"]);
    expect(backend.queued).toEqual(["coin"]);
    manager.load();
    expect(backend.queued).toEqual(["coin", "hero", "menu-bg"]);
  });

  it("ignores unknown ids and already loaded assets", () => {
    const { manager, backend } = build();
    manager.load(["missing"]);
    expect(backend.queued).toEqual([]);
    manager.markLoaded("hero");
    manager.load(["hero"]);
    expect(backend.queued).toEqual([]);
  });

  it("cancels queued work when the backend supports it", () => {
    const { manager, backend } = build();
    manager.load();
    expect(manager.cancel()).toBe(true);
    expect(backend.cancelCalls).toBe(1);
    expect(manager.status("hero")).toBe("idle");
  });

  it("reports a backend that cannot cancel", () => {
    const { manager, backend } = build();
    backend.canCancel = false;
    manager.load();
    expect(manager.cancel()).toBe(false);
    expect(manager.status("hero")).toBe("queued");
  });

  it("keeps loaded assets ready after a cancel", () => {
    const { manager } = build();
    manager.load();
    manager.markLoaded("hero");
    manager.cancel();
    expect(manager.status("hero")).toBe("ready");
    expect(manager.status("coin")).toBe("idle");
  });

  it("retries failed assets only", () => {
    const { manager, backend } = build();
    manager.load();
    manager.reportFailure(new AssetError("boom", "hero", "/hero.png"));
    manager.reportFailure(new AssetError("boom", "coin", "/coin.png"));
    expect(manager.status("hero")).toBe("failed");
    backend.queued = [];

    expect(manager.retry(["hero"])).toBe(1);
    expect(backend.queued).toEqual(["hero"]);
    expect(manager.status("hero")).toBe("queued");
    expect(manager.status("coin")).toBe("failed");
  });

  it("retries every failure by default", () => {
    const { manager, backend } = build();
    manager.reportFailure(new AssetError("boom", "hero", "/hero.png"));
    manager.reportFailure(new AssetError("boom", "coin", "/coin.png"));
    backend.queued = [];
    expect(manager.retry()).toBe(2);
    expect(backend.queued.sort()).toEqual(["coin", "hero"]);
  });

  it("returns zero when there is nothing to retry", () => {
    const { manager } = build();
    expect(manager.retry()).toBe(0);
  });

  it("collects a pipeline report with failures and sizes", () => {
    const { manager } = build();
    manager.markLoaded("hero");
    manager.reportFailure(new AssetError("404", "coin", "/coin.png"));
    const report = manager.report();
    expect(report.counts.total).toBe(3);
    expect(report.counts.ready).toBe(1);
    expect(report.counts.failed).toBe(1);
    expect(report.failures[0].id).toBe("coin");
    expect(report.errors.some((entry) => entry.code === "load-failed")).toBe(true);
    expect(report.sizes.totalBytes).toBe(2048 + 1024 + 4096);
  });

  it("holds assets per owner and releases them", () => {
    const { manager } = build();
    manager.hold("scene:world", ["hero", "coin"]);
    manager.hold("scene:ui", ["menu-bg"]);
    expect(manager.isRetained("hero")).toBe(true);
    expect(manager.releaseOwner("scene:world")).toBe(2);
    expect(manager.isRetained("hero")).toBe(false);
    expect(manager.isRetained("menu-bg")).toBe(true);
  });

  it("unloads only unreferenced assets on gc", () => {
    const { manager, backend } = build();
    manager.load();
    for (const id of ["hero", "coin", "menu-bg"]) {
      manager.markLoaded(id);
      backend.textures.add(id);
    }
    manager.hold("scene:ui", ["menu-bg"]);
    const collected = manager.gc();
    expect(collected.sort()).toEqual(["coin", "hero"]);
    expect(backend.textures.has("menu-bg")).toBe(true);
    expect(manager.status("hero")).toBe("idle");
    expect(manager.status("menu-bg")).toBe("ready");
  });

  it("honours manual retains before unloading", () => {
    const { manager } = build();
    manager.markLoaded("hero");
    manager.retain("hero");
    manager.retain("hero");
    expect(manager.release("hero")).toBe(false);
    expect(manager.release("hero")).toBe(false);
    expect(manager.release("hero")).toBe(true);
    expect(manager.isLoaded("hero")).toBe(false);
  });

  it("releases a whole group", () => {
    const { manager } = build();
    for (const id of ["hero", "coin", "menu-bg"]) manager.markLoaded(id);
    expect(manager.releaseGroup("world").sort()).toEqual(["coin", "hero"]);
    expect(manager.isLoaded("menu-bg")).toBe(true);
  });

  it("notifies loaded handlers once per asset", () => {
    const { manager } = build();
    const handler = vi.fn();
    manager.onLoaded(handler);
    manager.markLoaded("hero");
    manager.markLoaded("hero");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("builds a readable size list", () => {
    const { manager } = build();
    const lines = manager.formatSizes();
    expect(lines).toContain("hero (image): 2.0 kB");
  });

  it("replaces the manifest and resets statuses", () => {
    const { manager } = build();
    manager.markLoaded("hero");
    manager.setManifest(new AssetManifest([{ id: "only", type: "json", src: "/a.json" }]));
    expect(manager.count()).toBe(1);
    expect(manager.isLoaded("hero")).toBe(false);
    expect(manager.status("only")).toBe("idle");
  });

  it("uses backend measurements for sizes and heavy-asset checks", () => {
    const manager = new AssetManager();
    manager.register({ id: "hero", type: "image", src: "/hero.png" });
    const backend = new FakeAssetBackend();
    backend.sizes.set("hero", 600_000);
    manager.attachBackend(backend);
    const report = manager.report();
    expect(report.warnings.map((entry) => entry.code)).toContain("heavy-asset");
    expect(report.warnings.map((entry) => entry.code)).not.toContain("size-unknown");
    expect(report.sizes.totalBytes).toBe(600_000);
  });
});
