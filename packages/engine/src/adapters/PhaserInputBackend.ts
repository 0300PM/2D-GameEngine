import Phaser from "phaser";
import type { InputPort, PointerPatch } from "../core/ports";
import { resolveKeyCode } from "../systems/keyCodes";

export class PhaserInputBackend implements InputPort {
  private keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private disposers: Array<() => void> = [];

  constructor(private scene: Phaser.Scene) {}

  bindKeys(codes: readonly string[]): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    for (const code of codes) {
      if (this.keys.has(code)) continue;
      const keyCode = resolveKeyCode(code);
      if (keyCode === null) continue;
      this.keys.set(code, keyboard.addKey(keyCode, false));
    }
  }

  isKeyDown(code: string): boolean {
    return this.keys.get(code)?.isDown ?? false;
  }

  onPointer(handler: (patch: PointerPatch) => void): () => void {
    const push = (event: Phaser.Input.Pointer, isDown?: boolean) => {
      handler({
        x: event.x,
        y: event.y,
        worldX: event.worldX,
        worldY: event.worldY,
        button: event.button,
        ...(isDown === undefined ? {} : { isDown })
      });
    };
    const onMove = (event: Phaser.Input.Pointer) => push(event);
    const onDown = (event: Phaser.Input.Pointer) => push(event, true);
    const onUp = (event: Phaser.Input.Pointer) => push(event, false);
    this.scene.input.on("pointermove", onMove);
    this.scene.input.on("pointerdown", onDown);
    this.scene.input.on("pointerup", onUp);
    const dispose = () => {
      this.scene.input.off("pointermove", onMove);
      this.scene.input.off("pointerdown", onDown);
      this.scene.input.off("pointerup", onUp);
    };
    this.disposers.push(dispose);
    return dispose;
  }

  onBlur(handler: () => void): () => void {
    window.addEventListener("blur", handler);
    const dispose = () => window.removeEventListener("blur", handler);
    this.disposers.push(dispose);
    return dispose;
  }

  detach(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.scene.input.keyboard?.removeAllKeys(true);
    this.keys.clear();
  }
}
