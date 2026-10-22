import Phaser from "phaser";
import { hexToNumber } from "../core/EngineConfig";
import type { EngineConfig } from "../core/EngineConfig";
import { Time } from "../core/Time";
import { SceneManager } from "../core/SceneManager";
import { AssetError, AssetManager } from "../systems/AssetManager";
import { InputManager } from "../systems/InputManager";
import { PhysicsManager } from "../systems/PhysicsManager";
import { CameraManager } from "../systems/CameraManager";
import { EventBus } from "../systems/EventBus";
import { Logger } from "../systems/Logger";
import { DebugOverlay } from "../systems/DebugOverlay";
import { LogPanel } from "../debug/LogPanel";
import type { DebugViews } from "../debug/DebugViews";
import type { PluginHost } from "../plugins/host";
import type { Profiler } from "../debug/Profiler";
import { Scene } from "../core/Scene";
import type { AdapterDeps, RenderPort } from "../core/ports";
import type { Scheduler } from "../systems/Scheduler";
import type { Random } from "../core/Random";
import { PhaserRenderLayer } from "./PhaserRenderLayer";
import { PhaserPhysicsBackend } from "./PhaserPhysicsBackend";
import { PhaserCameraBackend } from "./PhaserCameraBackend";
import { PhaserInputBackend } from "./PhaserInputBackend";
import { PhaserAssetBackend } from "./PhaserAssetBackend";
import { createRenderPort } from "./createRenderPort";
import { PhaserAudioBackend } from "./PhaserAudioBackend";
import type { AudioManager } from "../audio/AudioManager";

function resolveParent(config: EngineConfig): HTMLElement {
  if (typeof config.parent === "string") {
    const element = document.getElementById(config.parent);
    if (!element) throw new Error(`Parent element with id "${config.parent}" not found`);
    return element;
  }
  return config.parent;
}

function scaleModeToPhaser(mode: EngineConfig["scaleMode"]): Phaser.Scale.ScaleModes {
  switch (mode) {
    case "fit":
      return Phaser.Scale.FIT;
    case "fill":
      return Phaser.Scale.ENVELOP;
    case "fixed":
      return Phaser.Scale.NONE;
    case "expand":
      return Phaser.Scale.RESIZE;
    default:
      return Phaser.Scale.FIT;
  }
}

type SceneDeps = {
  assets: AssetManager;
  inputMgr: InputManager;
  physicsMgr: PhysicsManager;
  cameraMgr: CameraManager;
  events: EventBus;
  logger: Logger;
  timeMgr: Time;
  debugOverlay: DebugOverlay;
  scheduler: Scheduler;
  random: Random;
  audio: AudioManager;
  profiler: Profiler;
  logPanel: LogPanel;
  debugViews: DebugViews;
  plugins: PluginHost;
};

class InternalPhaserScene extends Phaser.Scene {
  private engineScene: Scene;
  private deps: SceneDeps;
  private renderLayer: PhaserRenderLayer | null = null;
  private physicsBackend: PhaserPhysicsBackend | null = null;
  private cameraBackend: PhaserCameraBackend | null = null;
  private inputBackend: PhaserInputBackend | null = null;
  private assetBackend: PhaserAssetBackend | null = null;
  private renderPort: RenderPort | null = null;
  private sceneData: unknown = null;

  constructor(engineScene: Scene, deps: SceneDeps) {
    super({ key: engineScene.id });
    this.engineScene = engineScene;
    this.deps = deps;
  }

  init(data?: unknown): void {
    this.sceneData = data ?? null;
    this.renderLayer = new PhaserRenderLayer(this);
    this.physicsBackend = new PhaserPhysicsBackend(this, (object) => this.renderLayer?.getDisplay(object) ?? null);
    this.cameraBackend = new PhaserCameraBackend(this, (object) => this.renderLayer?.getDisplay(object) ?? null);
    this.inputBackend = new PhaserInputBackend(this);
    this.assetBackend = new PhaserAssetBackend(this, {
      onLoaded: (id: string) => this.deps.assets.markLoaded(id),
      onError: (error: AssetError) => this.deps.assets.reportError(error)
    });
    this.renderPort = createRenderPort(this.renderLayer, this.physicsBackend);
    this.engineScene.initInternal(
      {
        assets: this.deps.assets,
        input: this.deps.inputMgr,
        physics: this.deps.physicsMgr,
        camera: this.deps.cameraMgr,
        events: this.deps.events,
        logger: this.deps.logger.child(this.engineScene.id),
        time: this.deps.timeMgr,
        scheduler: this.deps.scheduler,
        random: this.deps.random,
        audio: this.deps.audio,
        width: this.scale.gameSize.width,
        height: this.scale.gameSize.height,
        profiler: this.deps.profiler
      },
      { render: this.renderPort },
      this.sceneData
    );
  }

