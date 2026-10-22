import { resolveEngineConfig } from "./EngineConfig";
import type { EngineConfig } from "./EngineConfig";
import { Time } from "./Time";
import { SceneManager } from "./SceneManager";
import { Scene } from "./Scene";
import { EventBus } from "../systems/EventBus";
import { Logger, LogLevel } from "../systems/Logger";
import { AssetManager } from "../systems/AssetManager";
import { InputManager } from "../systems/InputManager";
import { PhysicsManager } from "../systems/PhysicsManager";
import { CameraManager } from "../systems/CameraManager";
import { DebugOverlay } from "../systems/DebugOverlay";
import { Scheduler } from "../systems/Scheduler";
import { Timer } from "../systems/Timer";
import { Random } from "./Random";
import { AudioManager } from "../audio/AudioManager";
import type { AdapterFactory, RuntimeAdapter } from "./ports";
import { WasmBridge, WasmBridgeOptions } from "../wasm/WasmBridge";
import { Profiler } from "../debug/Profiler";
import { LogBuffer } from "../debug/LogBuffer";
import { LogPanel } from "../debug/LogPanel";
import { DebugViews } from "../debug/DebugViews";
import { Diagnostics } from "../debug/Diagnostics";
import type { DiagnosticsReport, DiagnosticsSource } from "../debug/Diagnostics";
import { readMemory } from "../systems/Memory";
import { ENGINE_VERSION } from "../version";
import { getStabilityReport } from "../stability";
import type { StabilityReport } from "../stability";
import { deprecationReport, deprecate, getDeprecations } from "../deprecation";
import type { DeprecationRecord } from "../deprecation";
import { PluginHost } from "../plugins/host";
import type { PluginDefinition } from "../plugins/types";
import { importTiledMap } from "../assets/TiledMap";

export type EngineOptions = Partial<EngineConfig> & {
  parent: string | HTMLElement;
  logLevel?: LogLevel;
  wasm?: WasmBridgeOptions;
  plugins?: readonly PluginDefinition[];
};

export class Engine {
  private config: EngineConfig;
  private time: Time;
  private events: EventBus;
  private logger: Logger;
  private assets: AssetManager;
  private input: InputManager;
  private physics: PhysicsManager;
  private camera: CameraManager;
  private scenes: SceneManager;
  private debugOverlay: DebugOverlay;
  private scheduler: Scheduler;
  private audio: AudioManager;
  private timer: Timer;
  private random: Random;
  private adapter: RuntimeAdapter;
  private wasm: WasmBridge;
  private profiler: Profiler;
  private logs: LogBuffer;
  private logPanel: LogPanel;
  private debugViews: DebugViews;
  private diagnostics: Diagnostics;
  private plugins: PluginHost;
  private running = false;
  private destroyed = false;

