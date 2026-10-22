import type { DebugLayerState, PhysicsPort, RenderPort } from "../core/ports";

export type DebugViewState = DebugLayerState & {
  colliders: boolean;
};

export type DebugViewKey = "colliders" | "grid" | "axes" | "cameraBounds";

export type DebugViewSupport = {
  colliders: boolean;
  grid: boolean;
  axes: boolean;
  cameraBounds: boolean;
};

export const DEFAULT_DEBUG_VIEWS: DebugViewState = {
  colliders: false,
  grid: false,
  gridSize: 64,
  axes: false,
  cameraBounds: false
};

export class DebugViews {
  private state: DebugViewState = { ...DEFAULT_DEBUG_VIEWS };
  private getRender: () => RenderPort | null;
  private getPhysics: () => PhysicsPort | null;

  constructor(getRender: () => RenderPort | null, getPhysics: () => PhysicsPort | null) {
    this.getRender = getRender;
    this.getPhysics = getPhysics;
  }

  get(): DebugViewState {
    return { ...this.state };
  }

  set(patch: Partial<DebugViewState>): DebugViewState {
    this.state = { ...this.state, ...patch };
    if (this.state.gridSize <= 0) this.state.gridSize = DEFAULT_DEBUG_VIEWS.gridSize;
    this.sync();
    return this.get();
  }

  toggle(key: DebugViewKey): DebugViewState {
    return this.set({ [key]: !this.state[key] } as Partial<DebugViewState>);
  }

  reset(): DebugViewState {
    return this.set({ ...DEFAULT_DEBUG_VIEWS });
  }

  isActive(): boolean {
    return this.state.colliders || this.state.grid || this.state.axes || this.state.cameraBounds;
  }

  getSupport(): DebugViewSupport {
    const render = this.getRender();
    const physics = this.getPhysics();
    const layer = typeof render?.setDebugLayer === "function";
    return {
      colliders: typeof physics?.setDebugDraw === "function",
      grid: layer,
      axes: layer,
      cameraBounds: layer
    };
  }

  sync(): void {
    const physics = this.getPhysics();
    const render = this.getRender();
    physics?.setDebugDraw?.(this.state.colliders);
    render?.setDebugLayer?.({
      grid: this.state.grid,
      gridSize: this.state.gridSize,
      axes: this.state.axes,
      cameraBounds: this.state.cameraBounds
    });
  }

  clear(): void {
    this.state = { ...DEFAULT_DEBUG_VIEWS };
    this.sync();
  }
}
