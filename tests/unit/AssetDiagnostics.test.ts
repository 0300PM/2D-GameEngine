import { describe, expect, it } from "vitest";
import { AssetError, AssetManager } from "../../packages/engine/src/systems/AssetManager";
import { Profiler } from "../../packages/engine/src/debug/Profiler";
import { Scene } from "../../packages/engine/src/core/Scene";
import { createHarness } from "../helpers/harness";

describe("AssetManager.diagnose", () => {
  const build = (): AssetManager => {
    const manager = new AssetManager();
    manager.registerMany([
      { id: "player", type: "image", src: "/player.png", bytes: 2048, license: { name: "CC0" } },
      { id: "coin", type: "image", src: "/coin.png", bytes: 1024, license: { name: "CC0" } },
      { id: "spark", type: "spritesheet", src: "/spark.png", frameWidth: 16, frameHeight: 16, bytes: 8192, license: { name: "CC0" } }
    ]);
    return manager;
  };

  it("lists registered assets and treats every id as used by default", () => {
    const diagnostics = build().diagnose();
    expect(diagnostics.registered).toEqual(["player", "coin", "spark"]);
    expect(diagnostics.unused).toEqual([]);
    expect(diagnostics.missing).toEqual([]);
    expect(diagnostics.failed).toEqual([]);
  });

  it("detects assets nobody declares", () => {
    const diagnostics = build().diagnose({ usedIds: ["player"] });
    expect(diagnostics.unused).toEqual(["coin", "spark"]);
  });

  it("reports references that point at unknown assets", () => {
    const diagnostics = build().diagnose({
      references: { "scene:game": ["player", "ghost"], "scene:menu": ["missing-tile"] }
    });
    expect(diagnostics.missing).toEqual(["ghost", "missing-tile"]);
  });

  it("reports failed loads and unlicensed assets", () => {
    const manager = new AssetManager();
    manager.registerMany([
      { id: "player", type: "image", src: "/player.png", bytes: 1024 },
      { id: "sfx", type: "audio", src: "/sfx.wav", bytes: 4096, license: { name: "CC0" } }
    ]);
    manager.reportError(new AssetError("boom", "sfx", "/sfx.wav"));
    const diagnostics = manager.diagnose();
    expect(diagnostics.unlicensed).toEqual(["player"]);
    expect(diagnostics.failed).toEqual(["sfx"]);
    expect(diagnostics.registered).toEqual(["player", "sfx"]);
  });

  it("returns the heaviest assets first", () => {
    const diagnostics = build().diagnose();
    expect(diagnostics.heaviest[0]).toEqual({ id: "spark", bytes: 8192 });
    expect(diagnostics.heaviest).toHaveLength(3);
    expect(diagnostics.heaviest.every((entry) => typeof entry.bytes === "number")).toBe(true);
  });
});

class ProbeScene extends Scene {
  constructor() {
    super("probe");
  }

  create(): void {
    this.declareAssets([{ id: "hero", type: "image", src: "/hero.png" }]);
    this.createObject({ id: "box", x: 10, y: 20 });
  }

  update(): void {
    this.getObject("box")?.translate(1, 0);
  }
}

describe("Scene and profiler integration", () => {
  it("records declared asset ids", () => {
    const harness = createHarness(new ProbeScene());
    expect(harness.scene.getDeclaredAssetIds()).toEqual(["hero"]);
    harness.scene.declareAssets([
      { id: "hero", type: "image", src: "/hero.png" },
      { id: "coin", type: "image", src: "/coin.png" }
    ]);
    expect(harness.scene.getDeclaredAssetIds()).toEqual(["hero", "coin"]);
  });

  it("emits profiler marks for the engine phases", () => {
    const profiler = new Profiler(true, 8);
    const harness = createHarness(new ProbeScene(), { profiler });
    harness.step(0.016, 2);
    const snapshot = profiler.snapshot();
    const names = snapshot.stats.map((entry) => entry.name);
    expect(names).toContain("scene.update");
    expect(names).toContain("components");
    expect(names).toContain("tweens");
    expect(names).toContain("render.sync");
    expect(names).toContain("destroy");
    expect(snapshot.stats.find((entry) => entry.name === "scene.update")?.calls).toBe(2);
  });

  it("keeps working without a profiler attached", () => {
    const harness = createHarness(new ProbeScene());
    expect(harness.ctx.profiler).toBeUndefined();
    expect(() => harness.step(0.016, 1)).not.toThrow();
  });
});

describe("PhysicsManager debug hooks", () => {
  it("forwards debug draw to the port and exposes stats", () => {
    const harness = createHarness(new ProbeScene());
    harness.managerPhysics.setDebugDraw(true);
    expect(harness.physics.debugDraw).toBe(true);
    harness.managerPhysics.setWorldBounds(0, 0, 400, 300);
    harness.managerPhysics.attachBody(harness.scene.getObject("box")!);
    const stats = harness.managerPhysics.getStats();
    expect(stats).toEqual({ bodies: 1, colliders: 0, bounds: { x: 0, y: 0, width: 400, height: 300 } });
  });

  it("returns null stats without a port", () => {
    const harness = createHarness(new ProbeScene());
    harness.managerPhysics.detach();
    expect(harness.managerPhysics.getStats()).toBeNull();
    expect(() => harness.managerPhysics.setDebugDraw(true)).not.toThrow();
  });
});
