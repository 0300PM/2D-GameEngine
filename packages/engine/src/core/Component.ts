import type { GameObject } from "./GameObject";
import type { Scene } from "./Scene";

export type SystemPhase = "input" | "behavior" | "physics" | "animation" | "render";

export const SYSTEM_ORDER: readonly SystemPhase[] = ["input", "behavior", "physics", "animation", "render"];

export const phaseRank = (phase: SystemPhase): number => SYSTEM_ORDER.indexOf(phase);

export type ComponentClass<T extends Component = Component> = abstract new (...args: never[]) => T;

let sequenceCounter = 0;

export abstract class Component {
  readonly sequence: number = sequenceCounter++;
  phase: SystemPhase = "behavior";
  order = 0;
  enabled = true;
  owner: GameObject | null = null;

  onAttach?(): void;
  onDetach?(): void;
  onEnable?(): void;
  onDisable?(): void;
  onUpdate?(deltaTime: number): void;
  onDestroy?(): void;

  get scene(): Scene | null {
    return this.owner?.scene ?? null;
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    const active = this.owner?.isActiveInHierarchy ?? false;
    if (enabled && active) this.onEnable?.();
    if (!enabled && active) this.onDisable?.();
    this.owner?.scene?.internalComponentsDirty();
    return this;
  }

  setPhase(phase: SystemPhase): this {
    this.phase = phase;
    this.owner?.scene?.internalComponentsDirty();
    return this;
  }

  setOrder(order: number): this {
    this.order = order;
    this.owner?.scene?.internalComponentsDirty();
    return this;
  }

  internalAttach(owner: GameObject): void {
    this.owner = owner;
    this.onAttach?.();
    if (owner.isActiveInHierarchy) this.onEnable?.();
  }

  internalDetach(): void {
    if (this.owner?.isActiveInHierarchy) this.onDisable?.();
    this.onDetach?.();
    this.owner = null;
  }

  internalDestroy(): void {
    if (this.owner?.isActiveInHierarchy) this.onDisable?.();
    this.onDestroy?.();
    this.owner = null;
  }

  internalActivate(): void {
    if (this.enabled) this.onEnable?.();
  }

  internalDeactivate(): void {
    if (this.enabled) this.onDisable?.();
  }
}