  preload(): void {
    const assets = this.deps.assets;
    if (this.assetBackend) assets.attachBackend(this.assetBackend);
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      const total = assets.count();
      assets.reportProgress(Math.round(progress * total), total);
    });
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => assets.markLoaded(String(key)));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      assets.reportError(new AssetError(`Failed to load asset "${file.key}" from "${file.src}"`, String(file.key), String(file.src)));
    });
    this.load.on(Phaser.Loader.Events.COMPLETE, () => this.registerAnimations());
    this.engineScene.preload?.();
    assets.queue();
  }

  reconcileAssets(): void {
    const assets = this.deps.assets;
    const backend = this.assetBackend;
    for (const descriptor of assets.getAll()) {
      if (assets.status(descriptor.id) === "ready") continue;
      const present = backend?.has ? backend.has(descriptor.id) : backend?.hasTexture(descriptor.id) ?? false;
      if (present) assets.markLoaded(descriptor.id);
    }
  }

  registerAnimations(): void {
    if (!this.assetBackend) return;
    const entries = this.deps.assets.animations().map(({ assetId, key, animation }) => ({
      key,
      textureId: assetId,
      frames: animation.frames,
      frameRate: animation.frameRate,
      repeat: animation.repeat,
      yoyo: animation.yoyo
    }));
    this.assetBackend.registerAnimations(entries);
  }

  create(): void {
    this.deps.inputMgr.attach(this.inputBackend!);
    this.deps.physicsMgr.attach(this.physicsBackend!);
    this.deps.cameraMgr.attach(this.cameraBackend!);
    this.deps.debugOverlay.setActiveScene(this.engineScene.id);
    this.registerAnimations();
    this.reconcileAssets();
    const result = this.engineScene.internalCreate();
    if (result instanceof Promise) {
      result.catch((error) => this.deps.logger.error(`Error creating scene "${this.engineScene.id}"`, error));
    }
    this.deps.debugViews.sync();
    this.deps.events.emit("scene:created", { sceneId: this.engineScene.id });
  }

  getRenderPort(): RenderPort | null {
    return this.renderPort;
  }

  getPhysicsPort(): PhaserPhysicsBackend | null {
    return this.physicsBackend;
  }

  drawDebug(): void {
    this.renderLayer?.drawDebug();
  }

  private publishDebugStats(delta: number): void {
    const overlay = this.deps.debugOverlay;
    const profiler = this.deps.profiler;
    const timeMgr = this.deps.timeMgr;
    const physicsStats = this.deps.physicsMgr.getStats();
    const audio = this.deps.audio;
    const profile = profiler.isEnabled()
      ? Object.entries(profiler.getLastFrame())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, ms]) => ({ name: name.replace("engine.", "").replace("scene.", ""), ms }))
      : [];
    overlay.setStats({
      realDeltaTime: timeMgr.rawDeltaTime * 1000,
      deltaTime: delta,
      objects: this.engineScene.objectCount(),
      bodies: physicsStats?.bodies ?? 0,
      colliders: physicsStats?.colliders ?? 0,
      timeScale: timeMgr.timeScale,
      paused: timeMgr.isPaused,
      audio: `${audio.isMuted() ? "muted" : "on"} · ${audio.getHandleCount()} h · ${audio.getPendingCount()} q`,
      profile
    });
    overlay.update(timeMgr.realElapsed * 1000);
    this.deps.logPanel.update(timeMgr.realElapsed * 1000);
  }

  refreshAssetUsage(): string[] {
    return [...this.engineScene.getDeclaredAssetIds()];
  }

  update(time: number, delta: number): void {
    const timeMgr = this.deps.timeMgr;
    const profiler = this.deps.profiler;
    profiler.startFrame();
    profiler.begin("engine.time");
    timeMgr.update(delta);
    profiler.end("engine.time");
    if (timeMgr.isClamped) {
      this.deps.events.emit("engine:frameClamped", { rawDeltaTime: timeMgr.rawDeltaTime, deltaTime: timeMgr.deltaTime });
    }
    profiler.begin("engine.scheduler");
    this.deps.scheduler.update(timeMgr.deltaTime);
    profiler.end("engine.scheduler");
    profiler.begin("engine.input");
    this.deps.inputMgr.update();
    profiler.end("engine.input");
    profiler.begin("engine.fixed");
    let steps = timeMgr.pendingFixedSteps;
    while (steps > 0 && timeMgr.consumeFixedStep()) {
      this.engineScene.internalFixedUpdate(timeMgr.fixedDelta);
      steps -= 1;
    }
    profiler.end("engine.fixed");
    profiler.begin("engine.scene");
    this.engineScene.internalUpdate(timeMgr.deltaTime);
    profiler.end("engine.scene");
    profiler.begin("engine.plugins");
    this.deps.plugins.update(timeMgr.deltaTime);
    profiler.end("engine.plugins");
    this.drawDebug();
    this.deps.events.emit("engine:update", { deltaTime: timeMgr.deltaTime, elapsed: timeMgr.elapsed });
    this.publishDebugStats(delta);
    profiler.endFrame();
  }

  shutdown(): void {
    this.engineScene.internalShutdown();
    this.deps.inputMgr.detach();
    this.deps.physicsMgr.detach();
    this.deps.cameraMgr.detach();
    this.deps.assets.detachBackend();
    this.renderLayer = null;
    this.physicsBackend = null;
    this.cameraBackend = null;
    this.inputBackend = null;
    this.renderPort = null;
    this.deps.events.emit("scene:shutdown", { sceneId: this.engineScene.id });
  }
}

