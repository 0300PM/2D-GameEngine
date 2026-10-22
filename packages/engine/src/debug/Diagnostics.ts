import type { EngineConfig } from "../core/EngineConfig";
import type { TimeState } from "../core/Time";
import type { AudioState } from "../audio/AudioManager";
import type { WasmModuleState } from "../wasm/WasmBridge";
import type { PluginSummary } from "../plugins/types";
import type { AssetDiagnostics, AssetPipelineReport } from "../systems/AssetManager";
import type { LogLevel } from "../systems/Logger";
import type { MemoryInfo } from "../systems/Memory";
import type { ProfileSnapshot } from "./Profiler";

export type DiagnosticsFinding = {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
};

export type DiagnosticsScene = {
  id: string | null;
  objects: number;
  groups: string[];
  animations: number;
  assetIds: string[];
};

export type DiagnosticsPhysics = {
  bodies: number;
  colliders: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
};

export type DiagnosticsEnvironment = {
  userAgent: string;
  language: string;
  platform: string;
  devicePixelRatio: number;
  viewport: { width: number; height: number };
  hardwareConcurrency: number | null;
  online: boolean;
  secureContext: boolean;
};

export type DiagnosticsReport = {
  format: "b2d-diagnostics";
  version: 1;
  generatedAt: string;
  engine: { version: string; adapter: string; running: boolean; destroyed: boolean };
  config: EngineConfig;
  time: TimeState;
  scene: DiagnosticsScene;
  assets: AssetPipelineReport & { diagnostics: AssetDiagnostics };
  audio: AudioState;
  physics: DiagnosticsPhysics;
  profiler: ProfileSnapshot;
  wasm: WasmModuleState;
  logs: { total: number; dropped: number; counts: Record<LogLevel, number> };
  plugins: PluginSummary;
  memory: MemoryInfo | null;
  environment: DiagnosticsEnvironment;
  findings: DiagnosticsFinding[];
};

export type DiagnosticsSource = {
  getVersion(): string;
  getAdapterName(): string;
  isRunning(): boolean;
  isDestroyed(): boolean;
  getConfig(): EngineConfig;
  getTime(): TimeState;
  getScene(): DiagnosticsScene;
  getAssets(): { report: AssetPipelineReport; diagnostics: AssetDiagnostics };
  getAudio(): AudioState;
  getPhysics(): DiagnosticsPhysics;
  getProfiler(): ProfileSnapshot;
  getWasm(): WasmModuleState;
  getLogs(): { total: number; dropped: number; counts: Record<LogLevel, number> };
  getPlugins(): PluginSummary;
  getMemory(): MemoryInfo | null;
  getEnvironment(): DiagnosticsEnvironment;
};

const environment = (): DiagnosticsEnvironment => {
  const scope = typeof window === "undefined" ? null : window;
  return {
    userAgent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    language: typeof navigator === "undefined" ? "unknown" : navigator.language,
    platform: typeof navigator === "undefined" ? "unknown" : navigator.platform,
    devicePixelRatio: scope?.devicePixelRatio ?? 1,
    viewport: {
      width: scope?.innerWidth ?? 0,
      height: scope?.innerHeight ?? 0
    },
    hardwareConcurrency: typeof navigator === "undefined" ? null : navigator.hardwareConcurrency ?? null,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    secureContext: scope?.isSecureContext ?? false
  };
};

export class Diagnostics {
  private source: DiagnosticsSource;

  constructor(source: DiagnosticsSource) {
    this.source = source;
  }

  static createEnvironment(): DiagnosticsEnvironment {
    return environment();
  }

