import { describe, expect, it } from "vitest";
import { composeTransform, identityTransform } from "../../packages/engine/src/components/Transform";

describe("Transform composition", () => {
  it("keeps the child local transform when the parent is the identity", () => {
    const local = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 };
    expect(composeTransform(identityTransform(), local)).toEqual(local);
  });

  it("adds the parent translation", () => {
    const parent = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1 };
    const world = composeTransform(parent, { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(world.x).toBeCloseTo(110, 10);
    expect(world.y).toBeCloseTo(50, 10);
  });

  it("rotates and scales the local offset", () => {
    const parent = { x: 0, y: 0, rotation: Math.PI / 2, scaleX: 2, scaleY: 2 };
    const world = composeTransform(parent, { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(world.x).toBeCloseTo(0, 10);
    expect(world.y).toBeCloseTo(20, 10);
  });

  it("accumulates rotation and scale", () => {
    const parent = { x: 0, y: 0, rotation: 0.5, scaleX: 3, scaleY: 2 };
    const world = composeTransform(parent, { x: 0, y: 0, rotation: 0.25, scaleX: 2, scaleY: 0.5 });
    expect(world.rotation).toBeCloseTo(0.75, 10);
    expect(world.scaleX).toBeCloseTo(6, 10);
    expect(world.scaleY).toBeCloseTo(1, 10);
  });
});
