import type { GameObject } from "../core/GameObject";
import type { CameraPort, Vec2 } from "../core/ports";

export class CameraManager {
  private port: CameraPort | null = null;

  attach(port: CameraPort): void {
    this.port = port;
  }

  detach(): void {
    this.port = null;
  }

  isAttached(): boolean {
    return this.port !== null;
  }

  follow(target: GameObject | null, lerpX = 0.1, lerpY = 0.1): void {
    this.port?.follow(target, lerpX, lerpY);
  }

  stopFollow(): void {
    this.port?.stopFollow();
  }

  setZoom(zoom: number): void {
    this.port?.setZoom(zoom);
  }

  getZoom(): number {
    return this.port?.getZoom() ?? 1;
  }

  setBounds(x: number, y: number, width: number, height: number): void {
    this.port?.setBounds(x, y, width, height);
  }

  setBackgroundColor(color: string | number): void {
    this.port?.setBackgroundColor(color);
  }

  getCenter(): Vec2 {
    return this.port?.getCenter() ?? { x: 0, y: 0 };
  }

  worldToScreen(x: number, y: number): Vec2 {
    return this.port?.worldToScreen(x, y) ?? { x, y };
  }

  shake(duration = 100, intensity = 0.01): void {
    this.port?.shake(duration, intensity);
  }

  fadeIn(duration = 300, red = 0, green = 0, blue = 0): void {
    this.port?.fadeIn(duration, red, green, blue);
  }

  fadeOut(duration = 300, red = 0, green = 0, blue = 0): void {
    this.port?.fadeOut?.(duration, red, green, blue);
  }

  flash(duration = 150, red = 255, green = 255, blue = 255): void {
    this.port?.flash?.(duration, red, green, blue);
  }

  resetEffects(): void {
    this.port?.resetEffects?.();
  }

  supportsEffects(): boolean {
    return typeof this.port?.flash === "function";
  }
}
