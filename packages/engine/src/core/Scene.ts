import type { AssetManager, AssetDescriptor } from "../systems/AssetManager";
import type { InputManager } from "../systems/InputManager";
import type { PhysicsManager } from "../systems/PhysicsManager";
import type { CameraManager } from "../systems/CameraManager";
import type { EventBus } from "../systems/EventBus";
import type { Logger } from "../systems/Logger";
import type { Time } from "./Time";
import { Timer } from "../systems/Timer";
import type { Scheduler } from "../systems/Scheduler";
import type { Profiler } from "../debug/Profiler";
import type { Random } from "./Random";
import { GameObject, type GameObjectOptions, type TextStyleData } from "./GameObject";
import { ObjectIndex, Group, type ObjectPredicate, type TagFilterMode } from "./ObjectIndex";
import type { AnimationPlayOptions, AnimationState, RenderPort } from "./ports";
import { phaseRank, type Component } from "./Component";
import type { AudioChannel, AudioManager, PlaySoundOptions, SoundHandle } from "../audio/AudioManager";
import { TweenManager, type SequenceOptions, type TweenSequence, type TweenStep } from "../animation/TweenManager";
import type { Tween, TweenOptions, TweenTarget, TweenValues } from "../animation/Tween";

export type SceneContext = {
  audio: AudioManager;
  assets: AssetManager;
  input: InputManager;
  physics: PhysicsManager;
  camera: CameraManager;
  events: EventBus;
  logger: Logger;
  time: Time;
  scheduler: Scheduler;
  random: Random;
  width: number;
  height: number;
  profiler?: Profiler;
};

export type ScenePorts = {
  render: RenderPort;
};

export type OriginOptions = {
  originX?: number;
  originY?: number;
};

export type SpriteOptions = Omit<GameObjectOptions, "render"> & OriginOptions & {
  frame?: string;
  displayWidth?: number;
  displayHeight?: number;
  fallbackRadius?: number;
  fallbackColor?: number;
};

export type TextOptions = Omit<GameObjectOptions, "render"> & OriginOptions & {
  style?: TextStyleData;
};

export type ShapeOptions = Omit<GameObjectOptions, "render"> & OriginOptions & {
  color: number;
  strokeColor?: number;
  strokeWidth?: number;
  fillAlpha?: number;
};

export abstract class Scene {
  readonly id: string;
  protected ctx!: SceneContext;
  private ports: ScenePorts | null = null;
  private index = new ObjectIndex();
  private pendingDestroy = new Set<GameObject>();
  private componentCache: Component[] = [];
  private componentsDirty = true;
  private nextTimer: Timer | null = null;
  private isCreated = false;
  private isUpdating = false;
  private data: unknown = null;
  private idCounter = 0;
  private tweenManager = new TweenManager();
  private declaredAssets: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  initInternal(ctx: SceneContext, ports: ScenePorts, data: unknown = null): void {
    this.ctx = ctx;
    this.ports = ports;
    this.data = data;
    this.nextTimer = null;
  }

  getData<T>(): T {
    return this.data as T;
  }

  getAssets(): AssetManager {
    return this.ctx.assets;
  }

  getAudio(): AudioManager {
    return this.ctx.audio;
  }

  getTweens(): TweenManager {
    return this.tweenManager;
  }

  tween(target: TweenTarget, props: TweenValues, options: TweenOptions = {}): Tween {
    return this.tweenManager.to(target, props, { owner: this.id, ...options });
  }

  tweenFrom(target: TweenTarget, props: TweenValues, options: TweenOptions = {}): Tween {
    return this.tweenManager.from(target, props, { owner: this.id, ...options });
  }

  tweenSequence(steps: TweenStep[], options: SequenceOptions = {}): TweenSequence {
    return this.tweenManager.sequence(steps, { owner: this.id, ...options });
  }

  delay(seconds: number, onComplete?: (tween: Tween) => void, options: TweenOptions = {}): Tween {
    return this.tweenManager.delay(seconds, onComplete, { owner: this.id, ...options });
  }

