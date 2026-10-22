import { describe, it, expect, vi } from "vitest";
import { Engine } from "../../packages/engine/src/core/Engine";
import { Scene } from "../../packages/engine/src/core/Scene";
import type { AdapterDeps, AdapterFactory } from "../../packages/engine/src/core/ports";
import { FakeAudioPort, FakePhysicsPort, FakeRenderPort } from "../helpers/harness";

class StubScene extends Scene {
  created = 0;

  constructor(id: string) {
    super(id);
  }

  create(): void {
    this.created += 1;
  }
}

const createFakeAdapter = () => {
  const calls: string[] = [];
  const factory: AdapterFactory = (_config, deps: AdapterDeps) => {
    void deps;
    return {
      createGame: () => calls.push("createGame"),
      registerScene: (scene) => calls.push(`register:${scene.id}`),
      startScene: (id) => calls.push(`start:${id}`),
      stopScene: (id) => calls.push(`stop:${id}`),
      pause: () => calls.push("pause"),
      resume: () => calls.push("resume"),
      isRunning: () => true,
      destroy: () => calls.push("destroy")
    };
  };
  return { calls, factory };
};

const buildEngine = () => {
  const fake = createFakeAdapter();
  const engine = new Engine({ parent: "host" }, fake.factory);
  engine.registerScene(new StubScene("menu"));
  engine.registerScene(new StubScene("game"));
  return { engine, calls: fake.calls };
};

