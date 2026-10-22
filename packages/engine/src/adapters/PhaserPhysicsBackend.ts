import Phaser from "phaser";
import type { GameObject } from "../core/GameObject";
import { inactiveCollider, type ColliderHandle, type ColliderPair, type CollisionHandler, type PhysicsPort, type PhysicsStats, type Vec2 } from "../core/ports";

type ArcadeCollider = Phaser.Types.Physics.Arcade.ArcadeColliderType;

type PhysicsDisplay = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
  setCollideWorldBounds?(value: boolean): unknown;
};

export type DisplayResolver = (object: GameObject) => Phaser.GameObjects.GameObject | null;

export class PhaserPhysicsBackend implements PhysicsPort {
  private bodies = new Map<GameObject, PhysicsDisplay>();
  private owners = new Map<Phaser.GameObjects.GameObject, GameObject>();
  private colliders: Phaser.Physics.Arcade.Collider[] = [];

  constructor(
    private scene: Phaser.Scene,
    private resolveDisplay: DisplayResolver
  ) {}

  setWorldBounds(x: number, y: number, width: number, height: number): void {
    this.scene.physics.world.setBounds(x, y, width, height);
  }

  attachBody(object: GameObject): void {
    const descriptor = object.body;
    if (!descriptor || this.bodies.has(object)) return;
    const display = this.resolveDisplay(object) as PhysicsDisplay | null;
    if (!display) return;
    this.scene.physics.add.existing(display, descriptor.type === "static");
    const body = display.body;
    if (body && descriptor.type === "dynamic") {
      if (descriptor.shape === "circle" && descriptor.radius !== undefined) body.setCircle(descriptor.radius);
      if (descriptor.immovable) (body as Phaser.Physics.Arcade.Body).setImmovable(true);
    }
    if (descriptor.collideWorldBounds) display.setCollideWorldBounds?.(true);
    this.bodies.set(object, display);
    this.owners.set(display, object);
  }

  detachBody(object: GameObject): void {
    const display = this.bodies.get(object);
    if (!display) return;
    this.bodies.delete(object);
    this.owners.delete(display);
    if (display.body) this.scene.physics.world.disableBody(display.body);
  }

  readPosition(object: GameObject): Vec2 | null {
    const display = this.bodies.get(object);
    if (!display) return null;
    return { x: display.x, y: display.y };
  }

  setVelocity(object: GameObject, vx: number, vy: number): void {
    const body = this.bodyOf(object);
    body?.setVelocity(vx, vy);
  }

  getVelocity(object: GameObject): Vec2 {
    const body = this.bodyOf(object);
    if (!body) return { x: 0, y: 0 };
    return { x: body.velocity.x, y: body.velocity.y };
  }

  setImmovable(object: GameObject, value: boolean): void {
    this.bodyOf(object)?.setImmovable(value);
  }

  setCollideWorldBounds(object: GameObject, value: boolean): void {
    const display = this.bodies.get(object);
    display?.setCollideWorldBounds?.(value);
  }

  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    return this.register("collider", a, b, handler);
  }

  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle {
    return this.register("overlap", a, b, handler);
  }

  setDebugDraw(enabled: boolean): void {
    const world = this.scene.physics.world;
    world.drawDebug = enabled;
    if (!enabled) {
      world.debugGraphic?.clear();
      return;
    }
    const graphic = world.debugGraphic ?? world.createDebugGraphic();
    graphic.setDepth(Number.MAX_SAFE_INTEGER - 2);
  }

  getStats(): PhysicsStats {
    const bounds = this.scene.physics.world.bounds;
    return {
      bodies: this.bodies.size,
      colliders: this.colliders.length,
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    };
  }

  clear(): void {
    for (const collider of this.colliders) collider.destroy();
    this.colliders = [];
    this.bodies.clear();
    this.owners.clear();
  }

  private register(kind: "collider" | "overlap", a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    const left = this.resolvePair(a);
    const right = this.resolvePair(b);
    if (!left || !right) return inactiveCollider;
    const callback = handler
      ? (first: Phaser.Types.Physics.Arcade.GameObjectWithBody, second: Phaser.Types.Physics.Arcade.GameObjectWithBody): void => {
          const objectA = this.owners.get(first);
          const objectB = this.owners.get(second);
          if (objectA && objectB) handler(objectA, objectB);
        }
      : undefined;
    const factory = kind === "collider" ? this.scene.physics.add.collider : this.scene.physics.add.overlap;
    const collider = callback
      ? factory.call(this.scene.physics.add, left, right, callback as never)
      : factory.call(this.scene.physics.add, left, right, undefined as never);
    this.colliders.push(collider);
    return {
      active: true,
      destroy: () => {
        collider.destroy();
        const index = this.colliders.indexOf(collider);
        if (index !== -1) this.colliders.splice(index, 1);
      }
    };
  }

  private resolvePair(pair: ColliderPair): ArcadeCollider | null {
    const list: readonly GameObject[] = Array.isArray(pair) ? pair : [pair as GameObject];
    const displays = list.map((object) => this.bodies.get(object)).filter((display): display is PhysicsDisplay => Boolean(display));
    if (displays.length === 0) return null;
    return (displays.length === 1 ? displays[0] : displays) as unknown as ArcadeCollider;
  }

  private bodyOf(object: GameObject): Phaser.Physics.Arcade.Body | null {
    const body = this.bodies.get(object)?.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body : null;
  }
}