  constructor(options: EngineOptions, adapterFactory: AdapterFactory) {
    const { logLevel, wasm, plugins, ...cfg } = options;
    this.config = resolveEngineConfig(cfg as EngineConfig);
    this.time = new Time(this.config.maxDeltaTime);
    if (this.config.fixedStep) this.time.setFixedStep(this.config.fixedStep.hz, this.config.fixedStep.maxSteps);
    this.events = new EventBus();
    this.logger = new Logger("Engine", logLevel ?? (this.config.debug ? "debug" : "info"));
    this.assets = new AssetManager();
    this.input = new InputManager(this.config.inputMap);
    this.physics = new PhysicsManager();
    this.camera = new CameraManager();
    this.scenes = new SceneManager(this.logger, this.events);
    this.scheduler = new Scheduler();
    this.timer = new Timer(this.scheduler, "engine");
    this.random = new Random(this.config.seed);
    this.audio = new AudioManager();
    this.profiler = new Profiler(this.config.debug);
    this.logs = new LogBuffer(400);
    this.logger.addSink(this.logs.push);
    this.logPanel = new LogPanel(this.logs);
    this.debugOverlay = new DebugOverlay(this.config.debug);
    this.debugViews = new DebugViews(
      () => this.adapter.getRenderPort?.() ?? null,
      () => this.adapter.getPhysicsPort?.() ?? null
    );
    this.plugins = new PluginHost({
      engineVersion: ENGINE_VERSION,
      logger: this.logger,
      events: this.events,
      services: {
        scenes: {
          list: () => this.scenes.list(),
          activeId: () => this.scenes.getActiveSceneId()
        },
        assets: {
          ids: () => this.assets.getAll().map((descriptor) => descriptor.id),
          isLoaded: (id: string) => this.assets.isLoaded(id)
        }
      }
    });
    this.plugins.getImporters().register("engine", {
      id: "tiled",
      extensions: ["tmx"],
      import: (data: unknown) => importTiledMap(data as never)
    });
    for (const plugin of plugins ?? []) this.plugins.install(plugin);
    this.adapter = adapterFactory(this.config, {
      time: this.time,
      sceneManager: this.scenes,
      assets: this.assets,
      input: this.input,
      physics: this.physics,
      camera: this.camera,
      events: this.events,
      logger: this.logger,
      debugOverlay: this.debugOverlay,
      scheduler: this.scheduler,
      random: this.random,
      audio: this.audio,
      profiler: this.profiler,
      logPanel: this.logPanel,
      debugViews: this.debugViews,
      plugins: this.plugins
    });
    this.diagnostics = new Diagnostics(this.createDiagnosticsSource());
    this.audio.onUnlock((unlocked) => this.events.emit("audio:unlocked", { unlocked }));
    this.wasm = new WasmBridge(wasm);
    if (wasm?.wasmUrl) {
      this.wasm.load().catch((e) => this.logger.warn(`WASM failed to load: ${(e as Error).message}`));
    }
  }

  getConfig(): EngineConfig {
    return { ...this.config };
  }

  getTime(): Time {
    return this.time;
  }

  getTimer(): Timer {
    return this.timer;
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }

  getRandom(): Random {
    return this.random;
  }

