import { describe, expect, it, vi } from "vitest";
import { createRenderPort, type RenderLayerLike } from "../../packages/engine/src/adapters/createRenderPort";
import { GameObject } from "../../packages/engine/src/core/GameObject";
import type { AnimationState } from "../../packages/engine/src/core/ports";

const createLayer = (): RenderLayerLike & {
  created: GameObject[];
  destroyed: GameObject[];
  synced: number;
  cleared: number;
  calls: string[];
} => {
  const created: GameObject[] = [];
  const destroyed: GameObject[] = [];
  const calls: string[] = [];
  return {
    created,
    destroyed,
    synced: 0,
    cleared: 0,
    calls,
    create: (object) => {
      created.push(object);
      calls.push("create");
    },
    destroy: (object) => {
      destroyed.push(object);
      calls.push("destroy");
    },
    sync: () => {
      calls.push("sync");
    },
    clear: () => {
      calls.push("clear");
    },
    playAnimation: (_object, key) => {
      calls.push(`play:${key}`);
      return key === "hero:walk";
    },
    stopAnimation: (_object, key) => {
      calls.push(`stop:${key ?? "current"}`);
    },
    pauseAnimation: (_object, paused) => {
      calls.push(`pause:${paused}`);
    },
    setFrame: (_object, frame) => {
      calls.push(`frame:${frame}`);
      return true;
    },
    getAnimationState: (): AnimationState => ({ key: "hero:walk", frame: 2, isPlaying: true, isPaused: false })
  };
};

const physics = () => ({
  attachBody: vi.fn(),
  detachBody: vi.fn(),
  clear: vi.fn()
});

describe("createRenderPort", () => {
  it("attaches a body when an object with a body is created", () => {
    const layer = createLayer();
    const port = createRenderPort(layer, physics());
    const withBody = new GameObject("with-body", { body: { type: "dynamic" } });
    const withoutBody = new GameObject("no-body");
    port.create(withBody);
    port.create(withoutBody);
    expect(layer.created).toHaveLength(2);
    expect(port).toBeDefined();
  });

  it("delegates every lifecycle call", () => {
    const layer = createLayer();
    const fakePhysics = physics();
    const port = createRenderPort(layer, fakePhysics);
    const object = new GameObject("box", { body: { type: "static" } });

    port.create(object);
    expect(fakePhysics.attachBody).toHaveBeenCalledWith(object);
    port.sync([object]);
    port.destroy(object);
    expect(fakePhysics.detachBody).toHaveBeenCalledWith(object);
    port.clear();
    expect(fakePhysics.clear).toHaveBeenCalledTimes(1);
    expect(layer.calls).toEqual(["create", "sync", "destroy", "clear"]);
  });

  it("forwards animation control to the layer", () => {
    const layer = createLayer();
    const port = createRenderPort(layer, physics());
    const object = new GameObject("hero");

    expect(port.playAnimation?.(object, "hero:walk", { restart: true })).toBe(true);
    expect(port.playAnimation?.(object, "hero:fly")).toBe(false);
    port.pauseAnimation?.(object, true);
    expect(port.setFrame?.(object, 3)).toBe(true);
    port.stopAnimation?.(object, "hero:walk");
    expect(port.getAnimationState?.(object)).toEqual({ key: "hero:walk", frame: 2, isPlaying: true, isPaused: false });
    expect(layer.calls).toEqual(["play:hero:walk", "play:hero:fly", "pause:true", "frame:3", "stop:hero:walk"]);
  });

  it("degrades gracefully when a layer has no animation support", () => {
    const layer = createLayer();
    const minimal: RenderLayerLike = { create: layer.create, destroy: layer.destroy, sync: layer.sync, clear: layer.clear };
    const port = createRenderPort(minimal, physics());
    const object = new GameObject("hero");
    expect(port.playAnimation?.(object, "hero:walk")).toBe(false);
    expect(port.setFrame?.(object, 0)).toBe(false);
    expect(port.getAnimationState?.(object)).toBeNull();
    expect(() => port.stopAnimation?.(object)).not.toThrow();
    expect(() => port.pauseAnimation?.(object, true)).not.toThrow();
  });
});
