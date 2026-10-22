import { Transform } from "../components/Transform";
import type { Component, ComponentClass } from "./Component";
import type { Scene } from "./Scene";

export type TextStyleData = {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  fontStyle?: string;
  backgroundColor?: string;
  padding?: number;
  align?: "left" | "center" | "right";
};

export type RenderOrigin = {
  originX?: number;
  originY?: number;
};

export type SpriteRender = RenderOrigin & {
  kind: "sprite";
  textureId: string;
  frame?: string;
  displayWidth?: number;
  displayHeight?: number;
  fallbackRadius?: number;
  fallbackColor?: number;
};

export type TextRender = RenderOrigin & {
  kind: "text";
  text: string;
  style?: TextStyleData;
};

export type RectRender = RenderOrigin & {
  kind: "rect";
  width: number;
  height: number;
  color: number;
  strokeColor?: number;
  strokeWidth?: number;
  fillAlpha?: number;
};

export type EllipseRender = RenderOrigin & {
  kind: "ellipse";
  radius: number;
  color: number;
  strokeColor?: number;
  strokeWidth?: number;
  fillAlpha?: number;
};

export type RenderDescriptor = SpriteRender | TextRender | RectRender | EllipseRender;

export type BodyDescriptor = {
  type: "dynamic" | "static";
  shape?: "rect" | "circle";
  radius?: number;
  immovable?: boolean;
  collideWorldBounds?: boolean;
};

export type GameObjectOptions = {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  visible?: boolean;
  active?: boolean;
  alpha?: number;
  depth?: number;
  scrollFactor?: number;
  tint?: number | null;
  tags?: readonly string[];
  render?: RenderDescriptor | null;
  body?: BodyDescriptor | null;
};

export class GameObject {
  readonly id: string;
  name: string;
  readonly tags = new Set<string>();
  readonly groups = new Set<string>();
  readonly transform: Transform;
  readonly children: GameObject[] = [];
  parent: GameObject | null = null;
  scene: Scene | null = null;
  render: RenderDescriptor | null;
  body: BodyDescriptor | null;
  visible: boolean;
  active: boolean;
  scrollFactor: number;
  tint: number | null;
  renderDirty = true;
  renderRevision = 0;
  worldDirty = true;
  isActiveInHierarchy: boolean;
  private alphaValue = 1;
  private depthValue = 0;
  private worldTransform = new Transform();
  private components = new Map<ComponentClass, Component>();
  private destroyedValue = false;

  constructor(id: string, options: GameObjectOptions = {}) {
    this.id = id;
    this.name = options.name ?? id;
    this.transform = new Transform(
      options.x ?? 0,
      options.y ?? 0,
      options.rotation ?? 0,
      options.scaleX ?? 1,
      options.scaleY ?? 1
    );
    this.render = options.render ?? null;
    this.body = options.body ?? null;
    this.visible = options.visible ?? true;
    this.active = options.active ?? true;
    this.alpha = options.alpha ?? 1;
    this.depth = options.depth ?? 0;
    this.scrollFactor = options.scrollFactor ?? 1;
    this.tint = options.tint ?? null;
    this.isActiveInHierarchy = this.active;
    if (options.tags) for (const tag of options.tags) this.tags.add(tag);
  }

  get destroyed(): boolean {
    return this.destroyedValue;
  }

  get x(): number {
    return this.transform.x;
  }

  set x(value: number) {
    this.transform.x = value;
    this.markWorldDirty();
  }

  get y(): number {
    return this.transform.y;
  }

  set y(value: number) {
    this.transform.y = value;
    this.markWorldDirty();
  }

  get alpha(): number {
    return this.alphaValue;
  }

  set alpha(value: number) {
    this.alphaValue = value;
    this.markRenderDirty();
  }

  get depth(): number {
    return this.depthValue;
  }

  set depth(value: number) {
    this.depthValue = value;
    this.markRenderDirty();
  }

  get rotation(): number {
    return this.transform.rotation;
  }

  set rotation(value: number) {
    this.transform.rotation = value;
    this.markWorldDirty();
  }

  get scaleX(): number {
    return this.transform.scaleX;
  }

  set scaleX(value: number) {
    this.transform.scaleX = value;
    this.markWorldDirty();
  }

  get scaleY(): number {
    return this.transform.scaleY;
  }

  set scaleY(value: number) {
    this.transform.scaleY = value;
    this.markWorldDirty();
  }

  get world(): Transform {
    if (this.worldDirty) this.recomputeWorld();
    return this.worldTransform;
  }

  setPosition(x: number, y: number): this {
    this.transform.x = x;
    this.transform.y = y;
    this.markWorldDirty();
    return this;
  }

  translate(dx: number, dy: number): this {
    this.transform.x += dx;
    this.transform.y += dy;
    this.markWorldDirty();
    return this;
  }

  setRotation(radians: number): this {
    this.transform.rotation = radians;
    this.markWorldDirty();
    return this;
  }

  setScale(x: number, y = x): this {
    this.transform.scaleX = x;
    this.transform.scaleY = y;
    this.markWorldDirty();
    return this;
  }

  setVisible(visible: boolean): this {
    if (this.visible === visible) return this;
    this.visible = visible;
    this.markRenderDirty();
    return this;
  }

