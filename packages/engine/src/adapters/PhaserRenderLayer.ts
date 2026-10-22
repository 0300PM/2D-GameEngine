import Phaser from "phaser";
import type { GameObject, RenderDescriptor, TextStyleData } from "../core/GameObject";
import type { AnimationPlayOptions, AnimationState, RenderPort } from "../core/ports";

type Display = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  setPosition(x: number, y: number): unknown;
  setRotation(value: number): unknown;
  setScale(x: number, y: number): unknown;
  setDepth(value: number): unknown;
  setAlpha(value: number): unknown;
  setVisible(value: boolean): unknown;
  destroy(): void;
};

type AnimatedDisplay = Display & {
  anims?: Phaser.Animations.AnimationState;
  setFrame?(frame: number | string): unknown;
  frame?: { name: string | number; textureFrame?: string | number };
};

type Entry = {
  display: Display | null;
  revision: number;
};

const toTextStyle = (style?: TextStyleData): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: style?.fontFamily ?? "monospace",
  fontSize: style?.fontSize ?? "16px",
  color: style?.color ?? "#f2f3f5",
  fontStyle: style?.fontStyle,
  backgroundColor: style?.backgroundColor,
  align: style?.align,
  padding: style?.padding === undefined ? undefined : { x: style.padding, y: style.padding }
});

type DebugState = {
  grid: boolean;
  gridSize: number;
  axes: boolean;
  cameraBounds: boolean;
};

export class PhaserRenderLayer implements RenderPort {
  private entries = new Map<GameObject, Entry>();
  private owners = new Map<Phaser.GameObjects.GameObject, GameObject>();
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugState: DebugState = { grid: false, gridSize: 64, axes: false, cameraBounds: false };

  constructor(private scene: Phaser.Scene) {}

  create(object: GameObject): void {
    const display = this.build(object);
    this.entries.set(object, { display, revision: object.renderRevision });
    if (display) this.owners.set(display, object);
    this.apply(object, display);
  }

  destroy(object: GameObject): void {
    const entry = this.entries.get(object);
    if (!entry) return;
    if (entry.display) {
      this.owners.delete(entry.display);
      entry.display.destroy();
    }
    this.entries.delete(object);
  }

  sync(objects: readonly GameObject[]): void {
    for (const object of objects) {
      const entry = this.entries.get(object);
      if (!entry) continue;
      if (object.renderRevision !== entry.revision) {
        this.destroy(object);
        this.create(object);
        continue;
      }
      this.apply(object, entry.display);
    }
  }

  clear(): void {
    for (const object of Array.from(this.entries.keys())) this.destroy(object);
    this.owners.clear();
    this.destroyDebug();
  }

  playAnimation(object: GameObject, key: string, options: AnimationPlayOptions = {}): boolean {
    const display = this.entries.get(object)?.display as AnimatedDisplay | null;
    if (!display?.anims || !this.scene.anims.exists(key)) return false;
    const ignoreIfPlaying = !options.restart;
    const config: Phaser.Types.Animations.PlayAnimationConfig = { key };
    if (options.frame !== undefined && typeof options.frame === "number") config.startFrame = options.frame;
    if (options.rate !== undefined) config.timeScale = options.rate;
    display.anims.play(config, ignoreIfPlaying);
    return true;
  }

  stopAnimation(object: GameObject, key?: string): void {
    const display = this.entries.get(object)?.display as AnimatedDisplay | null;
    const anims = display?.anims;
    if (!anims) return;
    if (key !== undefined && anims.currentAnim && anims.currentAnim.key !== key) return;
    anims.stop();
  }

  pauseAnimation(object: GameObject, paused: boolean): void {
    const anims = (this.entries.get(object)?.display as AnimatedDisplay | null)?.anims;
    if (!anims) return;
    if (paused) {
      anims.pause();
      return;
    }
    anims.resume();
  }

  setFrame(object: GameObject, frame: number | string): boolean {
    const display = this.entries.get(object)?.display as AnimatedDisplay | null;
    if (!display?.setFrame) return false;
    display.anims?.stop();
    display.setFrame(frame);
    return true;
  }

  getAnimationState(object: GameObject): AnimationState | null {
    const display = this.entries.get(object)?.display as AnimatedDisplay | null;
    const anims = display?.anims;
    if (!anims) return null;
    return {
      key: anims.currentAnim?.key ?? null,
      frame: anims.currentFrame?.index ?? 0,
      isPlaying: anims.isPlaying,
      isPaused: anims.isPaused
    };
  }

  getDisplay(object: GameObject): Phaser.GameObjects.GameObject | null {
    return this.entries.get(object)?.display ?? null;
  }

  getOwner(display: Phaser.GameObjects.GameObject): GameObject | undefined {
    return this.owners.get(display);
  }

