import { describe, it, expect, vi } from "vitest";
import { Component } from "../../packages/engine/src/core/Component";
import { Scene } from "../../packages/engine/src/core/Scene";
import { createHarness } from "../helpers/harness";

class ProbeScene extends Scene {
  destroyedDuringUpdate: string[] = [];
  seenAfterDestroy: string[] = [];
  onUpdate: ((deltaTime: number) => void) | null = null;

  constructor() {
    super("probe");
  }

  create(): void {
    return undefined;
  }

  update(deltaTime: number): void {
    this.onUpdate?.(deltaTime);
  }
}

describe("Scene object lifecycle", () => {
  it("spawns objects and notifies the render port", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const object = scene.createObject({ id: "player", x: 10, y: 20 });

    expect(scene.getObject("player")).toBe(object);
    expect(scene.objectCount()).toBe(1);
    expect(harness.render.created).toContain(object);
    expect(object.x).toBe(10);
  });

  it("throws on duplicate ids", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    scene.createObject({ id: "dup" });
    expect(() => scene.createObject({ id: "dup" })).toThrow(/already exists/);
  });

  it("generates unique ids when omitted", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const first = scene.createObject();
    const second = scene.createObject();
    expect(first.id).not.toBe(second.id);
  });

  it("destroys immediately outside the update loop", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const object = scene.createObject({ id: "temp" });

    expect(scene.destroyObject("temp")).toBe(true);
    expect(object.destroyed).toBe(true);
    expect(scene.getObject("temp")).toBeUndefined();
    expect(harness.render.destroyed).toContain(object);
    expect(scene.destroyObject("temp")).toBe(false);
  });

  it("defers destruction requested during the update loop", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const object = scene.createObject({ id: "victim" });
    const events: string[] = [];
    harness.events.on("object:destroyed", () => events.push("destroyed"));

    scene.onUpdate = () => {
      scene.destroyObject("victim");
      expect(object.destroyed).toBe(false);
      expect(scene.getObject("victim")).toBe(object);
    };

    harness.step();
    expect(object.destroyed).toBe(true);
    expect(scene.getObject("victim")).toBeUndefined();
    expect(events).toEqual(["destroyed"]);
  });

  it("keeps updating the rest of the scene after a deferred destroy", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const survivor = scene.createObject({ id: "survivor" });
    scene.createObject({ id: "victim" });
    let updates = 0;

    scene.onUpdate = () => {
      updates += 1;
      if (updates === 1) scene.destroyObject("victim");
      survivor.translate(1, 0);
    };

    harness.step(0.016, 3);
    expect(updates).toBe(3);
    expect(survivor.x).toBe(3);
  });

  it("destroys descendants with their parent", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const parent = scene.createObject({ id: "parent" });
    const child = scene.createObject({ id: "child" });
    parent.addChild(child);

    scene.destroyObject(parent);
    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
    expect(harness.render.destroyed).toEqual(expect.arrayContaining([parent, child]));
    expect(scene.objectCount()).toBe(0);
  });

  it("activates and deactivates objects", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const object = scene.createObject({ id: "dormant" });

    scene.deactivateObject(object);
    expect(object.isActiveInHierarchy).toBe(false);
    scene.activateObject("dormant");
    expect(object.isActiveInHierarchy).toBe(true);
  });

  it("destroys every object on shutdown and clears the render port", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    scene.createObject({ id: "a" });
    scene.createObject({ id: "b" });

    scene.internalShutdown();
    expect(scene.objectCount()).toBe(0);
    expect(harness.render.cleared).toBe(1);
  });
});

describe("Scene queries", () => {
  const buildScene = () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const enemy = scene.createObject({ id: "enemy-1", name: "Goblin", x: 10, tags: ["enemy", "melee"] });
    const boss = scene.createObject({ id: "boss", name: "Dragon", x: 500, tags: ["enemy", "boss"] });
    const coin = scene.createObject({ id: "coin", name: "Coin", tags: ["pickup"] });
    return { scene, enemy, boss, coin };
  };

  it("finds by tag, name and predicate", () => {
    const { scene, enemy, boss, coin } = buildScene();
    expect(scene.findByTag("enemy")).toEqual(expect.arrayContaining([enemy, boss]));
    expect(scene.findByTag("enemy")).toHaveLength(2);
    expect(scene.findByTag("pickup")).toEqual([coin]);
    expect(scene.findByName("Dragon")).toBe(boss);
    expect(scene.find((object) => object.x > 100)).toBe(boss);
    expect(scene.findAll((object) => object.hasTag("enemy"))).toHaveLength(2);
  });

  it("filters by several tags with any and all modes", () => {
    const { scene, enemy, boss } = buildScene();
    expect(scene.findByTags(["boss", "pickup"])).toEqual(expect.arrayContaining([boss]));
    expect(scene.findByTags(["enemy", "boss"], "all")).toEqual([boss]);
    expect(scene.findByTags(["enemy", "boss"], "any")).toHaveLength(2);
    expect(scene.findByTags(["enemy", "boss"], "all")).not.toContain(enemy);
  });

  it("keeps the tag index in sync with runtime changes", () => {
    const { scene, coin } = buildScene();
    coin.addTag("enemy");
    expect(scene.findByTag("enemy")).toContain(coin);
    coin.removeTag("enemy");
    expect(scene.findByTag("enemy")).not.toContain(coin);
  });

  it("tracks groups and their members", () => {
    const { scene, enemy, coin } = buildScene();
    const group = scene.group("actors");
    group.add(enemy);
    group.add(coin);

    expect(group.size).toBe(2);
    expect(scene.getGroupMembers("actors")).toEqual(expect.arrayContaining([enemy, coin]));
    group.remove(coin);
    expect(scene.getGroup("actors")?.size).toBe(1);
    expect(scene.getGroups()).toContain("actors");
  });

  it("removes destroyed objects from every index", () => {
    const { scene, enemy } = buildScene();
    scene.group("actors").add(enemy);
    scene.destroyObject(enemy);

    expect(scene.findByTag("enemy")).toHaveLength(1);
    expect(scene.getGroup("actors")?.size).toBe(0);
    expect(scene.findByName("Goblin")).toBeUndefined();
  });
});

describe("Scene rendering bridge", () => {
  it("syncs only dirty objects", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const moving = scene.createObject({ id: "moving" });
    scene.createObject({ id: "static" });

    harness.step();
    const firstBatch = [...harness.render.synced];
    harness.render.synced = [];
    moving.setPosition(1, 1);
    harness.step();

    expect(firstBatch.length).toBeGreaterThan(0);
    expect(harness.render.synced).toEqual([moving]);
  });

  it("applies physics positions back to the scene graph", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const body = scene.createObject({ id: "body", body: { type: "dynamic" } });
    harness.physics.attachBody(body);
    harness.physics.positions.set(body, { x: 42, y: 24 });

    harness.step();
    expect(body.x).toBe(42);
    expect(body.y).toBe(24);
  });

  it("reports component failures without breaking the frame", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    scene.createObject({ id: "object" }).add(new Throwing());

    expect(() => harness.step()).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

class Throwing extends Component {
  onUpdate(): void {
    throw new Error("boom");
  }
}