  playSound(assetId: string, options: Omit<PlaySoundOptions, "owner"> & { owner?: string } = {}): SoundHandle | null {
    return this.ctx.audio.play(assetId, { channel: "sfx", owner: this.id, ...options });
  }

  playMusic(assetId: string, options: Omit<PlaySoundOptions, "owner"> = {}): SoundHandle | null {
    return this.ctx.audio.playMusic(assetId, { owner: this.id, ...options });
  }

  stopMusic(): void {
    const music = this.ctx.audio.getMusic();
    if (music && music.owner === this.id) this.ctx.audio.stopMusic();
  }

  stopSounds(owner: string = this.id): number {
    return this.ctx.audio.stopOwner(owner);
  }

  setChannelVolume(channel: AudioChannel, value: number): void {
    this.ctx.audio.setVolume(channel, value);
  }

  getInput(): InputManager {
    return this.ctx.input;
  }

  getPhysics(): PhysicsManager {
    return this.ctx.physics;
  }

  getCamera(): CameraManager {
    return this.ctx.camera;
  }

  getEvents(): EventBus {
    return this.ctx.events;
  }

  getLogger(): Logger {
    return this.ctx.logger;
  }

  getTime(): Time {
    return this.ctx.time;
  }

  getTimer(): Timer {
    if (!this.nextTimer) this.nextTimer = new Timer(this.ctx.scheduler, this.id);
    return this.nextTimer;
  }

  getRandom(): Random {
    return this.ctx.random;
  }

  get width(): number {
    return this.ctx.width;
  }

  get height(): number {
    return this.ctx.height;
  }

  getDeclaredAssetIds(): readonly string[] {
    return this.declaredAssets;
  }

  declareAssets(assets: AssetDescriptor[]): void {
    for (const asset of assets) {
      if (!this.declaredAssets.includes(asset.id)) this.declaredAssets.push(asset.id);
    }
    this.ctx.assets.registerMany(assets);
    this.ctx.assets.hold(this.id, assets.map((asset) => asset.id));
  }

  playAnimation(target: GameObject | string, key: string, options: AnimationPlayOptions = {}): boolean {
    const object = typeof target === "string" ? this.getObject(target) : target;
    if (!object) return false;
    return this.ports?.render.playAnimation?.(object, key, options) ?? false;
  }

  stopAnimation(target: GameObject | string, key?: string): void {
    const object = typeof target === "string" ? this.getObject(target) : target;
    if (!object) return;
    this.ports?.render.stopAnimation?.(object, key);
  }

  pauseAnimation(target: GameObject | string, paused = true): void {
    const object = typeof target === "string" ? this.getObject(target) : target;
    if (!object) return;
    this.ports?.render.pauseAnimation?.(object, paused);
  }

  setFrame(target: GameObject | string, frame: number | string): boolean {
    const object = typeof target === "string" ? this.getObject(target) : target;
    if (!object) return false;
    return this.ports?.render.setFrame?.(object, frame) ?? false;
  }

  getAnimationState(target: GameObject | string): AnimationState | null {
    const object = typeof target === "string" ? this.getObject(target) : target;
    if (!object) return null;
    return this.ports?.render.getAnimationState?.(object) ?? null;
  }

  preload?(): void | Promise<void>;

  abstract create(): void | Promise<void>;

  update?(deltaTime: number): void;

  fixedUpdate?(fixedDelta: number): void;

  shutdown?(): void;

  createObject(options: GameObjectOptions = {}): GameObject {
    const id = options.id ?? this.nextId();
    if (this.index.has(id)) throw new Error(`Object "${id}" already exists in scene "${this.id}"`);
    const object = new GameObject(id, options);
    object.scene = this;
    this.index.add(object);
    object.isActiveInHierarchy = object.active && (object.parent?.isActiveInHierarchy ?? true);
    this.ports?.render.create(object);
    this.componentsDirty = true;
    this.ctx.events.emit("object:created", { sceneId: this.id, id });
    return object;
  }

  createSprite(textureId: string, options: SpriteOptions = {}): GameObject {
    const { frame, displayWidth, displayHeight, fallbackRadius, fallbackColor, originX, originY, ...rest } = options;
    return this.createObject({
      ...rest,
      render: { kind: "sprite", textureId, frame, displayWidth, displayHeight, fallbackRadius, fallbackColor, originX, originY }
    });
  }

