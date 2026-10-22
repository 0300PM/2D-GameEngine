import type { InputActionMap } from "../core/EngineConfig";
import type { InputPort, PointerPatch } from "../core/ports";

import { resolveKeyCode } from "./keyCodes";

export { resolveKeyCode } from "./keyCodes";

export type PointerState = {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  isDown: boolean;
  button: number;
};

const emptyPointer = (): PointerState => ({ x: 0, y: 0, worldX: 0, worldY: 0, isDown: false, button: 0 });

export class InputManager {
  private actionMap: InputActionMap;
  private keyDown = new Set<string>();
  private keyPressed = new Set<string>();
  private keyReleased = new Set<string>();
  private pointer: PointerState = emptyPointer();
  private port: InputPort | null = null;
  private disposers: Array<() => void> = [];

  constructor(actionMap: InputActionMap) {
    this.actionMap = { ...actionMap };
  }

  attach(port: InputPort): void {
    this.detach();
    this.port = port;
    this.bindKeys();
    this.disposers.push(
      port.onPointer((patch: PointerPatch) => {
        this.pointer = { ...this.pointer, ...patch };
      })
    );
    this.disposers.push(port.onBlur(() => this.keyDown.clear()));
  }

  detach(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.port?.detach();
    this.port = null;
    this.keyDown.clear();
    this.keyPressed.clear();
    this.keyReleased.clear();
    this.pointer = emptyPointer();
  }

  isAttached(): boolean {
    return this.port !== null;
  }

  update(): void {
    this.keyPressed.clear();
    this.keyReleased.clear();
    if (!this.port) return;
    for (const code of this.boundCodes()) {
      const isDown = this.port.isKeyDown(code);
      const wasDown = this.keyDown.has(code);
      if (isDown && !wasDown) {
        this.keyDown.add(code);
        this.keyPressed.add(code);
      } else if (!isDown && wasDown) {
        this.keyDown.delete(code);
        this.keyReleased.add(code);
      }
    }
  }

  isKeyDown(code: string): boolean {
    return this.keyDown.has(code);
  }

  isKeyPressed(code: string): boolean {
    return this.keyPressed.has(code);
  }

  isKeyReleased(code: string): boolean {
    return this.keyReleased.has(code);
  }

  isActionDown(action: string): boolean {
    const codes = this.actionMap[action];
    return codes ? codes.some((code) => this.isKeyDown(code)) : false;
  }

  isActionPressed(action: string): boolean {
    const codes = this.actionMap[action];
    return codes ? codes.some((code) => this.isKeyPressed(code)) : false;
  }

  isActionReleased(action: string): boolean {
    const codes = this.actionMap[action];
    return codes ? codes.some((code) => this.isKeyReleased(code)) : false;
  }

  getPointer(): PointerState {
    return { ...this.pointer };
  }

  getPointerPosition(): { x: number; y: number } {
    return { x: this.pointer.x, y: this.pointer.y };
  }

  getPointerWorldPosition(): { x: number; y: number } {
    return { x: this.pointer.worldX, y: this.pointer.worldY };
  }

  setActionMap(map: InputActionMap): void {
    this.actionMap = { ...map };
    this.keyDown.clear();
    if (this.port) this.bindKeys();
  }

  getActionMap(): InputActionMap {
    return { ...this.actionMap };
  }

  remapAction(action: string, codes: string[]): void {
    this.actionMap[action] = [...codes];
    this.keyDown.clear();
    if (this.port) this.bindKeys();
  }

  private boundCodes(): string[] {
    const codes = new Set<string>();
    for (const list of Object.values(this.actionMap)) {
      for (const code of list) codes.add(code);
    }
    return Array.from(codes);
  }

  private bindKeys(): void {
    if (!this.port) return;
    const codes = this.boundCodes().filter((code) => resolveKeyCode(code) !== null);
    this.port.bindKeys(codes);
  }
}