describe("Engine lifecycle without an adapter implementation", () => {
  it("validates config on construction", () => {
    const fake = createFakeAdapter();
    expect(() => new Engine({ parent: "" }, fake.factory)).toThrow(/Invalid EngineConfig/);
  });

  it("creates the runtime and registers every scene on start", () => {
    const { engine, calls } = buildEngine();
    engine.start();

    expect(engine.isRunning()).toBe(true);
    expect(calls).toEqual(["createGame", "register:menu", "register:game"]);
  });

  it("switches scenes and stops the previous one", () => {
    const { engine, calls } = buildEngine();
    engine.start("menu");
    calls.length = 0;

    engine.startScene("game");
    expect(calls).toEqual(["stop:menu", "start:game"]);
    expect(engine.getScenes().getActiveSceneId()).toBe("game");
  });

  it("registers scenes added while running", () => {
    const { engine, calls } = buildEngine();
    engine.start();
    calls.length = 0;

    engine.registerScene(new StubScene("extra"));
    expect(calls).toEqual(["register:extra"]);
  });

  it("delegates pause and resume", () => {
    const { engine, calls } = buildEngine();
    engine.start();
    calls.length = 0;

    engine.pause();
    engine.resume();
    expect(calls).toEqual(["pause", "resume"]);
  });

  it("emits lifecycle events", () => {
    const { engine } = buildEngine();
    const events: string[] = [];
    engine.on("engine:started", () => events.push("started"));
    engine.on("engine:stopped", () => events.push("stopped"));

    engine.start();
    engine.stop();
    expect(events).toEqual(["started", "stopped"]);
  });

  it("refuses to start a scene before start()", () => {
    const { engine } = buildEngine();
    expect(() => engine.startScene("game")).toThrow(/not running/);
  });

  it("rejects a scene that was never registered", () => {
    const { engine } = buildEngine();
    engine.start();
    expect(() => engine.startScene("missing")).toThrow(/not found/);
  });

  it("tears everything down on destroy", () => {
    const { engine, calls } = buildEngine();
    engine.start("game");
    const stop = vi.fn();
    engine.on("engine:stopped", stop);

    engine.destroy();
    expect(engine.isDestroyed()).toBe(true);
    expect(engine.getScenes().list()).toEqual([]);
    expect(engine.getAssets().count()).toBe(0);
    expect(calls).toContain("destroy");
    expect(stop).toHaveBeenCalled();
  });

  it("exposes the injected adapter", () => {
    const { engine } = buildEngine();
    expect(engine.getAdapter().isRunning()).toBe(true);
  });

  it("freezes game time while paused and restores it on resume", () => {
    const { engine, calls } = buildEngine();
    engine.start();
    engine.pause();
    expect(engine.getTime().isPaused).toBe(true);
    engine.getTime().update(16);
    expect(engine.getTime().deltaTime).toBe(0);
    engine.resume();
    expect(engine.getTime().isPaused).toBe(false);
    expect(calls).toContain("pause");
    expect(calls).toContain("resume");
  });

  it("applies the time scale and emits an event", () => {
    const { engine } = buildEngine();
    const seen: number[] = [];
    engine.on<{ timeScale: number }>("engine:timeScale", (payload) => seen.push(payload.timeScale));
    engine.setTimeScale(0.25);
    expect(engine.getTime().timeScale).toBe(0.25);
    expect(seen).toEqual([0.25]);
  });

  it("shares one scheduler between engine and scenes", () => {
    const { engine } = buildEngine();
    const callback = vi.fn();
    engine.getTimer().delay(0.1, callback);
    engine.getScheduler().update(0.1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("seeds the random generator from the config", () => {
    const first = new Engine({ parent: "host", seed: 99 }, createFakeAdapter().factory);
    const second = new Engine({ parent: "host", seed: 99 }, createFakeAdapter().factory);
    expect(first.getRandom().next()).toBe(second.getRandom().next());
    expect(first.getRandom().seed).toBe(99);
  });

  it("rejects an invalid seed and fixed step config", () => {
    expect(() => new Engine({ parent: "host", seed: -1 }, createFakeAdapter().factory)).toThrow(/seed/);
    expect(() => new Engine({ parent: "host", fixedStep: { hz: 0 } }, createFakeAdapter().factory)).toThrow(/fixedStep/);
    expect(() => new Engine({ parent: "host", fixedStep: { hz: 60, maxSteps: 0 } }, createFakeAdapter().factory)).toThrow(/maxSteps/);
  });

  it("configures the fixed step on the clock", () => {
    const engine = new Engine({ parent: "host", fixedStep: { hz: 50, maxSteps: 2 } }, createFakeAdapter().factory);
    expect(engine.getTime().fixedDelta).toBeCloseTo(0.02, 5);
  });

  it("clears pending timers on destroy", () => {
    const { engine } = buildEngine();
    const callback = vi.fn();
    engine.getTimer().delay(0.1, callback);
    engine.destroy();
    engine.getScheduler().update(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it("pauses and resumes audio together with the engine", () => {
    const { engine } = buildEngine();
    const port = new FakeAudioPort();
    port.unlocked = true;
    engine.getAudio().attach(port);
    engine.start("game");
    engine.getAudio().play("theme", { channel: "music", loop: true });

    engine.pause();
    expect(engine.getAudio().isPaused()).toBe(true);
    expect(port.pauseCalls).toBe(1);
    expect(port.plays[0].paused).toBe(true);

    engine.resume();
    expect(engine.getAudio().isPaused()).toBe(false);
    expect(port.plays[0].paused).toBe(false);
  });

  it("emits audio:unlocked when the backend unlocks", () => {
    const { engine } = buildEngine();
    const port = new FakeAudioPort();
    engine.getAudio().attach(port);
    const listener = vi.fn();
    engine.on("audio:unlocked", listener);
    expect(engine.getAudio().unlock()).toBe(true);
    expect(listener).toHaveBeenCalledWith({ unlocked: true });
  });

  it("detaches audio on destroy", () => {
    const { engine } = buildEngine();
    const port = new FakeAudioPort();
    engine.getAudio().attach(port);
    engine.start("game");
    engine.destroy();
    expect(engine.getAudio().isAttached()).toBe(false);
    expect(engine.isDestroyed()).toBe(true);
  });

  it("collects log entries from the logger into the buffer", () => {
    const { engine } = buildEngine();
    expect(engine.getLogs().size()).toBeGreaterThan(0);
    engine.getLogger().warn("diagnostic line", { scope: "test" });
    const found = engine.getLogs().filter({ text: "diagnostic line" });
    expect(found).toHaveLength(1);
    expect(found[0].level).toBe("warn");
    expect(engine.getLogs().counts().warn).toBeGreaterThan(0);
  });

  it("exposes a profiler that is off unless debug is enabled", () => {
    const { engine } = buildEngine();
    expect(engine.getProfiler().isEnabled()).toBe(false);
    engine.setDebug(true);
    expect(engine.getProfiler().isEnabled()).toBe(true);
    expect(engine.getLogger().getLevel()).toBe("debug");
    engine.setDebug(false);
    expect(engine.getProfiler().isEnabled()).toBe(false);
    expect(engine.getLogger().getLevel()).toBe("info");
  });

  it("toggles the overlay and the log panel with setDebug", () => {
    const { engine } = buildEngine();
    engine.setDebug(true);
    expect(engine.getLogPanel().isVisible()).toBe(true);
    engine.setDebug(false);
    expect(engine.getLogPanel().isVisible()).toBe(false);
  });

  it("reports a diagnostics snapshot with findings", () => {
    const { engine } = buildEngine();
    const report = engine.getDiagnosticsReport();
    expect(report.format).toBe("b2d-diagnostics");
    expect(report.engine.running).toBe(false);
    expect(report.scene.id).toBeNull();
    expect(report.config.parent).toBe("host");
    expect(report.findings.map((finding) => finding.code)).not.toContain("scene-empty");
  });

  it("routes debug views to the adapter ports", () => {
    const calls: string[] = [];
    const physicsPort = new FakePhysicsPort();
    const renderPort = new FakeRenderPort();
    const factory: AdapterFactory = () => ({
      createGame: () => calls.push("createGame"),
      registerScene: () => undefined,
      startScene: () => undefined,
      stopScene: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      isRunning: () => true,
      destroy: () => undefined,
      getRenderPort: () => renderPort,
      getPhysicsPort: () => physicsPort
    });
    const engine = new Engine({ parent: "host" }, factory);
    engine.start();

    engine.getDebugViews().set({ colliders: true, grid: true, gridSize: 48 });
    expect(physicsPort.debugDraw).toBe(true);
    expect(renderPort.debugLayer).toEqual({ grid: true, gridSize: 48, axes: false, cameraBounds: false });
    expect(engine.getDebugViews().getSupport().colliders).toBe(true);

    engine.setDebug(false);
    expect(engine.getDebugViews().isActive()).toBe(false);
    expect(physicsPort.debugDraw).toBe(false);
  });

  it("degrades debug views when the adapter exposes no ports", () => {
    const { engine } = buildEngine();
    engine.start();
    expect(engine.getDebugViews().getSupport()).toEqual({
      colliders: false,
      grid: false,
      axes: false,
      cameraBounds: false
    });
    expect(() => engine.getDebugViews().set({ colliders: true })).not.toThrow();
  });

  it("clears debug artefacts on destroy", () => {
    document.body.innerHTML = "";
    const { engine } = buildEngine();
    engine.setDebug(true);
    engine.start("game");
    engine.destroy();
    expect(engine.getLogPanel().isVisible()).toBe(false);
    expect(document.querySelector("[data-b2d-log-panel]")).toBeNull();
  });
});