  createText(text: string, options: TextOptions = {}): GameObject {
    const { style, originX, originY, ...rest } = options;
    return this.createObject({ ...rest, render: { kind: "text", text, style, originX, originY } });
  }

  createRect(width: number, height: number, options: ShapeOptions): GameObject {
    const { color, strokeColor, strokeWidth, fillAlpha, originX, originY, ...rest } = options;
    return this.createObject({
      ...rest,
      render: { kind: "rect", width, height, color, strokeColor, strokeWidth, fillAlpha, originX, originY }
    });
  }

  createEllipse(radius: number, options: ShapeOptions): GameObject {
    const { color, strokeColor, strokeWidth, fillAlpha, originX, originY, ...rest } = options;
    return this.createObject({
      ...rest,
      render: { kind: "ellipse", radius, color, strokeColor, strokeWidth, fillAlpha, originX, originY }
    });
  }

  destroyObject(target: GameObject | string): boolean {
    const object = typeof target === "string" ? this.index.get(target) : target;
    if (!object || object.destroyed || object.scene !== this) return false;
    if (this.isUpdating) {
      this.pendingDestroy.add(object);
      return true;
    }
    this.finalizeDestroy(object);
    return true;
  }

  activateObject(target: GameObject | string): void {
    this.resolve(target)?.setActive(true);
  }

  deactivateObject(target: GameObject | string): void {
    this.resolve(target)?.setActive(false);
  }

  destroyAllObjects(): void {
    for (const object of this.index.all()) this.destroyObject(object);
  }

  getObject<T extends GameObject = GameObject>(id: string): T | undefined {
    return this.index.get(id) as T | undefined;
  }

  getObjects(): GameObject[] {
    return this.index.all();
  }

  objectCount(): number {
    return this.index.count();
  }

  find(predicate: ObjectPredicate): GameObject | undefined {
    return this.index.find(predicate);
  }

  findAll(predicate: ObjectPredicate): GameObject[] {
    return this.index.filter(predicate);
  }

  findByName(name: string): GameObject | undefined {
    return this.index.byName(name);
  }

  findByTag(tag: string): GameObject[] {
    return this.index.byTagName(tag);
  }

  findByTags(tags: readonly string[], mode: TagFilterMode = "any"): GameObject[] {
    return this.index.byTags(tags, mode);
  }

  group(name: string): Group {
    return this.index.group(name);
  }

  getGroup(name: string): Group | undefined {
    return this.index.getGroup(name);
  }

  getGroupMembers(name: string): GameObject[] {
    return this.index.groupMembers(name);
  }

  getGroups(): string[] {
    return this.index.groupNames();
  }

  each(fn: (object: GameObject) => void): void {
    for (const object of this.index.all()) fn(object);
  }

  getSystemOrder(): readonly string[] {
    return ["input", "scene.update", "behavior", "physics", "animation", "render"];
  }

  internalCreate(): void | Promise<void> {
    this.isCreated = true;
    return this.create();
  }

  internalUpdate(deltaTime: number): void {
    if (!this.isCreated) return;
    this.isUpdating = true;
    const profiler = this.ctx.profiler;
    profiler?.begin("physics.readback");
    this.applyPhysicsPositions();
    profiler?.end("physics.readback");
    profiler?.begin("tweens");
    this.tweenManager.update(deltaTime);
    profiler?.end("tweens");
    const components = this.orderedComponents();
    profiler?.begin("components");
    this.runPhase(components, "input", deltaTime);
    profiler?.end("components");
    profiler?.begin("scene.update");
    this.update?.(deltaTime);
    profiler?.end("scene.update");
    profiler?.begin("components");
    this.runPhase(components, "behavior", deltaTime);
    this.runPhase(components, "physics", deltaTime);
    this.runPhase(components, "animation", deltaTime);
    this.runPhase(components, "render", deltaTime);
    profiler?.end("components");
    profiler?.begin("destroy");
    this.flushDestroyQueue();
    profiler?.end("destroy");
    profiler?.begin("render.sync");
    this.syncRender();
    profiler?.end("render.sync");
    this.isUpdating = false;
  }