export class PhaserAdapter {
  private config: EngineConfig;
  private time: Time;
  private game: Phaser.Game | null = null;
  private parentEl: HTMLElement | null = null;
  private sceneRefs = new Map<string, Scene>();
  private ready = false;
  private deferredSceneId: string | null = null;
  private deferredData: unknown = null;
  private resizeObserver: ResizeObserver | null = null;
  private visibilityHandler: (() => void) | null = null;
  private sceneManager: SceneManager;
  private assets: AssetManager;
  private input: InputManager;
  private physics: PhysicsManager;
  private camera: CameraManager;
  private events: EventBus;
  private logger: Logger;
  private debugOverlay: DebugOverlay;
  private scheduler: Scheduler;
  private random: Random;
  private audio: AudioManager;
  private profiler: Profiler;
  private logPanel: LogPanel;
  private debugViews: DebugViews;
  private plugins: PluginHost;
  private audioBackend: PhaserAudioBackend | null = null;
  private unlockHandler: (() => void) | null = null;
  private destroyed = false;

  constructor(config: EngineConfig, deps: AdapterDeps) {
    this.config = config;
    this.time = deps.time;
    this.sceneManager = deps.sceneManager;
    this.assets = deps.assets;
    this.input = deps.input;
    this.physics = deps.physics;
    this.camera = deps.camera;
    this.events = deps.events;
    this.logger = deps.logger;
    this.debugOverlay = deps.debugOverlay;
    this.scheduler = deps.scheduler;
    this.random = deps.random;
    this.audio = deps.audio;
    this.profiler = deps.profiler;
    this.logPanel = deps.logPanel;
    this.debugViews = deps.debugViews;
    this.plugins = deps.plugins;
  }

