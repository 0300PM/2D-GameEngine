import { describe, it, expect, vi } from "vitest";
import { Scene } from "../../packages/engine/src/core/Scene";
import { createHarness } from "../helpers/harness";

class ProbeScene extends Scene {
  created = 0;
  updated = 0;
  shutdowns = 0;
  fixedSteps: number[] = [];

  constructor() {
    super("probe");
  }

  create(): void {
    this.created += 1;
  }

  update(): void {
    this.updated += 1;
  }

  fixedUpdate(fixedDelta: number): void {
    this.fixedSteps.push(fixedDelta);
  }

  shutdown(): void {
    this.shutdowns += 1;
  }
}

describe("Scene lifecycle", () => {
  it("runs create, update and shutdown once", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    expect(scene.created).toBe(1);

    harness.step();
    scene.internalShutdown();

    expect(scene.updated).toBe(1);
    expect(scene.shutdowns).toBe(1);
  });

  it("ignores shutdown before create", () => {
    const scene = new ProbeScene();
    scene.internalShutdown();
    expect(scene.shutdowns).toBe(0);
  });

  it("does not update before create and after shutdown", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    scene.internalShutdown();
    harness.step();
    expect(scene.updated).toBe(0);
  });

  it("exposes the scene context and system order", () => {
    const scene = new ProbeScene();
    createHarness(scene);

    expect(scene.getEvents()).toBeDefined();
    expect(scene.getInput()).toBeDefined();
    expect(scene.getPhysics()).toBeDefined();
    expect(scene.getCamera()).toBeDefined();
    expect(scene.getAssets()).toBeDefined();
    expect(scene.getTime()).toBeDefined();
    expect(scene.width).toBe(800);
    expect(scene.height).toBe(600);
    expect(scene.getSystemOrder()).toEqual(["input", "scene.update", "behavior", "physics", "animation", "render"]);
  });

  it("stores scene data", () => {
    const scene = new ProbeScene();
    scene.initInternal(
      {
        audio: undefined as never,
        assets: undefined as never,
        input: undefined as never,
        physics: undefined as never,
        camera: undefined as never,
        events: undefined as never,
        logger: undefined as never,
        time: undefined as never,
        scheduler: undefined as never,
        random: undefined as never,
        width: 10,
        height: 10
      },
      { render: { create: () => undefined, destroy: () => undefined, sync: () => undefined, clear: () => undefined } },
      { level: 3 }
    );
    expect(scene.getData<{ level: number }>().level).toBe(3);
  });

  it("runs the fixed update hook with the fixed delta", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    scene.internalFixedUpdate(0.02);
    scene.internalFixedUpdate(0.02);
    expect(scene.fixedSteps).toEqual([0.02, 0.02]);
  });

  it("ignores non-positive fixed steps", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    scene.internalFixedUpdate(0);
    expect(scene.fixedSteps).toEqual([]);
  });

  it("logs a throwing fixed update instead of breaking the frame", () => {
    class Throwing extends Scene {
      create(): void {
        this.steps = 0;
      }

      steps = 0;

      fixedUpdate(): void {
        this.steps += 1;
        throw new Error("fixed step failed");
      }
    }
    const scene = new Throwing("throwing");
    const harness = createHarness(scene);
    harness.ctx.logger.setLevel("error");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => harness.scene.internalFixedUpdate(0.016)).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(scene.steps).toBe(1);
    error.mockRestore();
  });

  it("provides a scene scoped timer that is cleared on shutdown", () => {
    const scene = new ProbeScene();
    const harness = createHarness(scene);
    const callback = vi.fn();
    scene.getTimer().delay(0.1, callback);
    harness.scheduler.update(0.1);
    expect(callback).toHaveBeenCalledTimes(1);
    scene.getTimer().interval(0.1, callback);
    expect(scene.getTimer().pending).toBe(1);
    scene.internalShutdown();
    expect(scene.getTimer().pending).toBe(0);
  });

  it("provides a seeded random source", () => {
    const scene = new ProbeScene();
    createHarness(scene);
    const first = scene.getRandom().next();
    scene.getRandom().reset();
    expect(scene.getRandom().next()).toBe(first);
  });
});
