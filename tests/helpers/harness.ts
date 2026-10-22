import { Scene, type SceneContext, type ScenePorts } from "../../packages/engine/src/core/Scene";
import type { GameObject } from "../../packages/engine/src/core/GameObject";
import { AssetManager } from "../../packages/engine/src/systems/AssetManager";
import { CameraManager } from "../../packages/engine/src/systems/CameraManager";
import { EventBus } from "../../packages/engine/src/systems/EventBus";
import { InputManager } from "../../packages/engine/src/systems/InputManager";
import { Logger } from "../../packages/engine/src/systems/Logger";
import { PhysicsManager } from "../../packages/engine/src/systems/PhysicsManager";
import { Time } from "../../packages/engine/src/core/Time";
import { Scheduler } from "../../packages/engine/src/systems/Scheduler";
import { Random } from "../../packages/engine/src/core/Random";
import { defaultInputMap } from "../../packages/engine/src/core/EngineConfig";
import { AudioManager } from "../../packages/engine/src/audio/AudioManager";
import type { Profiler } from "../../packages/engine/src/debug/Profiler";
import type {
  DebugLayerState,
  PhysicsStats,
  AnimationPlayOptions,
  AnimationState,
  AssetBackend,
  AudioPlaybackOptions,
  AudioPort,
  CameraPort,
  ColliderHandle,
  ColliderPair,
  CollisionHandler,
  InputPort,
  PhysicsPort,
  PointerPatch,
  RenderPort,
  Vec2
} from "../../packages/engine/src/core/ports";

export type AnimationCall =
  | { kind: "play"; object: GameObject; key: string; options?: AnimationPlayOptions }
  | { kind: "stop"; object: GameObject; key?: string }
  | { kind: "pause"; object: GameObject; paused: boolean }
  | { kind: "frame"; object: GameObject; frame: number | string };

export class FakeRenderPort implements RenderPort {
  created: GameObject[] = [];
  destroyed: GameObject[] = [];
  synced: GameObject[] = [];
  cleared = 0;
  animations: AnimationCall[] = [];
  knownAnimations = new Set<string>(["hero:walk"]);
  debugLayer: DebugLayerState | null = null;
  debugLayerCalls = 0;
  animationState = new Map<GameObject, AnimationState>();

  playAnimation(object: GameObject, key: string, options?: AnimationPlayOptions): boolean {
    this.animations.push({ kind: "play", object, key, options });
    if (!this.knownAnimations.has(key)) return false;
    this.animationState.set(object, { key, frame: 0, isPlaying: true, isPaused: false });
    return true;
  }

  stopAnimation(object: GameObject, key?: string): void {
    this.animations.push({ kind: "stop", object, key });
    this.animationState.delete(object);
  }

  pauseAnimation(object: GameObject, paused: boolean): void {
    this.animations.push({ kind: "pause", object, paused });
    const state = this.animationState.get(object);
    if (state) this.animationState.set(object, { ...state, isPlaying: !paused, isPaused: paused });
  }

  setFrame(object: GameObject, frame: number | string): boolean {
    this.animations.push({ kind: "frame", object, frame });
    return true;
  }

  getAnimationState(object: GameObject): AnimationState | null {
    return this.animationState.get(object) ?? null;
  }

  setDebugLayer(state: DebugLayerState): void {
    this.debugLayer = state;
    this.debugLayerCalls += 1;
  }

  create(object: GameObject): void {
    this.created.push(object);
  }

  destroy(object: GameObject): void {
    this.destroyed.push(object);
  }

  sync(objects: readonly GameObject[]): void {
    this.synced.push(...objects);
  }

  clear(): void {
    this.cleared += 1;
  }
}

export type ColliderRecord = { kind: "collider" | "overlap"; a: ColliderPair; b: ColliderPair; handler?: CollisionHandler; destroyed: boolean };

export class FakePhysicsPort implements PhysicsPort {
  bounds: { x: number; y: number; width: number; height: number } | null = null;
  bodies = new Set<GameObject>();
  velocities = new Map<GameObject, Vec2>();
  positions = new Map<GameObject, Vec2>();
  colliders: ColliderRecord[] = [];
  debugDraw: boolean | null = null;

  setDebugDraw(enabled: boolean): void {
    this.debugDraw = enabled;
  }

