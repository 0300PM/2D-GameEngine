import Phaser from "phaser";
import type { GameObject } from "../core/GameObject";
import type { CameraPort, Vec2 } from "../core/ports";
import type { DisplayResolver } from "./PhaserPhysicsBackend";

export class PhaserCameraBackend implements CameraPort {
  constructor(
    private scene: Phaser.Scene,
    private resolveDisplay: DisplayResolver
  ) {}

  private get camera(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  setBounds(x: number, y: number, width: number, height: number): void {
    this.camera.setBounds(x, y, width, height);
  }

  setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
  }

  getZoom(): number {
    return this.camera.zoom;
  }

  setBackgroundColor(color: string | number): void {
    this.camera.setBackgroundColor(color);
  }

  follow(object: GameObject | null, lerpX = 0.1, lerpY = 0.1): void {
    const display = object ? this.resolveDisplay(object) : null;
    if (!display) {
      this.camera.stopFollow();
      return;
    }
    this.camera.startFollow(display as never, false, lerpX, lerpY);
  }

  stopFollow(): void {
    this.camera.stopFollow();
  }

  getCenter(): Vec2 {
    const camera = this.camera;
    return { x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2 };
  }

  worldToScreen(x: number, y: number): Vec2 {
    const camera = this.camera;
    return { x: (x - camera.scrollX) * camera.zoom, y: (y - camera.scrollY) * camera.zoom };
  }

  shake(duration = 100, intensity = 0.01): void {
    this.camera.shake(duration, intensity);
  }

  fadeIn(duration = 300, red = 0, green = 0, blue = 0): void {
    this.camera.fadeIn(duration, red, green, blue);
  }

  fadeOut(duration = 300, red = 0, green = 0, blue = 0): void {
    this.camera.fadeOut(duration, red, green, blue);
  }

  flash(duration = 150, red = 255, green = 255, blue = 255): void {
    this.camera.flash(duration, red, green, blue);
  }

  resetEffects(): void {
    this.camera.resetFX();
  }
}