  report(): DiagnosticsReport {
    const assets = this.source.getAssets();
    const scene = this.source.getScene();
    const audio = this.source.getAudio();
    const profiler = this.source.getProfiler();
    const wasm = this.source.getWasm();
    const memory = this.source.getMemory();
    const logs = this.source.getLogs();
    const plugins = this.source.getPlugins();
    const report: DiagnosticsReport = {
      format: "b2d-diagnostics",
      version: 1,
      generatedAt: new Date().toISOString(),
      engine: {
        version: this.source.getVersion(),
        adapter: this.source.getAdapterName(),
        running: this.source.isRunning(),
        destroyed: this.source.isDestroyed()
      },
      config: this.source.getConfig(),
      time: this.source.getTime(),
      scene,
      assets: { ...assets.report, diagnostics: assets.diagnostics },
      audio,
      physics: this.source.getPhysics(),
      profiler,
      wasm,
      logs,
      plugins,
      memory,
      environment: this.source.getEnvironment(),
      findings: []
    };
    report.findings = this.collectFindings(report);
    return report;
  }

  toJSON(): string {
    return JSON.stringify(this.report(), null, 2);
  }

  copy(): Promise<boolean> {
    const text = this.toJSON();
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return Promise.resolve(false);
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }

  download(fileName?: string): boolean {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return false;
    const name = fileName ?? `b2d-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const blob = new Blob([this.toJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    }, 0);
    return true;
  }

  private collectFindings(report: DiagnosticsReport): DiagnosticsFinding[] {
    const findings: DiagnosticsFinding[] = [];
    const assetIssues = report.assets.diagnostics;

    if (assetIssues.failed.length > 0) {
      findings.push({
        code: "assets-failed",
        severity: "error",
        message: `${assetIssues.failed.length} asset(s) failed to load: ${assetIssues.failed.join(", ")}`
      });
    }
    if (assetIssues.missing.length > 0) {
      findings.push({
        code: "assets-missing",
        severity: "error",
        message: `${assetIssues.missing.length} asset reference(s) cannot be resolved: ${assetIssues.missing.join(", ")}`
      });
    }
    if (assetIssues.unused.length > 0) {
      findings.push({
        code: "assets-unused",
        severity: "warn",
        message: `${assetIssues.unused.length} registered asset(s) are not declared by any scene: ${assetIssues.unused.join(", ")}`
      });
    }
    if (assetIssues.unlicensed.length > 0) {
      findings.push({
        code: "assets-unlicensed",
        severity: "warn",
        message: `${assetIssues.unlicensed.length} asset(s) have no license metadata: ${assetIssues.unlicensed.join(", ")}`
      });
    }
    if (!report.audio.attached) {
      findings.push({ code: "audio-detached", severity: "warn", message: "Audio backend is not attached" });
    }
    if (report.audio.attached && !report.audio.unlocked) {
      findings.push({ code: "audio-locked", severity: "info", message: "Audio is waiting for a user gesture (autoplay policy)" });
    }
    if (report.audio.pending > 0) {
      findings.push({ code: "audio-pending", severity: "info", message: `${report.audio.pending} sound request(s) queued until unlock` });
    }
    if (report.wasm === "failed") {
      findings.push({ code: "wasm-failed", severity: "warn", message: "WASM module failed to load, TypeScript fallback in use" });
    }
    if (report.profiler.fps > 0 && report.profiler.fps < 45) {
      findings.push({
        code: "frame-rate-low",
        severity: "warn",
        message: `Average frame rate is ${report.profiler.fps.toFixed(1)} fps over the last ${report.profiler.samples} frames`
      });
    }
    if (report.memory && report.memory.limit > 0 && report.memory.used / report.memory.limit > 0.75) {
      findings.push({
        code: "memory-high",
        severity: "warn",
        message: `JS heap usage is above 75% of the limit (${Math.round((report.memory.used / report.memory.limit) * 100)}%)`
      });
    }
    if (!report.environment.secureContext && report.environment.online) {
      findings.push({
        code: "insecure-context",
        severity: "info",
        message: "Page is not a secure context; some APIs (clipboard, WebAssembly streaming) may be limited"
      });
    }
    if (report.scene.objects === 0 && report.engine.running) {
      findings.push({ code: "scene-empty", severity: "warn", message: "Active scene has no objects" });
    }
    if (report.logs.counts.error > 0) {
      findings.push({
        code: "logs-error",
        severity: "error",
        message: `${report.logs.counts.error} error entry/entries in the log buffer`
      });
    }
    return findings;
  }
}