  getStats(): PhysicsStats {
    return { bodies: this.bodies.size, colliders: this.colliders.length, bounds: this.bounds };
  }

  setWorldBounds(x: number, y: number, width: number, height: number): void {
    this.bounds = { x, y, width, height };
  }

  attachBody(object: GameObject): void {
    this.bodies.add(object);
  }

  detachBody(object: GameObject): void {
    this.bodies.delete(object);
  }

  readPosition(object: GameObject): Vec2 | null {
    return this.positions.get(object) ?? null;
  }

  setVelocity(object: GameObject, vx: number, vy: number): void {
    this.velocities.set(object, { x: vx, y: vy });
  }

  getVelocity(object: GameObject): Vec2 {
    return this.velocities.get(object) ?? { x: 0, y: 0 };
  }

  setImmovable(): void {
    return undefined;
  }

  setCollideWorldBounds(): void {
    return undefined;
  }

  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    return this.track("collider", a, b, handler);
  }

  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle {
    return this.track("overlap", a, b, handler);
  }

  clear(): void {
    this.colliders = [];
    this.bodies.clear();
    this.velocities.clear();
    this.positions.clear();
  }

  private track(kind: "collider" | "overlap", a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    const record: ColliderRecord = { kind, a, b, handler, destroyed: false };
    this.colliders.push(record);
    return {
      active: true,
      destroy: () => {
        record.destroyed = true;
      }
    };
  }
}

export class FakeCameraPort implements CameraPort {
  followTarget: GameObject | null = null;
  zoom = 1;
  bounds: { x: number; y: number; width: number; height: number } | null = null;

  setBounds(x: number, y: number, width: number, height: number): void {
    this.bounds = { x, y, width, height };
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  getZoom(): number {
    return this.zoom;
  }

  setBackgroundColor(): void {
    return undefined;
  }

  follow(object: GameObject | null): void {
    this.followTarget = object;
  }

  stopFollow(): void {
    this.followTarget = null;
  }

  getCenter(): Vec2 {
    return { x: 0, y: 0 };
  }

  worldToScreen(x: number, y: number): Vec2 {
    return { x, y };
  }

  shakes: Array<{ duration?: number; intensity?: number }> = [];
  flashes: Array<{ duration?: number; red?: number; green?: number; blue?: number }> = [];
  fades: Array<{ direction: "in" | "out"; duration?: number }> = [];
  resets = 0;

  shake(duration?: number, intensity?: number): void {
    this.shakes.push({ duration, intensity });
  }

  fadeIn(duration?: number): void {
    this.fades.push({ direction: "in", duration });
  }

  fadeOut(duration?: number): void {
    this.fades.push({ direction: "out", duration });
  }

  flash(duration?: number, red?: number, green?: number, blue?: number): void {
    this.flashes.push({ duration, red, green, blue });
  }

  resetEffects(): void {
    this.resets += 1;
  }
}

export type FakePlayback = AudioPlaybackOptions & { id: string; volume: number; stopped: boolean; paused: boolean };

export class FakeAudioPort implements AudioPort {
  unlocked = false;
  plays: FakePlayback[] = [];
  unlockedCalls = 0;
  pauseCalls = 0;
  resumeCalls = 0;
  stopAllCalls = 0;
  destroyed = false;
  failNext = false;
  private counter = 0;

  play(options: AudioPlaybackOptions): string | null {
    if (this.failNext) {
      this.failNext = false;
      return null;
    }
    const id = `play-${this.counter++}`;
    this.plays.push({ ...options, id, volume: options.volume, stopped: false, paused: false });
    return id;
  }

  stop(id: string): void {
    const playback = this.plays.find((entry) => entry.id === id);
    if (playback) playback.stopped = true;
  }

  setVolume(id: string, volume: number): void {
    const playback = this.plays.find((entry) => entry.id === id);
    if (playback) playback.volume = volume;
  }

  pauseAll(): void {
    this.pauseCalls += 1;
    for (const playback of this.plays) playback.paused = true;
  }

  resumeAll(): void {
    this.resumeCalls += 1;
    for (const playback of this.plays) playback.paused = false;
  }

  stopAll(): void {
    this.stopAllCalls += 1;
    for (const playback of this.plays) playback.stopped = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): boolean {
    this.unlockedCalls += 1;
    this.unlocked = true;
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopAll();
  }

