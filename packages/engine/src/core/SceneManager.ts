import { Scene } from "./Scene";
import { Logger } from "../systems/Logger";
import { EventBus } from "../systems/EventBus";

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private activeSceneId: string | null = null;
  private logger: Logger;
  private events: EventBus;

  constructor(logger: Logger, events: EventBus) {
    this.logger = logger.child("SceneManager");
    this.events = events;
  }

  register(scene: Scene): void {
    if (this.scenes.has(scene.id)) {
      throw new Error(`Scene with id "${scene.id}" is already registered`);
    }
    this.scenes.set(scene.id, scene);
    this.logger.info(`Registered scene "${scene.id}"`);
  }

  has(id: string): boolean {
    return this.scenes.has(id);
  }

  get(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  getActiveSceneId(): string | null {
    return this.activeSceneId;
  }

  getActiveScene(): Scene | null {
    if (!this.activeSceneId) return null;
    return this.scenes.get(this.activeSceneId) ?? null;
  }

  start(id: string, data?: unknown): void {
    const scene = this.scenes.get(id);
    if (!scene) throw new Error(`Scene "${id}" not found`);
    if (this.activeSceneId) {
      const prev = this.scenes.get(this.activeSceneId);
      if (prev) {
        try {
          prev.internalShutdown();
        } catch (e) {
          this.logger.error(`Error shutting down scene "${prev.id}"`, e);
        }
      }
    }
    this.activeSceneId = id;
    this.events.emit("scene:start", { sceneId: id, data });
    this.logger.info(`Starting scene "${id}"`);
  }

  stop(id: string): void {
    const scene = this.scenes.get(id);
    if (!scene) return;
    try {
      scene.internalShutdown();
    } catch (e) {
      this.logger.error(`Error shutting down scene "${id}"`, e);
    }
    if (this.activeSceneId === id) this.activeSceneId = null;
    this.events.emit("scene:stop", { sceneId: id });
  }

  switch(fromId: string, toId: string, data?: unknown): void {
    if (fromId !== this.activeSceneId) {
      this.logger.warn(`Switch requested from "${fromId}" but active is "${this.activeSceneId}"`);
    }
    this.start(toId, data);
  }

  list(): string[] {
    return Array.from(this.scenes.keys());
  }

  clear(): void {
    for (const id of this.scenes.keys()) this.stop(id);
    this.scenes.clear();
    this.activeSceneId = null;
  }
}