  internalFixedUpdate(fixedDelta: number): void {
    if (!this.isCreated || fixedDelta <= 0) return;
    try {
      this.fixedUpdate?.(fixedDelta);
    } catch (error) {
      this.ctx.logger.error(`Error in fixedUpdate of scene "${this.id}"`, error);
    }
  }

  internalShutdown(): void {
    if (!this.isCreated) return;
    this.shutdown?.();
    this.isUpdating = false;
    this.destroyAllObjects();
    this.pendingDestroy.clear();
    this.index.clear();
    this.componentCache = [];
    this.componentsDirty = true;
    this.ports?.render.clear();
    this.nextTimer?.clear();
    this.nextTimer = null;
    this.tweenManager.stopAll();
    this.ctx.audio.stopOwner(this.id);
    this.ctx.assets.releaseOwner(this.id);
    this.ctx.events.clearScene(this.id);
    this.isCreated = false;
  }

  internalTagChanged(object: GameObject, tag: string, added: boolean): void {
    this.index.tagChanged(object, tag, added);
  }

  internalGroupChanged(object: GameObject, group: string, added: boolean): void {
    this.index.groupChanged(object, group, added);
  }

  internalComponentsDirty(): void {
    this.componentsDirty = true;
  }

  internalActivationChanged(): void {
    this.componentsDirty = true;
  }

  private resolve(target: GameObject | string): GameObject | undefined {
    return typeof target === "string" ? this.index.get(target) : target;
  }

  private nextId(): string {
    let id = `${this.id}-object-${this.idCounter++}`;
    while (this.index.has(id)) id = `${this.id}-object-${this.idCounter++}`;
    return id;
  }

  private finalizeDestroy(object: GameObject): void {
    if (object.destroyed) return;
    this.pendingDestroy.delete(object);
    const children = object.children.slice();
    for (const child of children) this.finalizeDestroy(child);
    if (object.parent) object.parent.removeChild(object);
    this.index.remove(object);
    this.ports?.render.destroy(object);
    this.ctx.events.emit("object:destroyed", { sceneId: this.id, id: object.id });
    object.internalDestroy();
    this.componentsDirty = true;
  }

  private flushDestroyQueue(): void {
    if (this.pendingDestroy.size === 0) return;
    const queue = Array.from(this.pendingDestroy);
    this.pendingDestroy.clear();
    for (const object of queue) this.finalizeDestroy(object);
  }

  private applyPhysicsPositions(): void {
    const physics = this.ctx.physics;
    if (!physics.isAttached()) return;
    for (const object of this.index.all()) {
      if (object.destroyed || object.body?.type !== "dynamic") continue;
      const position = physics.readPosition(object);
      if (position) object.internalApplyPhysicsPosition(position.x, position.y);
    }
  }

  private syncRender(): void {
    const render = this.ports?.render;
    if (!render) return;
    const dirty: GameObject[] = [];
    for (const object of this.index.all()) {
      if (!object.renderDirty) continue;
      object.renderDirty = false;
      dirty.push(object);
    }
    if (dirty.length > 0) render.sync(dirty);
  }

  private orderedComponents(): Component[] {
    if (this.componentsDirty) {
      const list: Component[] = [];
      for (const object of this.index.all()) {
        if (!object.isActiveInHierarchy) continue;
        for (const component of object.getComponents()) {
          if (component.enabled) list.push(component);
        }
      }
      list.sort(
        (a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.order - b.order || a.sequence - b.sequence
      );
      this.componentCache = list;
      this.componentsDirty = false;
    }
    return this.componentCache;
  }

  private runPhase(components: readonly Component[], phase: string, deltaTime: number): void {
    for (const component of components) {
      if (component.phase !== phase || !component.enabled || !component.onUpdate) continue;
      this.invokeComponent(component, deltaTime);
    }
  }

  private invokeComponent(component: Component, deltaTime: number): void {
    try {
      component.onUpdate?.(deltaTime);
    } catch (error) {
      this.ctx.logger.error(`Component error in scene "${this.id}"`, error);
    }
  }
}