  setActive(active: boolean): this {
    if (this.active === active) return this;
    this.active = active;
    this.applyActivation();
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    this.markRenderDirty();
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    this.markRenderDirty();
    return this;
  }

  setScrollFactor(factor: number): this {
    this.scrollFactor = factor;
    this.markRenderDirty();
    return this;
  }

  setTint(color: number | null): this {
    this.tint = color;
    this.markRenderDirty();
    return this;
  }

  setRender(render: RenderDescriptor | null): this {
    this.render = render;
    this.renderRevision += 1;
    this.markRenderDirty();
    return this;
  }

  setBody(body: BodyDescriptor | null): this {
    this.body = body;
    return this;
  }

  addTag(tag: string): this {
    if (this.tags.has(tag)) return this;
    this.tags.add(tag);
    this.scene?.internalTagChanged(this, tag, true);
    return this;
  }

  removeTag(tag: string): this {
    if (!this.tags.delete(tag)) return this;
    this.scene?.internalTagChanged(this, tag, false);
    return this;
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  hasAnyTag(tags: readonly string[]): boolean {
    return tags.some((tag) => this.tags.has(tag));
  }

  hasAllTags(tags: readonly string[]): boolean {
    return tags.every((tag) => this.tags.has(tag));
  }

  addChild(child: GameObject): this {
    if (child === this) throw new Error("GameObject cannot be its own child");
    if (this.isDescendantOf(child)) throw new Error(`Cycle detected: "${child.id}" is an ancestor of "${this.id}"`);
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    child.markWorldDirty();
    child.applyActivation();
    return this;
  }

  removeChild(child: GameObject): boolean {
    const index = this.children.indexOf(child);
    if (index === -1) return false;
    this.children.splice(index, 1);
    child.parent = null;
    child.markWorldDirty();
    child.applyActivation();
    return true;
  }

  add<T extends Component>(component: T): T {
    const ctor = component.constructor as ComponentClass<T>;
    const existing = this.components.get(ctor);
    if (existing) existing.internalDetach();
    this.components.set(ctor, component);
    component.internalAttach(this);
    this.scene?.internalComponentsDirty();
    return component;
  }

  get<T extends Component>(ctor: ComponentClass<T>): T | undefined {
    return this.components.get(ctor) as T | undefined;
  }

  has(ctor: ComponentClass): boolean {
    return this.components.has(ctor);
  }

  remove(ctor: ComponentClass): boolean {
    const component = this.components.get(ctor);
    if (!component) return false;
    this.components.delete(ctor);
    component.internalDetach();
    this.scene?.internalComponentsDirty();
    return true;
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }

  destroy(): void {
    this.scene?.destroyObject(this);
  }

  private isDescendantOf(candidate: GameObject): boolean {
    let ancestor = this.parent;
    while (ancestor) {
      if (ancestor === candidate) return true;
      ancestor = ancestor.parent;
    }
    return false;
  }

  markWorldDirty(): void {
    this.worldDirty = true;
    this.renderDirty = true;
    for (const child of this.children) child.markWorldDirty();
  }

  markRenderDirty(): void {
    this.renderDirty = true;
  }

  internalApplyPhysicsPosition(x: number, y: number): void {
    if (this.transform.x === x && this.transform.y === y) return;
    this.transform.x = x;
    this.transform.y = y;
    this.markWorldDirty();
  }

  internalDestroy(): void {
    if (this.destroyedValue) return;
    this.destroyedValue = true;
    for (const component of this.components.values()) component.internalDestroy();
    this.components.clear();
    this.tags.clear();
    this.groups.clear();
    this.children.length = 0;
    this.parent = null;
    this.scene = null;
    this.render = null;
    this.body = null;
  }

  private recomputeWorld(): void {
    const parent = this.parent;
    if (!parent) {
      this.worldTransform.x = this.transform.x;
      this.worldTransform.y = this.transform.y;
      this.worldTransform.rotation = this.transform.rotation;
      this.worldTransform.scaleX = this.transform.scaleX;
      this.worldTransform.scaleY = this.transform.scaleY;
    } else {
      const parentWorld = parent.world;
      const cos = Math.cos(parentWorld.rotation);
      const sin = Math.sin(parentWorld.rotation);
      const localX = this.transform.x * parentWorld.scaleX;
      const localY = this.transform.y * parentWorld.scaleY;
      this.worldTransform.x = parentWorld.x + localX * cos - localY * sin;
      this.worldTransform.y = parentWorld.y + localX * sin + localY * cos;
      this.worldTransform.rotation = parentWorld.rotation + this.transform.rotation;
      this.worldTransform.scaleX = parentWorld.scaleX * this.transform.scaleX;
      this.worldTransform.scaleY = parentWorld.scaleY * this.transform.scaleY;
    }
    this.worldDirty = false;
  }

  private applyActivation(): void {
    const wasActive = this.isActiveInHierarchy;
    const next = this.active && (this.parent?.isActiveInHierarchy ?? true);
    if (wasActive === next) return;
    this.isActiveInHierarchy = next;
    for (const component of this.components.values()) {
      if (next) component.internalActivate();
      else component.internalDeactivate();
    }
    this.scene?.internalComponentsDirty();
    this.scene?.internalActivationChanged();
    for (const child of this.children) child.applyActivation();
  }
}
