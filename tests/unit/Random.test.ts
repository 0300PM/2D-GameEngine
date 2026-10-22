import { describe, expect, it } from "vitest";
import { Random } from "../../packages/engine/src/core/Random";

describe("Random", () => {
  it("reproduces the same sequence for the same seed", () => {
    const first = new Random(42);
    const second = new Random(42);
    const a = Array.from({ length: 8 }, () => first.next());
    const b = Array.from({ length: 8 }, () => second.next());
    expect(a).toEqual(b);
  });

  it("produces different sequences for different seeds", () => {
    const first = new Random(1);
    const second = new Random(2);
    expect(first.next()).not.toBe(second.next());
  });

  it("stays inside the unit range", () => {
    const random = new Random(7);
    for (let index = 0; index < 1000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("returns floats inside inclusive bounds", () => {
    const random = new Random(3);
    for (let index = 0; index < 200; index += 1) {
      const value = random.float(-2, 5);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("returns integers inside inclusive bounds", () => {
    const random = new Random(11);
    const seen = new Set<number>();
    for (let index = 0; index < 500; index += 1) seen.add(random.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("picks from a collection and rejects empty input", () => {
    const random = new Random(5);
    const items = ["a", "b", "c"] as const;
    expect(items).toContain(random.pick(items));
    expect(() => random.pick([])).toThrow();
  });

  it("shuffles without mutating the source", () => {
    const random = new Random(9);
    const source = [1, 2, 3, 4, 5];
    const shuffled = random.shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("restores a saved state", () => {
    const random = new Random(21);
    random.next();
    const state = random.saveState();
    const expected = random.next();
    random.loadState(state);
    expect(random.next()).toBe(expected);
  });

  it("resets to the initial seed", () => {
    const random = new Random(33);
    const first = random.next();
    random.next();
    random.reset();
    expect(random.next()).toBe(first);
  });

  it("forks deterministically and independently", () => {
    const random = new Random(4);
    const a = random.fork("enemy");
    const b = random.fork("enemy");
    expect(a.next()).toBe(b.next());
    expect(random.seed).toBe(4);
  });

  it("rejects inverted bounds", () => {
    const random = new Random(1);
    expect(() => random.float(5, 1)).toThrow();
    expect(() => random.int(5, 1)).toThrow();
  });

  it("supports boolean and sign helpers", () => {
    const random = new Random(13);
    expect(typeof random.bool()).toBe("boolean");
    expect([-1, 1]).toContain(random.sign());
  });
});
