import type { GameObject } from "../core/GameObject";
import type { AnimationPlayOptions, AnimationState, DebugLayerState, PhysicsPort, RenderPort } from "../core/ports";

export type RenderLayerLike = Pick<
  RenderPort,
  "create" | "destroy" | "sync" | "clear" | "playAnimation" | "stopAnimation" | "pauseAnimation" | "setFrame" | "getAnimationState"
> & {
  setDebugLayer?(state: DebugLayerState): void;
  drawDebug?(): void;
};

export const createRenderPort = (layer: RenderLayerLike, physics: Pick<PhysicsPort, "attachBody" | "detachBody" | "clear">): RenderPort => ({
  create(object: GameObject): void {
    layer.create(object);
    if (object.body) physics.attachBody(object);
  },
  destroy(object: GameObject): void {
    physics.detachBody(object);
    layer.destroy(object);
  },
  sync(objects: readonly GameObject[]): void {
    layer.sync(objects);
  },
  clear(): void {
    physics.clear();
    layer.clear();
  },
  playAnimation(object: GameObject, key: string, options?: AnimationPlayOptions): boolean {
    return layer.playAnimation?.(object, key, options) ?? false;
  },
  stopAnimation(object: GameObject, key?: string): void {
    layer.stopAnimation?.(object, key);
  },
  pauseAnimation(object: GameObject, paused: boolean): void {
    layer.pauseAnimation?.(object, paused);
  },
  setFrame(object: GameObject, frame: number | string): boolean {
    return layer.setFrame?.(object, frame) ?? false;
  },
  getAnimationState(object: GameObject): AnimationState | null {
    return layer.getAnimationState?.(object) ?? null;
  },
  setDebugLayer(state: DebugLayerState): void {
    layer.setDebugLayer?.(state);
  }
});
