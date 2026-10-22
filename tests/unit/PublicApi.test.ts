import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Scene } from "../../packages/engine/src/core/Scene";
import { GameObject } from "../../packages/engine/src/core/GameObject";
import { Component, SYSTEM_ORDER } from "../../packages/engine/src/core/Component";
import { Transform } from "../../packages/engine/src/components/Transform";
import { AssetManager } from "../../packages/engine/src/systems/AssetManager";
import { EventBus } from "../../packages/engine/src/systems/EventBus";
import type { RenderPort, PhysicsPort, CameraPort, InputPort, AssetBackend } from "../../packages/engine/src/core/ports";
import { inactiveCollider } from "../../packages/engine/src/core/ports";
import { createHarness, FakeRenderPort, FakePhysicsPort, FakeCameraPort, FakeInputPort, FakeAssetBackend } from "../helpers/harness";

const ENGINE_ROOT = join(process.cwd(), "packages/engine/src");

const read = (path: string): string => readFileSync(join(ENGINE_ROOT, path), "utf8");

const listTsFiles = (directory: string): string[] => {
  const entries = readdirSync(join(ENGINE_ROOT, directory));
  return entries.flatMap((entry) => {
    const relative = join(directory, entry);
    const stats = statSync(join(ENGINE_ROOT, relative));
    return stats.isDirectory() ? listTsFiles(relative) : relative.endsWith(".ts") ? [relative] : [];
  });
};

describe("Public API surface", () => {
  const indexSource = read("index.ts");

  it("exports the stable core symbols", () => {
    const required = [
      "Engine",
      "Scene",
      "SceneManager",
      "GameObject",
      "Component",
      "Transform",
      "ObjectIndex",
      "Group",
      "AssetManager",
      "AssetError",
      "InputManager",
      "PhysicsManager",
      "CameraManager",
      "EventBus",
      "Logger",
      "EngineConfig",
      "RenderPort",
      "PhysicsPort",
      "CameraPort",
      "InputPort",
      "AssetBackend",
      "PhaserAdapter",
      "Time",
      "Random",
      "Scheduler",
      "Timer",
      "AssetManifest",
      "importTiledMap",
      "validateProject",
      "migrateProject",
      "exportProject",
      "importProject",
      "ProjectRepository",
      "PlayerSaveRepository",
      "LocalStorageStore",
      "IndexedDbStore",
      "HttpStore",
      "SqlSaveStore",
      "AudioManager",
      "SoundHandle",
      "TweenManager",
      "Tween",
      "TweenSequence",
      "EASINGS"
    ];
    for (const symbol of required) {
      expect(indexSource, `missing export: ${symbol}`).toContain(symbol);
    }
  });

  it("exports every port, so adapters can be implemented outside the engine", () => {
    const portsSource = read("core/ports.ts");
    for (const name of ["RenderPort", "PhysicsPort", "CameraPort", "InputPort", "AssetBackend"]) {
      expect(portsSource).toContain(`export interface ${name}`);
    }
    expect(portsSource).toContain("export type ColliderHandle");
    expect(portsSource).toContain("export const inactiveCollider");
  });

  it("keeps the system order stable and public", () => {
    expect(SYSTEM_ORDER).toEqual(["input", "behavior", "physics", "animation", "render"]);
  });

  it("type-checks the documented Scene object API", () => {
    expectTypeOf(Scene.prototype.createObject).toBeFunction();
    expectTypeOf(Scene.prototype.destroyObject).toBeFunction();
    expectTypeOf(Scene.prototype.findByTag).returns.toEqualTypeOf<GameObject[]>();
    expectTypeOf(Scene.prototype.findByTags).toBeFunction();
    expectTypeOf(Scene.prototype.group).toBeFunction();
    expectTypeOf(Scene.prototype.getObjects).returns.toEqualTypeOf<GameObject[]>();
    expectTypeOf(Scene.prototype.getSystemOrder).returns.toEqualTypeOf<readonly string[]>();
  });

  it("type-checks the documented GameObject API", () => {
    expectTypeOf(GameObject.prototype.addTag).returns.toBeObject();
    expectTypeOf(GameObject.prototype.addChild).toBeFunction();
    expectTypeOf(GameObject.prototype.removeChild).returns.toEqualTypeOf<boolean>();
    expectTypeOf(GameObject.prototype.getComponents).returns.toEqualTypeOf<Component[]>();
    expectTypeOf(GameObject.prototype.world).toEqualTypeOf<Transform>();
  });

  it("type-checks the documented Component API", () => {
    expectTypeOf(Component.prototype.setEnabled).returns.toBeObject();
    expectTypeOf(Component.prototype.setPhase).toBeFunction();
    expectTypeOf(Component.prototype.setOrder).toBeFunction();
    expectTypeOf(Component.prototype.owner).toEqualTypeOf<GameObject | null>();
  });

  it("type-checks the documented AssetManager API", () => {
    expectTypeOf(AssetManager.prototype.register).toBeFunction();
    expectTypeOf(AssetManager.prototype.queue).returns.toBeVoid();
    expectTypeOf(AssetManager.prototype.hasTexture).returns.toEqualTypeOf<boolean>();
    expectTypeOf(AssetManager.prototype.onProgress).toBeFunction();
    expectTypeOf(AssetManager.prototype.onError).toBeFunction();
  });
});

