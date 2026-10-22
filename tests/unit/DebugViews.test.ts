import { describe, expect, it } from "vitest";
import { DebugViews, DEFAULT_DEBUG_VIEWS } from "../../packages/engine/src/debug/DebugViews";
import { createHarness } from "../helpers/harness";
import { Scene } from "../../packages/engine/src/core/Scene";

class EmptyScene extends Scene {
  constructor() {
    super("view-scene");
  }

  create(): void {
    return undefined;
  }
}

describe("DebugViews", () => {
  it("starts with every view disabled", () => {
    const views = new DebugViews(() => null, () => null);
    expect(views.get()).toEqual(DEFAULT_DEBUG_VIEWS);
    expect(views.isActive()).toBe(false);
  });

  it("pushes collider and layer state into the ports", () => {
    const harness = createHarness(new EmptyScene());
    const views = new DebugViews(
      () => harness.render,
      () => harness.physics
    );

    views.set({ colliders: true, grid: true, gridSize: 32, axes: true, cameraBounds: true });

    expect(harness.physics.debugDraw).toBe(true);
    expect(harness.render.debugLayer).toEqual({ grid: true, gridSize: 32, axes: true, cameraBounds: true });
    expect(views.isActive()).toBe(true);
  });

  it("toggles individual views and keeps the rest", () => {
    const harness = createHarness(new EmptyScene());
    const views = new DebugViews(
      () => harness.render,
      () => harness.physics
    );

    views.toggle("grid");
    views.toggle("colliders");
    expect(views.get().grid).toBe(true);
    expect(views.get().axes).toBe(false);
    views.toggle("grid");
    expect(views.get().grid).toBe(false);
    expect(harness.physics.debugDraw).toBe(true);
  });

  it("restores defaults and reports no active view", () => {
    const harness = createHarness(new EmptyScene());
    const views = new DebugViews(
      () => harness.render,
      () => harness.physics
    );
    views.set({ colliders: true, grid: true });
    views.reset();
    expect(views.get()).toEqual(DEFAULT_DEBUG_VIEWS);
    expect(harness.physics.debugDraw).toBe(false);
    expect(harness.render.debugLayer).toEqual({ grid: false, gridSize: 64, axes: false, cameraBounds: false });
    expect(views.isActive()).toBe(false);
  });

  it("rejects non-positive grid sizes", () => {
    const views = new DebugViews(() => null, () => null);
    views.set({ gridSize: 0 });
    expect(views.get().gridSize).toBe(DEFAULT_DEBUG_VIEWS.gridSize);
    views.set({ gridSize: -8 });
    expect(views.get().gridSize).toBe(DEFAULT_DEBUG_VIEWS.gridSize);
  });

  it("detects which views the backend supports", () => {
    const harness = createHarness(new EmptyScene());
    const supported = new DebugViews(
      () => harness.render,
      () => harness.physics
    ).getSupport();
    expect(supported).toEqual({ colliders: true, grid: true, axes: true, cameraBounds: true });

    const minimal = new DebugViews(
      () => null,
      () => null
    ).getSupport();
    expect(minimal).toEqual({ colliders: false, grid: false, axes: false, cameraBounds: false });
  });

  it("clears state on clear()", () => {
    const harness = createHarness(new EmptyScene());
    const views = new DebugViews(
      () => harness.render,
      () => harness.physics
    );
    views.set({ colliders: true, grid: true, axes: true });
    views.clear();
    expect(views.get()).toEqual(DEFAULT_DEBUG_VIEWS);
    expect(harness.render.debugLayer?.grid).toBe(false);
    expect(harness.physics.debugDraw).toBe(false);
  });
});
