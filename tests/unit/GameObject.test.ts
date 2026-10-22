import { describe, it, expect } from "vitest";
import { GameObject } from "../../packages/engine/src/core/GameObject";
import { Component } from "../../packages/engine/src/core/Component";

class Health extends Component {
  value = 100;
}

class Velocity extends Component {
  value = 1;
}

class Calls extends Component {
  log: string[] = [];

  onAttach(): void {
    this.log.push("attach");
  }

  onEnable(): void {
    this.log.push("enable");
  }

  onDisable(): void {
    this.log.push("disable");
  }

  onDetach(): void {
    this.log.push("detach");
  }

  onDestroy(): void {
    this.log.push("destroy");
  }
}

describe("GameObject hierarchy", () => {
  it("composes child transforms from the parent", () => {
    const parent = new GameObject("parent", { x: 100, y: 50, rotation: 0, scaleX: 2, scaleY: 2 });
    const child = new GameObject("child", { x: 10, y: 0 });
    parent.addChild(child);

    const world = child.world;
    expect(world.x).toBe(120);
    expect(world.y).toBe(50);
    expect(world.scaleX).toBe(2);
  });

  it("rotates child offsets around the parent", () => {
    const parent = new GameObject("parent", { rotation: Math.PI / 2 });
    const child = new GameObject("child", { x: 10, y: 0 });
    parent.addChild(child);

    const world = child.world;
    expect(world.x).toBeCloseTo(0);
    expect(world.y).toBeCloseTo(10);
    expect(world.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("invalidates descendant world transforms when an ancestor moves", () => {
    const parent = new GameObject("parent", { x: 0, y: 0 });
    const child = new GameObject("child", { x: 5, y: 5 });
    const grandchild = new GameObject("grandchild", { x: 5, y: 5 });
    parent.addChild(child);
    child.addChild(grandchild);

    expect(grandchild.world.x).toBe(10);
    parent.setPosition(100, 100);
    expect(grandchild.world.x).toBe(110);
    expect(grandchild.world.y).toBe(110);
  });

  it("reparents without duplicating children", () => {
    const first = new GameObject("first");
    const second = new GameObject("second");
    const child = new GameObject("child");
    first.addChild(child);
    second.addChild(child);

    expect(first.children).toHaveLength(0);
    expect(second.children).toHaveLength(1);
    expect(child.parent).toBe(second);
  });

  it("rejects cycles", () => {
    const parent = new GameObject("parent");
    const child = new GameObject("child");
    parent.addChild(child);

    expect(() => child.addChild(parent)).toThrow(/Cycle/);
    expect(() => parent.addChild(parent)).toThrow(/own child/);
  });
});

describe("GameObject components", () => {
  it("stores components by constructor", () => {
    const object = new GameObject("object");
    object.add(new Health());
    object.add(new Velocity());

    expect(object.get(Health)?.value).toBe(100);
    expect(object.get(Velocity)?.value).toBe(1);
    expect(object.getComponents()).toHaveLength(2);
  });

  it("replaces a component of the same type and detaches the previous one", () => {
    const object = new GameObject("object");
    const first = object.add(new Calls());
    object.add(new Calls());

    expect(first.owner).toBeNull();
    expect(first.log).toEqual(["attach", "enable", "disable", "detach"]);
    expect(object.getComponents()).toHaveLength(1);
  });

  it("runs enable hooks on attach for active objects", () => {
    const object = new GameObject("object");
    const component = object.add(new Calls());
    expect(component.log).toEqual(["attach", "enable"]);
  });

  it("skips enable hooks for inactive objects and fires them on activation", () => {
    const object = new GameObject("object", { active: false });
    const component = object.add(new Calls());
    expect(component.log).toEqual(["attach"]);

    object.setActive(true);
    expect(component.log).toEqual(["attach", "enable"]);

    object.setActive(false);
    expect(component.log).toEqual(["attach", "enable", "disable"]);
  });

  it("removes components and reports ownership", () => {
    const object = new GameObject("object");
    object.add(new Health);

    expect(object.has(Health)).toBe(true);
    expect(object.remove(Health)).toBe(true);
    expect(object.has(Health)).toBe(false);
    expect(object.remove(Health)).toBe(false);
  });
});

describe("GameObject tags", () => {
  it("adds, reads and removes tags", () => {
    const object = new GameObject("object");
    object.addTag("enemy").addTag("boss");

    expect(object.hasTag("enemy")).toBe(true);
    expect(object.hasAllTags(["enemy", "boss"])).toBe(true);
    expect(object.hasAnyTag(["boss", "npc"])).toBe(true);

    object.removeTag("boss");
    expect(object.hasAllTags(["enemy", "boss"])).toBe(false);
    expect(object.hasAnyTag(["boss", "npc"])).toBe(false);
  });
});
