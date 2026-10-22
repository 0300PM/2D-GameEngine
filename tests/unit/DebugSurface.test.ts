import { describe, expect, it } from "vitest";
import { Engine } from "../../packages/engine/src/core/Engine";
import { Scene } from "../../packages/engine/src/core/Scene";
import type { AdapterDeps, AdapterFactory } from "../../packages/engine/src/core/ports";
import { FakePhysicsPort, FakeRenderPort } from "../helpers/harness";

class PlainScene extends Scene {
  create(): void {
    this.createRect(40, 40, { id: "wall", x: 10, y: 10, color: 0x223344, body: { type: "static" } });
  }
}

const createAdapter = () => {
  const calls: string[] = [];
  let captured: AdapterDeps | null = null;
  const render = new FakeRenderPort();
  const physics = new FakePhysicsPort();
  const factory: AdapterFactory = (_config, deps) => {
    captured = deps;
    deps.physics.attach(physics);
    return {
      getRenderPort: () => render,
      getPhysicsPort: () => physics,
      createGame: () => calls.push("createGame"),
      registerScene: (scene) => calls.push(`register:${scene.id}`),
      startScene: (id) => calls.push(`start:${id}`),
      stopScene: (id) => calls.push(`stop:${id}`),
      pause: () => calls.push("pause"),
      resume: () => calls.push("resume"),
      isRunning: () => true,
      destroy: () => calls.push("destroy"),
      getName: () => "test-adapter"
    };
  };
  return { calls, factory, render, physics, deps: () => captured };
};

const build = (debug = false) => {
  const adapter = createAdapter();
  const engine = new Engine({ parent: "host", debug }, adapter.factory);
  const scene = new PlainScene("game");
  engine.registerScene(scene);
  engine.start("game");
  return { engine, scene, render: adapter.render, physics: adapter.physics, calls: adapter.calls };
};

describe("debug surface integration", () => {
  it("starts with the profiler off and no debug layers", () => {
    const { engine } = build(false);
    expect(engine.getProfiler().isEnabled()).toBe(false);
    expect(engine.getDebugViews().isActive()).toBe(false);
    expect(engine.getDebugOverlay().isEnabled()).toBe(false);
  });

  it("enables profiling when debug starts on", () => {
    const { engine } = build(true);
    expect(engine.getProfiler().isEnabled()).toBe(true);
    expect(engine.getDebugOverlay().isEnabled()).toBe(true);
  });

  it("toggles profiling at runtime", () => {
    const { engine } = build(false);
    engine.setDebug(true);
    expect(engine.getProfiler().isEnabled()).toBe(true);
    engine.setDebug(false);
    expect(engine.getProfiler().isEnabled()).toBe(false);
  });

  it("pushes debug views to the render and physics ports", () => {
    const { engine, render, physics } = build(false);
    const layerCalls: unknown[] = [];
    const drawCalls: boolean[] = [];
    render.setDebugLayer = (state: unknown) => layerCalls.push(state);
    physics.setDebugDraw = (enabled: boolean) => drawCalls.push(enabled);

    const state = engine.getDebugViews().set({ colliders: true, grid: true, gridSize: 32 });
    expect(state.colliders).toBe(true);
    expect(layerCalls.at(-1)).toMatchObject({ grid: true, gridSize: 32 });
    expect(drawCalls.at(-1)).toBe(true);

    engine.getDebugViews().set({ colliders: false });
    expect(drawCalls.at(-1)).toBe(false);
  });

  it("reports which debug views the ports support", () => {
    const { engine, render, physics } = build(false);
    (render as { setDebugLayer?: unknown }).setDebugLayer = undefined;
    (physics as { setDebugDraw?: unknown }).setDebugDraw = undefined;
    expect(engine.getDebugViews().getSupport()).toEqual({ colliders: false, grid: false, axes: false, cameraBounds: false });
  });

  it("captures engine logs in the buffer", () => {
    const { engine } = build(false);
    engine.getLogger().warn("careful", { code: 7 });
    const entries = engine.getLogs().all();
    expect(entries.some((entry) => entry.message === "careful" && entry.level === "warn")).toBe(true);
    expect(engine.getLogs().counts().warn).toBeGreaterThan(0);
  });

  it("exposes a diagnostic report with the engine state", () => {
    const { engine } = build(true);
    const report = engine.getDiagnosticsReport();
    expect(report.engine.version).toBeTruthy();
    expect(report.engine.adapter).toBe("test-adapter");
    expect(report.scene.id).toBe("game");
    expect(typeof report.scene.objects).toBe("number");
    expect(report.config.debug).toBe(true);
    expect(report.plugins.total).toBe(0);
    expect(Array.isArray(report.findings)).toBe(true);
  });

  it("serialises the report without cycles", () => {
    const { engine } = build(true);
    const json = engine.getDiagnostics().toJSON();
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).scene.id).toBe("game");
  });

  it("resets views on demand", () => {
    const { engine } = build(false);
    engine.getDebugViews().set({ grid: true, axes: true });
    const reset = engine.getDebugViews().reset();
    expect(reset.grid).toBe(false);
    expect(reset.axes).toBe(false);
  });
});
