import type { GameObject } from "./GameObject";
import type { AssetDescriptor } from "../assets/AssetManifest";
import type { PointerState } from "../systems/InputManager";
import type { EngineConfig } from "./EngineConfig";
import type { Scene } from "./Scene";
import type { Time } from "./Time";
import type { SceneManager } from "./SceneManager";
import type { AssetManager } from "../systems/AssetManager";
import type { InputManager } from "../systems/InputManager";
import type { PhysicsManager } from "../systems/PhysicsManager";
import type { CameraManager } from "../systems/CameraManager";
import type { EventBus } from "../systems/EventBus";
import type { Logger } from "../systems/Logger";
import type { DebugOverlay } from "../systems/DebugOverlay";
import type { Scheduler } from "../systems/Scheduler";
import type { Random } from "./Random";
import type { AudioManager } from "../audio/AudioManager";
import type { Profiler } from "../debug/Profiler";
import type { LogPanel } from "../debug/LogPanel";
import type { DebugViews } from "../debug/DebugViews";
import type { PluginHost } from "../plugins/host";

export type AdapterDeps = {
  time: Time;
  sceneManager: SceneManager;
  assets: AssetManager;
  input: InputManager;
  physics: PhysicsManager;
  camera: CameraManager;
  events: EventBus;
  logger: Logger;
  debugOverlay: DebugOverlay;
  scheduler: Scheduler;
  random: Random;
  audio: AudioManager;
  profiler: Profiler;
  logPanel: LogPanel;
  debugViews: DebugViews;
  plugins: PluginHost;
};

export interface RuntimeAdapter {
  createGame(): void;
  registerScene(scene: Scene): void;
  startScene(id: string, data?: unknown): void;
  stopScene(id: string): void;
  pause(): void;
  resume(): void;
  isRunning(): boolean;
  destroy(): void;
  getName?(): string;
  getRenderPort?(): RenderPort | null;
  getPhysicsPort?(): PhysicsPort | null;
}

export type AdapterFactory = (config: EngineConfig, deps: AdapterDeps) => RuntimeAdapter;

export type Vec2 = { x: number; y: number };

export type ColliderHandle = {
  readonly active: boolean;
  destroy(): void;
};

export const inactiveCollider: ColliderHandle = {
  active: false,
  destroy(): void {
    return undefined;
  }
};

export type AnimationPlayOptions = {
  restart?: boolean;
  frame?: number | string;
  rate?: number;
};

export type AnimationState = {
  key: string | null;
  frame: number;
  isPlaying: boolean;
  isPaused: boolean;
};

export type DebugLayerState = {
  grid: boolean;
  gridSize: number;
  axes: boolean;
  cameraBounds: boolean;
};

export interface RenderPort {
  create(object: GameObject): void;
  destroy(object: GameObject): void;
  sync(objects: readonly GameObject[]): void;
  clear(): void;
  playAnimation?(object: GameObject, key: string, options?: AnimationPlayOptions): boolean;
  stopAnimation?(object: GameObject, key?: string): void;
  pauseAnimation?(object: GameObject, paused: boolean): void;
  setFrame?(object: GameObject, frame: number | string): boolean;
  getAnimationState?(object: GameObject): AnimationState | null;
  setDebugLayer?(state: DebugLayerState): void;
}

export type ColliderPair = GameObject | readonly GameObject[];
export type CollisionHandler = (a: GameObject, b: GameObject) => void;

export type PhysicsStats = {
  bodies: number;
  colliders: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
};

export interface PhysicsPort {
  setWorldBounds(x: number, y: number, width: number, height: number): void;
  attachBody(object: GameObject): void;
  detachBody(object: GameObject): void;
  readPosition(object: GameObject): Vec2 | null;
  setVelocity(object: GameObject, vx: number, vy: number): void;
  getVelocity(object: GameObject): Vec2;
  setImmovable(object: GameObject, value: boolean): void;
  setCollideWorldBounds(object: GameObject, value: boolean): void;
  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle;
  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle;
  setDebugDraw?(enabled: boolean): void;
  getStats?(): PhysicsStats;
  clear(): void;
}

export interface CameraPort {
  setBounds(x: number, y: number, width: number, height: number): void;
  setZoom(zoom: number): void;
  getZoom(): number;
  setBackgroundColor(color: string | number): void;
  follow(object: GameObject | null, lerpX?: number, lerpY?: number): void;
  stopFollow(): void;
  getCenter(): Vec2;
  worldToScreen(x: number, y: number): Vec2;
  shake(duration?: number, intensity?: number): void;
  fadeIn(duration?: number, red?: number, green?: number, blue?: number): void;
  fadeOut?(duration?: number, red?: number, green?: number, blue?: number): void;
  flash?(duration?: number, red?: number, green?: number, blue?: number): void;
  resetEffects?(): void;
}

export type PointerPatch = Partial<PointerState>;

export interface InputPort {
  bindKeys(codes: readonly string[]): void;
  isKeyDown(code: string): boolean;
  onPointer(handler: (patch: PointerPatch) => void): () => void;
  onBlur(handler: () => void): () => void;
  detach(): void;
}

export type AudioPlaybackOptions = {
  key: string;
  volume: number;
  loop: boolean;
  rate: number;
};

export interface AudioPort {
  play(options: AudioPlaybackOptions): string | null;
  stop(id: string): void;
  setVolume(id: string, volume: number): void;
  pauseAll?(): void;
  resumeAll?(): void;
  stopAll?(): void;
  isUnlocked(): boolean;
  unlock(): boolean;
  destroy?(): void;
}

export interface AssetBackend {
  queue(descriptors: readonly AssetDescriptor[]): void;
  unload(id: string): void;
  hasTexture(id: string): boolean;
  has?(id: string): boolean;
  cancel?(): boolean;
  retry?(descriptors: readonly AssetDescriptor[]): void;
  sizeOf?(id: string): number | null;
}