describe("Adapter isolation", () => {
  const adapterFreeRoots = ["core", "components", "systems", "assets", "project", "save", "animation", "audio"];

  it("never imports Phaser outside the adapter package", () => {
    const offenders: string[] = [];
    for (const root of adapterFreeRoots) {
      for (const file of listTsFiles(root)) {
        const source = read(file);
        if (/from ["']phaser["']/.test(source) || /\bPhaser\./.test(source)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the engine free of concrete adapters", () => {
    const offenders: string[] = [];
    for (const file of listTsFiles("core")) {
      const source = read(file);
      if (/from ["']\.\.\/adapters\//.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("exposes the engine factory from the package entry", () => {
    const source = read("index.ts");
    expect(source).toContain("createEngine");
    expect(source).toContain("createPhaserAdapter");
    expect(source).toContain("RuntimeAdapter");
  });

  it("lets a scene run against fake ports without the adapter", () => {
    class Bare extends Scene {
      create(): void {
        this.createObject({ id: "bare", tags: ["probe"] });
      }
    }
    const scene = new Bare("bare-scene");
    const harness = createHarness(scene);
    harness.step();

    expect(scene.findByTag("probe")).toHaveLength(1);
    expect(harness.render.created).toHaveLength(1);
  });
});

describe("EventBus contract used by scenes", () => {
  it("keeps handlers isolated from errors in other handlers", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    const errors: string[] = [];
    bus.onError = (error) => errors.push((error as Error).message);
    bus.on("tick", () => {
      throw new Error("handler failed");
    });
    bus.on("tick", () => seen.push("second"));

    bus.emit("tick", {});

    expect(seen).toEqual(["second"]);
    expect(errors).toEqual(["handler failed"]);
  });
});

describe("Port contracts", () => {
  it("type-checks that the fake ports satisfy the adapter interfaces", () => {
    expectTypeOf<FakeRenderPort>().toMatchTypeOf<RenderPort>();
    expectTypeOf<FakePhysicsPort>().toMatchTypeOf<PhysicsPort>();
    expectTypeOf<FakeCameraPort>().toMatchTypeOf<CameraPort>();
    expectTypeOf<FakeInputPort>().toMatchTypeOf<InputPort>();
    expectTypeOf<FakeAssetBackend>().toMatchTypeOf<AssetBackend>();
  });

  it("provides an inert collider handle for detached physics", () => {
    expect(inactiveCollider.active).toBe(false);
    expect(() => inactiveCollider.destroy()).not.toThrow();
  });
});
