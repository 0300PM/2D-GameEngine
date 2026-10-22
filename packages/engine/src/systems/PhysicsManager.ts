import type { GameObject } from "../core/GameObject";
import { inactiveCollider, type ColliderHandle, type ColliderPair, type CollisionHandler, type PhysicsPort, type PhysicsStats, type Vec2 } from "../core/ports";

export class PhysicsManager {
  private port: PhysicsPort | null = null;

  attach(port: PhysicsPort): void {
    this.port = port;
  }

  detach(): void {
    this.port = null;
  }

  isAttached(): boolean {
    return this.port !== null;
  }

  setWorldBounds(x: number, y: number, width: number, height: number): void {
    this.port?.setWorldBounds(x, y, width, height);
  }

  attachBody(object: GameObject): void {
    this.port?.attachBody(object);
  }

  detachBody(object: GameObject): void {
    this.port?.detachBody(object);
  }

  readPosition(object: GameObject): Vec2 | null {
    return this.port?.readPosition(object) ?? null;
  }

  setVelocity(object: GameObject, vx: number, vy: number): void {
    this.port?.setVelocity(object, vx, vy);
  }

  getVelocity(object: GameObject): Vec2 {
    return this.port?.getVelocity(object) ?? { x: 0, y: 0 };
  }

  setImmovable(object: GameObject, value: boolean): void {
    this.port?.setImmovable(object, value);
  }

  setCollideWorldBounds(object: GameObject, value: boolean): void {
    this.port?.setCollideWorldBounds(object, value);
  }

  getStats(): PhysicsStats | null {
    return this.port?.getStats?.() ?? null;
  }

  setDebugDraw(enabled: boolean): void {
    this.port?.setDebugDraw?.(enabled);
  }

  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    return this.port?.addCollider(a, b, handler) ?? inactiveCollider;
  }

  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle {
    return this.port?.addOverlap(a, b, handler) ?? inactiveCollider;
  }

  clear(): void {
    this.port?.clear();
  }
}