  getEvents(): EventBus {
    return this.events;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getAssets(): AssetManager {
    return this.assets;
  }

  getAudio(): AudioManager {
    return this.audio;
  }

  getInput(): InputManager {
    return this.input;
  }

  getPhysics(): PhysicsManager {
    return this.physics;
  }

  getCamera(): CameraManager {
    return this.camera;
  }

  getScenes(): SceneManager {
    return this.scenes;
  }

  getWasm(): WasmBridge {
    return this.wasm;
  }

  getProfiler(): Profiler {
    return this.profiler;
  }

  getDebugOverlay(): DebugOverlay {
    return this.debugOverlay;
  }

  getLogs(): LogBuffer {
    return this.logs;
  }

  getLogPanel(): LogPanel {
    return this.logPanel;
  }

  getDebugViews(): DebugViews {
    return this.debugViews;
  }

  getDiagnostics(): Diagnostics {
    return this.diagnostics;
  }

  getDiagnosticsReport(): DiagnosticsReport {
    return this.diagnostics.report();
  }

  getStabilityReport(): StabilityReport {
    return getStabilityReport();
  }

  getDeprecations(): DeprecationRecord[] {
    return getDeprecations();
  }

  deprecationSummary() {
    return deprecationReport();
  }

  warnDeprecated(id: string): void {
    deprecate(id, (message) => this.logger.warn(message, { context: "deprecation", data: { id } }));
  }

  getPlugins(): PluginHost {
    return this.plugins;
  }

  installPlugin(plugin: PluginDefinition): PluginHost {
    this.plugins.install(plugin);
    return this.plugins;
  }

  getAdapter(): RuntimeAdapter {
    return this.adapter;
  }

  isRunning(): boolean {
    return this.running;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  registerScene(scene: Scene): this {
    if (this.destroyed) throw new Error("Engine is destroyed");
    this.scenes.register(scene);
    if (this.running) this.adapter.registerScene(scene);
    return this;
  }

  start(initialSceneId?: string, data?: unknown): this {
    if (this.destroyed) throw new Error("Engine is destroyed");
    if (this.running) return this;
    this.adapter.createGame();
    for (const id of this.scenes.list()) {
      const scene = this.scenes.get(id);
      if (scene) this.adapter.registerScene(scene);
    }
    this.running = true;
    this.plugins.activateAll().catch((error) => this.logger.error("Plugin activation failed", error));
    this.events.emit("engine:started", { config: this.config });
    if (initialSceneId) this.startScene(initialSceneId, data);
    this.logger.info(`Engine started with ${this.scenes.list().length} scenes`);
    return this;
  }

  startScene(id: string, data?: unknown): void {
    if (!this.running) throw new Error("Engine not running. Call start() first");
    const previous = this.scenes.getActiveSceneId();
    this.scenes.start(id, data);
    if (previous && previous !== id) this.adapter.stopScene(previous);
    this.adapter.startScene(id, data);
  }

  stopScene(id: string): void {
    this.scenes.stop(id);
    this.adapter.stopScene(id);
  }

  pause(): void {
    this.time.pause();
    this.audio.pauseAll();
    this.adapter.pause();
  }

  resume(): void {
    this.time.resume();
    this.audio.resumeAll();
    this.adapter.resume();
  }

  setTimeScale(scale: number): this {
    this.time.setTimeScale(scale);
    this.events.emit("engine:timeScale", { timeScale: this.time.timeScale });
    return this;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.adapter.destroy();
    this.events.emit("engine:stopped", {});
    this.logger.info("Engine stopped");
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.scenes.clear();
    this.audio.detach();
    this.assets.clear();
    this.scheduler.clear();
    this.events.clearAll();
    this.debugOverlay.destroy();
    this.logPanel.destroy();
    this.debugViews.clear();
    this.plugins.dispose().catch((error) => this.logger.error("Plugin teardown failed", error));
    this.destroyed = true;
    this.logger.info("Engine destroyed");
  }

  on<T>(event: string, handler: (p: T) => void): () => void {
    return this.events.on(event, handler);
  }

  setDebug(enabled: boolean): void {
    this.debugOverlay.setEnabled(enabled);
    this.logPanel.setVisible(enabled);
    this.profiler.setEnabled(enabled);
    this.logger.setLevel(enabled ? "debug" : "info");
    if (!enabled) this.debugViews.clear();
  }

  private createDiagnosticsSource(): DiagnosticsSource {
    return {
      getVersion: () => ENGINE_VERSION,
      getAdapterName: () => this.adapter.getName?.() ?? "RuntimeAdapter",
      isRunning: () => this.running,
      isDestroyed: () => this.destroyed,
      getConfig: () => this.getConfig(),
      getTime: () => this.time.toState(),
      getScene: () => {
        const scene = this.scenes.getActiveScene();
        return {
          id: scene?.id ?? null,
          objects: scene?.objectCount() ?? 0,
          groups: scene ? scene.getGroups() : [],
          animations: this.assets.animations().length,
          assetIds: scene ? [...scene.getDeclaredAssetIds()] : []
        };
      },
      getAssets: () => {
        const declared = this.scenes
          .list()
          .map((id) => this.scenes.get(id))
          .filter((scene): scene is Scene => Boolean(scene))
          .flatMap((scene) => [...scene.getDeclaredAssetIds()]);
        return { report: this.assets.report(), diagnostics: this.assets.diagnose({ usedIds: declared }) };
      },
      getAudio: () => this.audio.getState(),
      getPhysics: () => {
        const stats = this.physics.getStats();
        return {
          bodies: stats?.bodies ?? 0,
          colliders: stats?.colliders ?? 0,
          bounds: stats?.bounds ?? null
        };
      },
      getProfiler: () => this.profiler.snapshot(),
      getWasm: () => this.wasm.getState(),
      getPlugins: () => this.plugins.summary(),
      getLogs: () => this.logs.summary(),
      getMemory: () => readMemory(),
      getEnvironment: () => Diagnostics.createEnvironment()
    };
  }
}