  setDebugLayer(state: DebugState): void {
    this.debugState = { ...state, gridSize: Math.max(4, state.gridSize) };
    if (!this.debugState.grid && !this.debugState.axes && !this.debugState.cameraBounds) {
      this.debugGraphics?.destroy();
      this.debugGraphics = null;
      return;
    }
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(Number.MAX_SAFE_INTEGER - 1);
      this.debugGraphics.setScrollFactor(1);
    }
  }

  drawDebug(): void {
    const graphics = this.debugGraphics;
    if (!graphics) return;
    const state = this.debugState;
    graphics.clear();

    if (state.grid) {
      const view = this.scene.cameras.main.worldView;
      const size = state.gridSize;
      const startX = Math.floor(view.x / size) * size;
      const startY = Math.floor(view.y / size) * size;
      const endX = view.right + size;
      const endY = view.bottom + size;
      graphics.lineStyle(1, 0x3a4150, 0.5);
      const budget = 400;
      let lines = 0;
      for (let x = startX; x <= endX && lines < budget; x += size) {
        graphics.lineBetween(x, view.y, x, view.bottom);
        lines += 1;
      }
      for (let y = startY; y <= endY && lines < budget; y += size) {
        graphics.lineBetween(view.x, y, view.right, y);
        lines += 1;
      }
    }

    if (state.axes) {
      const view = this.scene.cameras.main.worldView;
      graphics.lineStyle(2, 0xe2b714, 0.9);
      graphics.lineBetween(view.x, 0, view.right, 0);
      graphics.lineStyle(2, 0x4ec9b0, 0.9);
      graphics.lineBetween(0, view.y, 0, view.bottom);
    }

    if (state.cameraBounds) {
      const view = this.scene.cameras.main.worldView;
      const world = this.scene.physics?.world?.bounds;
      graphics.lineStyle(1.5, 0xff6b6b, 0.85);
      graphics.strokeRect(view.x, view.y, view.width, view.height);
      if (world) {
        graphics.lineStyle(1.5, 0x8ab4f8, 0.8);
        graphics.strokeRect(world.x, world.y, world.width, world.height);
      }
    }
  }

  destroyDebug(): void {
    this.debugGraphics?.destroy();
    this.debugGraphics = null;
  }

  private apply(object: GameObject, display: Display | null): void {
    if (!display) return;
    const world = object.world;
    display.setPosition(world.x, world.y);
    display.setRotation(world.rotation);
    display.setScale(world.scaleX, world.scaleY);
    display.setDepth(object.depth);
    display.setAlpha(object.alpha);
    display.setVisible(object.visible && object.isActiveInHierarchy);
  }

  private build(object: GameObject): Display | null {
    const render = object.render;
    if (!render) return null;
    const display = this.createDisplay(render);
    if (!display) return null;
    const target = display as Display & {
      setOrigin?(x: number, y: number): unknown;
      setScrollFactor?(x: number, y?: number): unknown;
      setTint?(color: number): unknown;
      setDisplaySize?(width: number, height: number): unknown;
    };
    target.setScrollFactor?.(object.scrollFactor, object.scrollFactor);
    const defaultOrigin = render.kind === "text" ? 0 : 0.5;
    target.setOrigin?.(render.originX ?? defaultOrigin, render.originY ?? defaultOrigin);
    if (object.tint !== null) target.setTint?.(object.tint);
    return target;
  }

  private createDisplay(render: RenderDescriptor): Phaser.GameObjects.GameObject | null {
    switch (render.kind) {
      case "sprite": {
        if (this.scene.textures.exists(render.textureId)) {
          const sprite = this.scene.add.sprite(0, 0, render.textureId, render.frame);
          if (render.displayWidth && render.displayHeight) sprite.setDisplaySize(render.displayWidth, render.displayHeight);
          return sprite;
        }
        return this.scene.add.circle(0, 0, render.fallbackRadius ?? 12, render.fallbackColor ?? 0xf2f3f5);
      }
      case "text":
        return this.scene.add.text(0, 0, render.text, toTextStyle(render.style));
      case "rect": {
        const rect = this.scene.add.rectangle(0, 0, render.width, render.height, render.color, render.fillAlpha ?? 1);
        if (render.strokeColor !== undefined) rect.setStrokeStyle(render.strokeWidth ?? 1, render.strokeColor);
        return rect;
      }
      case "ellipse": {
        const circle = this.scene.add.circle(0, 0, render.radius, render.color, render.fillAlpha ?? 1);
        if (render.strokeColor !== undefined) circle.setStrokeStyle(render.strokeWidth ?? 1, render.strokeColor);
        return circle;
      }
      default:
        return null;
    }
  }
}
