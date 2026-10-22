import { describe, expect, it, vi } from "vitest";
import { Diagnostics } from "../../packages/engine/src/debug/Diagnostics";
import type { DiagnosticsSource } from "../../packages/engine/src/debug/Diagnostics";
import { Profiler } from "../../packages/engine/src/debug/Profiler";
import type { EngineConfig } from "../../packages/engine/src/core/EngineConfig";
import { resolveEngineConfig } from "../../packages/engine/src/core/EngineConfig";

const config: EngineConfig = resolveEngineConfig({ parent: "game" });

const createSource = (overrides: Partial<DiagnosticsSource> = {}): DiagnosticsSource => {
  const base: DiagnosticsSource = {
    getVersion: () => "0.1.0",
    getAdapterName: () => "FakeAdapter",
    isRunning: () => true,
    isDestroyed: () => false,
    getConfig: () => config,
    getTime: () => ({
      elapsed: 12,
      realElapsed: 12,
      deltaTime: 0.016,
      realDeltaTime: 0.016,
      frame: 720,
      timeScale: 1,
      paused: false,
      fixedDelta: 1 / 60,
      fixedAlpha: 0.5
    }),
    getScene: () => ({ id: "game", objects: 12, groups: ["crystals"], animations: 1, assetIds: ["player", "coin"] }),
    getAssets: () => ({
      report: {
        issues: [],
        errors: [],
        warnings: [],
        failures: [],
        counts: { total: 2, ready: 2, pending: 0, failed: 0 },
        sizes: { totalBytes: 0, knownAssets: 0, unknownAssets: 0, byType: {}, assets: [], issues: [] }
      },
      diagnostics: { registered: ["player", "coin"], unused: [], missing: [], failed: [], unlicensed: [], heaviest: [] }
    }),
    getAudio: () => ({
      attached: true,
      unlocked: true,
      muted: false,
      paused: false,
      volumes: { master: 1, music: 0.7, sfx: 1, ui: 0.9 },
      handles: 0,
      pending: 0
    }),
    getPhysics: () => ({ bodies: 12, colliders: 3, bounds: { x: 0, y: 0, width: 2000, height: 1400 } }),
    getProfiler: () => new Profiler(true, 8).snapshot(),
    getWasm: () => "idle",
    getLogs: () => ({ total: 0, dropped: 0, counts: { debug: 0, info: 0, warn: 0, error: 0 } }),
    getPlugins: () => ({ total: 0, active: 0, failed: 0, systems: 0, importers: 0, panels: 0, audit: [] }),
    getMemory: () => ({ used: 1024 * 1024, total: 2 * 1024 * 1024, limit: 64 * 1024 * 1024, source: "performance.memory" }),
    getEnvironment: () => ({
      userAgent: "vitest",
      language: "pl-PL",
      platform: "test",
      devicePixelRatio: 1,
      viewport: { width: 1280, height: 720 },
      hardwareConcurrency: 4,
      online: true,
      secureContext: true
    })
  };
  return { ...base, ...overrides };
};

describe("Diagnostics", () => {
  it("collects a complete report envelope", () => {
    const report = new Diagnostics(createSource()).report();
    expect(report.format).toBe("b2d-diagnostics");
    expect(report.version).toBe(1);
    expect(report.engine).toEqual({ version: "0.1.0", adapter: "FakeAdapter", running: true, destroyed: false });
    expect(report.scene.id).toBe("game");
    expect(report.physics.colliders).toBe(3);
    expect(report.environment.viewport).toEqual({ width: 1280, height: 720 });
    expect(Date.parse(report.generatedAt)).toBeGreaterThan(0);
    expect(report.findings).toEqual([]);
  });

  it("serialises to JSON without cycles", () => {
    const text = new Diagnostics(createSource()).toJSON();
    const parsed = JSON.parse(text) as { format: string; config: EngineConfig };
    expect(parsed.format).toBe("b2d-diagnostics");
    expect(parsed.config.parent).toBe("game");
    expect(text).toContain("\n  \"config\"");
  });

  it("raises findings for broken, unused and failed assets", () => {
    const report = new Diagnostics(
      createSource({
        getAssets: () => ({
          report: {
            issues: [],
            errors: [],
            warnings: [],
            failures: [{ id: "spark", src: "/spark.png", message: "404" }],
            counts: { total: 3, ready: 1, pending: 0, failed: 1 },
            sizes: { totalBytes: 0, knownAssets: 0, unknownAssets: 0, byType: {}, assets: [], issues: [] }
          },
          diagnostics: {
            registered: ["player", "coin", "spark"],
            unused: ["logo"],
            missing: ["spark"],
            failed: ["spark"],
            unlicensed: ["coin"],
            heaviest: []
          }
        })
      })
    ).report();

    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain("assets-failed");
    expect(codes).toContain("assets-missing");
    expect(codes).toContain("assets-unused");
    expect(codes).toContain("assets-unlicensed");
  });

  it("raises findings for audio, wasm, performance and logs", () => {
    const profiler = new Profiler(true, 4);
    profiler.startFrame();
    profiler.endFrame();
    const report = new Diagnostics(
      createSource({
        getAudio: () => ({
          attached: true,
          unlocked: false,
          muted: false,
          paused: false,
          volumes: { master: 1, music: 0.7, sfx: 1, ui: 0.9 },
          handles: 0,
          pending: 2
        }),
        getWasm: () => "failed",
        getProfiler: () => ({ ...profiler.snapshot(), fps: 30, samples: 8 }),
        getLogs: () => ({ total: 3, dropped: 0, counts: { debug: 0, info: 1, warn: 1, error: 1 } }),
        getEnvironment: () => ({
          userAgent: "vitest",
          language: "pl-PL",
          platform: "test",
          devicePixelRatio: 1,
          viewport: { width: 800, height: 600 },
          hardwareConcurrency: null,
          online: true,
          secureContext: false
        })
      })
    ).report();

    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain("audio-locked");
    expect(codes).toContain("audio-pending");
    expect(codes).toContain("wasm-failed");
    expect(codes).toContain("frame-rate-low");
    expect(codes).toContain("logs-error");
    expect(codes).toContain("insecure-context");
  });

  it("flags an empty scene and detached audio", () => {
    const report = new Diagnostics(
      createSource({
        getScene: () => ({ id: null, objects: 0, groups: [], animations: 0, assetIds: [] }),
        getAudio: () => ({
          attached: false,
          unlocked: false,
          muted: false,
          paused: false,
          volumes: { master: 1, music: 0.7, sfx: 1, ui: 0.9 },
          handles: 0,
          pending: 0
        })
      })
    ).report();
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain("audio-detached");
    expect(codes).toContain("scene-empty");
  });

  it("flags a nearly full JS heap", () => {
    const report = new Diagnostics(
      createSource({
        getMemory: () => ({
          used: 60 * 1024 * 1024,
          total: 62 * 1024 * 1024,
          limit: 64 * 1024 * 1024,
          source: "performance.memory"
        })
      })
    ).report();
    expect(report.findings.map((finding) => finding.code)).toContain("memory-high");
  });

  it("returns false when the clipboard is unavailable", async () => {
    const diagnostics = new Diagnostics(createSource());
    await expect(diagnostics.copy()).resolves.toBe(false);
  });

  it("downloads a report through a blob url", () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    const clicked: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicked.push(this.download);
    };

    try {
      const diagnostics = new Diagnostics(createSource());
      expect(diagnostics.download("report.json")).toBe(true);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clicked).toEqual(["report.json"]);
      expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      Object.defineProperty(URL, "createObjectURL", { value: originalCreate, configurable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
      void originalRevoke;
    }
  });
});