  get active(): FakePlayback[] {
    return this.plays.filter((entry) => !entry.stopped);
  }
}

export class FakeInputPort implements InputPort {
  down = new Set<string>();
  bound: string[] = [];
  pointerHandlers: Array<(patch: PointerPatch) => void> = [];
  blurHandlers: Array<() => void> = [];

  bindKeys(codes: readonly string[]): void {
    this.bound = [...codes];
  }

  isKeyDown(code: string): boolean {
    return this.down.has(code);
  }

  onPointer(handler: (patch: PointerPatch) => void): () => void {
    this.pointerHandlers.push(handler);
    return () => {
      this.pointerHandlers = this.pointerHandlers.filter((entry) => entry !== handler);
    };
  }

  onBlur(handler: () => void): () => void {
    this.blurHandlers.push(handler);
    return () => {
      this.blurHandlers = this.blurHandlers.filter((entry) => entry !== handler);
    };
  }

  detach(): void {
    this.pointerHandlers = [];
    this.blurHandlers = [];
  }

  press(code: string): void {
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  movePointer(patch: PointerPatch): void {
    for (const handler of this.pointerHandlers) handler(patch);
  }
}

export class FakeAssetBackend implements AssetBackend {
  queued: string[] = [];
  textures = new Set<string>();
  canCancel = true;
  cancelCalls = 0;
  sizes = new Map<string, number>();

  queue(descriptors: readonly { id: string }[]): void {
    for (const descriptor of descriptors) this.queued.push(descriptor.id);
  }

  retry(descriptors: readonly { id: string }[]): void {
    this.queue(descriptors);
  }

  cancel(): boolean {
    this.cancelCalls += 1;
    return this.canCancel;
  }

  unload(id: string): void {
    this.textures.delete(id);
  }

  hasTexture(id: string): boolean {
    return this.textures.has(id);
  }

  sizeOf(id: string): number | null {
    return this.sizes.get(id) ?? null;
  }
}

export type Harness = {
  scene: Scene;
  render: FakeRenderPort;
  physics: FakePhysicsPort;
  camera: FakeCameraPort;
  input: FakeInputPort;
  assets: FakeAssetBackend;
  events: EventBus;
  managerInput: InputManager;
  managerPhysics: PhysicsManager;
  managerCamera: CameraManager;
  managerAssets: AssetManager;
  managerAudio: AudioManager;
  audio: FakeAudioPort;
  scheduler: Scheduler;
  ctx: SceneContext;
  step: (deltaTime?: number, frames?: number) => void;
};

export type HarnessOptions = {
  profiler?: Profiler;
};

export const createHarness = (scene: Scene, options: HarnessOptions = {}): Harness => {
  const events = new EventBus();
  const logger = new Logger("test", "error");
  const managerAssets = new AssetManager();
  const assets = new FakeAssetBackend();
  managerAssets.attachBackend(assets);
  const managerInput = new InputManager(defaultInputMap);
  const input = new FakeInputPort();
  managerInput.attach(input);
  const managerPhysics = new PhysicsManager();
  const physics = new FakePhysicsPort();
  managerPhysics.attach(physics);
  const managerCamera = new CameraManager();
  const camera = new FakeCameraPort();
  managerCamera.attach(camera);
  const render = new FakeRenderPort();
  const ports: ScenePorts = { render };
  const scheduler = new Scheduler();
  const managerAudio = new AudioManager();
  const audio = new FakeAudioPort();
  managerAudio.attach(audio);
  const ctx: SceneContext = {
    audio: managerAudio,
    assets: managerAssets,
    input: managerInput,
    physics: managerPhysics,
    camera: managerCamera,
    events,
    logger,
    time: new Time(0.1),
    scheduler,
    random: new Random(1),
    width: 800,
    height: 600,
    profiler: options.profiler
  };
  scene.initInternal(ctx, ports);
  scene.internalCreate();
  return {
    scene,
    render,
    physics,
    camera,
    input,
    assets,
    events,
    managerInput,
    managerPhysics,
    managerCamera,
    managerAssets,
    managerAudio,
    audio,
    scheduler,
    ctx,
    step: (deltaTime = 0.016, frames = 1) => {
      for (let frame = 0; frame < frames; frame += 1) {
        managerInput.update();
        scene.internalUpdate(deltaTime);
      }
    }
  };
};