  createGame(): Phaser.Game {
    if (this.game) return this.game;
    this.parentEl = resolveParent(this.config);
    const phaserConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: this.parentEl,
      width: this.config.width,
      height: this.config.height,
      backgroundColor: hexToNumber(this.config.backgroundColor),
      scale: {
        mode: scaleModeToPhaser(this.config.scaleMode),
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: this.config.width,
        height: this.config.height,
        min: this.config.minWidth && this.config.minHeight ? { width: this.config.minWidth, height: this.config.minHeight } : undefined,
        max: this.config.maxWidth && this.config.maxHeight ? { width: this.config.maxWidth, height: this.config.maxHeight } : undefined
      },
      physics: this.config.physics.enabled
        ? {
            default: "arcade",
            arcade: {
              gravity: this.config.physics.gravity,
              debug: this.config.physics.debug
            }
          }
        : undefined,
      render: { antialias: true, pixelArt: false }
    };
    this.game = new Phaser.Game(phaserConfig);
    this.game.events.once(Phaser.Core.Events.READY, () => this.handleReady());
    this.setupAudio();
    this.setupResize();
    this.setupVisibility();
    this.debugOverlay.mount(this.parentEl);
    this.logPanel.mount(this.parentEl);
    this.events.emit("engine:started", { config: this.config });
    this.logger.info("Phaser game created");
    return this.game;
  }

  registerScene(scene: Scene): void {
    if (!this.game) throw new Error("Game not created yet. Call createGame first or use Engine.start()");
    if (this.sceneRefs.has(scene.id)) return;
    this.sceneRefs.set(scene.id, scene);
    if (this.ready) this.addPhaserScene(scene.id, false);
  }

  startScene(id: string, data?: unknown): void {
    if (!this.game) throw new Error("Game not created");
    if (!this.sceneRefs.has(id)) throw new Error(`Scene "${id}" is not registered`);
    this.debugOverlay.setActiveScene(id);
    if (!this.ready) {
      this.deferredSceneId = id;
      this.deferredData = data ?? null;
      return;
    }
    this.startPhaserScene(id, data);
  }

  stopScene(id: string): void {
    if (!this.game) return;
    const scene = this.game.scene.getScene(id);
    if (scene) this.game.scene.stop(id);
  }

  getGame(): Phaser.Game | null {
    return this.game;
  }

  getName(): string {
    return "PhaserAdapter";
  }

  getRenderPort(): RenderPort | null {
    const scene = this.activeInternalScene();
    return scene?.getRenderPort() ?? null;
  }

  getPhysicsPort(): PhaserPhysicsBackend | null {
    const scene = this.activeInternalScene();
    return scene?.getPhysicsPort() ?? null;
  }

  private activeInternalScene(): InternalPhaserScene | null {
    if (!this.game) return null;
    const id = this.sceneManager.getActiveSceneId();
    if (!id) return null;
    const scene = this.game.scene.getScene(id);
    return scene instanceof InternalPhaserScene ? scene : null;
  }

  isRunning(): boolean {
    return this.game !== null && !this.destroyed;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.debugOverlay.destroy();
    if (this.resizeObserver && this.parentEl) {
      this.resizeObserver.unobserve(this.parentEl);
      this.resizeObserver.disconnect();
    }
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
    if (this.unlockHandler) {
      window.removeEventListener("pointerdown", this.unlockHandler);
      window.removeEventListener("keydown", this.unlockHandler);
    }
    this.audioBackend?.destroy();
    this.audio.detach();
    if (this.game) {
      this.game.destroy(true, false);
      this.game = null;
    }
    this.sceneRefs.clear();
    this.ready = false;
    this.deferredSceneId = null;
    this.deferredData = null;
    this.events.emit("engine:stopped", {});
    this.logger.info("Phaser game destroyed");
  }

  private handleReady(): void {
    if (!this.game) return;
    this.ready = true;
    const deferred = this.deferredSceneId;
    this.deferredSceneId = null;
    for (const id of this.sceneRefs.keys()) this.addPhaserScene(id, id === deferred);
  }

  private addPhaserScene(id: string, autoStart: boolean): void {
    if (!this.game) return;
    const engineScene = this.sceneRefs.get(id);
    if (!engineScene || this.game.scene.getScene(id)) return;
    (this.game.scene as unknown as { add: (key: string, scene: unknown, auto: boolean) => void }).add(
      id,
      this.createInternalScene(engineScene),
      autoStart
    );
  }

  private startPhaserScene(id: string, data?: unknown): void {
    if (!this.game) return;
    const existing = this.game.scene.getScene(id);
    if (existing) {
      this.game.scene.start(id, data as object | undefined);
      return;
    }
    this.addPhaserScene(id, true);
  }

  private createInternalScene(scene: Scene): InternalPhaserScene {
    return new InternalPhaserScene(scene, {
      assets: this.assets,
      inputMgr: this.input,
      physicsMgr: this.physics,
      cameraMgr: this.camera,
      events: this.events,
      logger: this.logger,
      timeMgr: this.time,
      debugOverlay: this.debugOverlay,
      scheduler: this.scheduler,
      random: this.random,
      audio: this.audio,
      profiler: this.profiler,
      logPanel: this.logPanel,
      debugViews: this.debugViews,
      plugins: this.plugins
    });
  }

  private setupAudio(): void {
    if (!this.game) return;
    this.audioBackend = new PhaserAudioBackend(this.game);
    this.audio.attach(this.audioBackend);
    const unlock = (): void => {
      this.audio.unlock();
    };
    this.unlockHandler = unlock;
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  private isBooted(): boolean {
    return this.game !== null && this.game.isBooted && Boolean(this.game.scale?.canvas);
  }

  private setupResize(): void {
    if (!this.parentEl) return;
    const onResize = (): void => {
      if (!this.isBooted() || !this.game) return;
      this.game.scale.refresh();
      this.events.emit("engine:resize", { width: this.game.scale.gameSize.width, height: this.game.scale.gameSize.height });
    };
    window.addEventListener("resize", onResize);
    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.parentEl);
  }

  private setupVisibility(): void {
    if (!this.config.pauseOnHidden) return;
    const handler = (): void => {
      if (document.hidden) {
        this.time.pause();
        this.audio.pauseAll();
        this.events.emit("engine:pause", {});
        this.sleepLoop();
      } else {
        this.time.resume();
        this.audio.resumeAll();
        this.events.emit("engine:resume", {});
        this.wakeLoop();
      }
    };
    document.addEventListener("visibilitychange", handler);
    this.visibilityHandler = handler;
  }

  pause(): void {
    this.time.pause();
    this.audio.pauseAll();
    this.sleepLoop();
    this.events.emit("engine:pause", {});
  }

  resume(): void {
    this.time.resume();
    this.audio.resumeAll();
    this.wakeLoop();
    this.events.emit("engine:resume", {});
  }

  private sleepLoop(): void {
    if (!this.game?.isBooted) return;
    this.game.loop.sleep();
  }

  private wakeLoop(): void {
    if (!this.game?.isBooted) return;
    this.game.loop.wake();
  }
}
