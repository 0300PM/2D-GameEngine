import { describe, it, expect } from "vitest";
import { resolveKeyCode } from "../../packages/engine/src/systems/keyCodes";

describe("resolveKeyCode", () => {
  it("maps letter codes to Phaser key codes", () => {
    expect(resolveKeyCode("KeyW")).toBe(87);
    expect(resolveKeyCode("KeyA")).toBe(65);
    expect(resolveKeyCode("KeyD")).toBe(68);
    expect(resolveKeyCode("KeyE")).toBe(69);
  });

  it("maps arrows and space", () => {
    expect(resolveKeyCode("ArrowUp")).toBe(38);
    expect(resolveKeyCode("ArrowLeft")).toBe(37);
    expect(resolveKeyCode("ArrowDown")).toBe(40);
    expect(resolveKeyCode("ArrowRight")).toBe(39);
    expect(resolveKeyCode("Space")).toBe(32);
  });

  it("maps digits, modifiers and digits row", () => {
    expect(resolveKeyCode("Digit1")).toBe(49);
    expect(resolveKeyCode("Digit0")).toBe(48);
    expect(resolveKeyCode("ShiftLeft")).toBe(16);
    expect(resolveKeyCode("ShiftRight")).toBe(16);
    expect(resolveKeyCode("Escape")).toBe(27);
    expect(resolveKeyCode("Enter")).toBe(13);
  });

  it("returns null for unknown codes", () => {
    expect(resolveKeyCode("UnknownKey")).toBeNull();
    expect(resolveKeyCode("")).toBeNull();
  });
});

import { InputManager } from "../../packages/engine/src/systems/InputManager";
import { defaultInputMap } from "../../packages/engine/src/core/EngineConfig";
import { FakeInputPort } from "../helpers/harness";

describe("InputManager with an input port", () => {
  const build = () => {
    const manager = new InputManager(defaultInputMap);
    const port = new FakeInputPort();
    manager.attach(port);
    return { manager, port };
  };

  it("binds every mapped key exactly once", () => {
    const { port } = build();
    expect(new Set(port.bound).size).toBe(port.bound.length);
    expect(port.bound).toContain("KeyW");
    expect(port.bound).toContain("ArrowLeft");
    expect(port.bound).toContain("Space");
  });

  it("maps keys to actions with down, pressed and released edges", () => {
    const { manager, port } = build();

    port.press("KeyW");
    manager.update();
    expect(manager.isKeyDown("KeyW")).toBe(true);
    expect(manager.isKeyPressed("KeyW")).toBe(true);
    expect(manager.isActionDown("move-up")).toBe(true);

    manager.update();
    expect(manager.isKeyPressed("KeyW")).toBe(false);
    expect(manager.isActionDown("move-up")).toBe(true);

    port.release("KeyW");
    manager.update();
    expect(manager.isKeyReleased("KeyW")).toBe(true);
    expect(manager.isActionDown("move-up")).toBe(false);
  });

  it("tracks the pointer through port events", () => {
    const { manager, port } = build();
    port.movePointer({ x: 10, y: 20, worldX: 30, worldY: 40, isDown: true, button: 0 });

    expect(manager.getPointerPosition()).toEqual({ x: 10, y: 20 });
    expect(manager.getPointerWorldPosition()).toEqual({ x: 30, y: 40 });
    expect(manager.getPointer().isDown).toBe(true);
  });

  it("clears held keys when the window loses focus", () => {
    const { manager, port } = build();
    port.press("KeyD");
    manager.update();
    expect(manager.isActionDown("move-right")).toBe(true);

    port.release("KeyD");
    for (const handler of port.blurHandlers) handler();
    manager.update();
    expect(manager.isActionDown("move-right")).toBe(false);
  });

  it("remaps actions at runtime", () => {
    const { manager } = build();
    manager.remapAction("dash", ["ShiftLeft"]);
    expect(manager.getActionMap()["dash"]).toEqual(["ShiftLeft"]);
  });

  it("detaches cleanly", () => {
    const { manager, port } = build();
    manager.detach();
    expect(manager.isAttached()).toBe(false);
    expect(port.pointerHandlers).toHaveLength(0);
  });
});
