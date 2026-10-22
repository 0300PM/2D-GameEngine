import { describe, it, expect } from "vitest";
import { Scene } from "../../packages/engine/src/core/Scene";
import { Component, SYSTEM_ORDER, phaseRank, type SystemPhase } from "../../packages/engine/src/core/Component";
import { createHarness } from "../helpers/harness";

class Recorder extends Component {
  log: string[] = [];
  updates = 0;

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

  onUpdate(): void {
    this.updates += 1;
  }

  onDestroy(): void {
    this.log.push("destroy");
  }
}

class Ordered extends Component {
  static trace: string[] = [];

  constructor(
    private marker: string,
    phase: SystemPhase = "behavior",
    order = 0
  ) {
    super();
    this.phase = phase;
    this.order = order;
  }

  onUpdate(): void {
    Ordered.trace.push(this.marker);
  }
}

class ProbeScene extends Scene {
  trace: string[] = [];
  onUpdate: ((deltaTime: number) => void) | null = null;

  constructor() {
    super("probe");
  }

  create(): void {
    return undefined;
  }

  update(): void {
    this.trace.push("scene.update");
    this.onUpdate?.(0);
  }
}

describe("Component lifecycle", () => {
  it("runs attach, enable, disable and detach in order", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const object = scene.createObject({ id: "object" });
    const component = object.add(new Recorder());

    expect(component.log).toEqual(["attach", "enable"]);
    object.setActive(false);
    expect(component.log).toEqual(["attach", "enable", "disable"]);
    object.setActive(true);
    expect(component.log).toEqual(["attach", "enable", "disable", "enable"]);

    object.remove(Recorder);
    expect(component.log).toEqual(["attach", "enable", "disable", "enable", "disable", "detach"]);
    expect(component.owner).toBeNull();
  });

  it("runs onDestroy when the owner is destroyed", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const object = scene.createObject({ id: "object" });
    const component = object.add(new Recorder());

    scene.destroyObject(object);
    expect(component.log).toEqual(["attach", "enable", "disable", "destroy"]);
    expect(component.owner).toBeNull();
  });

  it("stops updating disabled components and resumes on enable", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const component = scene.createObject({ id: "object" }).add(new Recorder());

    harness.step(0.016, 2);
    expect(component.updates).toBe(2);

    component.setEnabled(false);
    expect(component.log).toContain("disable");
    harness.step(0.016, 2);
    expect(component.updates).toBe(2);

    component.setEnabled(true);
    harness.step();
    expect(component.updates).toBe(3);
  });

  it("does not update components of inactive objects or inactive subtrees", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const parent = scene.createObject({ id: "parent" });
    const child = scene.createObject({ id: "child" });
    parent.addChild(child);
    const direct = parent.add(new Recorder());
    const nested = child.add(new Recorder());

    scene.deactivateObject(parent);
    harness.step(0.016, 2);
    expect(direct.updates).toBe(0);
    expect(nested.updates).toBe(0);

    scene.activateObject(parent);
    harness.step(0.016, 2);
    expect(direct.updates).toBe(2);
    expect(nested.updates).toBe(2);
  });

  it("exposes the owner scene through the component", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const component = scene.createObject({ id: "object" }).add(new Recorder());
    expect(component.scene).toBe(scene);
  });
});

describe("System order", () => {
  it("declares a stable phase order", () => {
    expect(SYSTEM_ORDER).toEqual(["input", "behavior", "physics", "animation", "render"]);
    expect(phaseRank("input")).toBeLessThan(phaseRank("behavior"));
    expect(phaseRank("physics")).toBeLessThan(phaseRank("render"));
  });

  it("runs input components, scene.update, then remaining phases", () => {
    Ordered.trace = [];
    const scene = new ProbeScene();
    createHarness(scene);
    scene.createObject({ id: "a" }).add(new Ordered("render", "render"));
    scene.createObject({ id: "b" }).add(new Ordered("behavior", "behavior"));
    scene.createObject({ id: "c" }).add(new Ordered("input", "input"));
    scene.createObject({ id: "d" }).add(new Ordered("physics", "physics"));

    scene.onUpdate = () => {
      Ordered.trace.push("scene.update");
    };

    scene.internalUpdate(0.016);
    expect(Ordered.trace).toEqual(["input", "scene.update", "behavior", "physics", "render"]);
  });

  it("orders components inside a phase by order then registration", () => {
    Ordered.trace = [];
    const scene = new ProbeScene();
    createHarness(scene);
    scene.createObject({ id: "a" }).add(new Ordered("late", "behavior", 10));
    scene.createObject({ id: "b" }).add(new Ordered("early", "behavior", -10));
    scene.createObject({ id: "c" }).add(new Ordered("default-a", "behavior", 0));
    scene.createObject({ id: "d" }).add(new Ordered("default-b", "behavior", 0));

    scene.internalUpdate(0.016);
    expect(Ordered.trace).toEqual(["early", "default-a", "default-b", "late"]);
  });

  it("re-sorts when a component phase changes at runtime", () => {
    Ordered.trace = [];
    const scene = new ProbeScene();
    createHarness(scene);
    const moving = scene.createObject({ id: "a" }).add(new Ordered("moved", "behavior"));
    scene.createObject({ id: "b" }).add(new Ordered("behavior", "behavior"));

    scene.internalUpdate(0.016);
    expect(Ordered.trace).toEqual(["moved", "behavior"]);

    Ordered.trace = [];
    moving.setPhase("render");
    scene.internalUpdate(0.016);
    expect(Ordered.trace).toEqual(["behavior", "moved"]);
  });
});
