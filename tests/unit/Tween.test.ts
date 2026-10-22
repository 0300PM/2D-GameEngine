import { describe, expect, it, vi } from "vitest";
import { Tween } from "../../packages/engine/src/animation/Tween";
import { TweenManager } from "../../packages/engine/src/animation/TweenManager";

const target = (x = 0, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ x, ...extra });

describe("Tween", () => {
  it("interpolates a property over its duration", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1 });
    tween.update(0.5);
    expect(box.x).toBe(50);
    tween.update(0.25);
    expect(box.x).toBe(75);
    expect(tween.progress).toBeCloseTo(0.75, 6);
  });

  it("applies the final value when the duration runs out", () => {
    const box = target(10);
    const tween = Tween.to(box, { x: 30 }, { duration: 0.5 });
    const alive = tween.update(1);
    expect(alive).toBe(false);
    expect(box.x).toBe(30);
    expect(tween.isFinished).toBe(true);
  });

  it("uses the requested easing", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1, easing: "quadIn" });
    tween.update(0.5);
    expect(box.x).toBeCloseTo(25, 6);
  });

  it("honours the delay before touching the target", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1, delay: 0.5 });
    tween.update(0.25);
    expect(box.x).toBe(0);
    tween.update(0.5);
    expect(box.x).toBeCloseTo(25, 6);
  });

  it("carries leftover time into the tween after a delay", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1, delay: 0.5 });
    tween.update(0.75);
    expect(box.x).toBeCloseTo(25, 6);
  });

  it("repeats and reports every iteration", () => {
    const box = target(0);
    const onRepeat = vi.fn();
    const tween = Tween.to(box, { x: 100 }, { duration: 1, repeat: 1, onRepeat });
    tween.update(1);
    expect(box.x).toBe(100);
    expect(onRepeat).toHaveBeenCalledTimes(1);
    tween.update(1);
    expect(box.x).toBe(100);
    expect(tween.isFinished).toBe(true);
  });

  it("plays backwards on the yoyo iteration", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1, repeat: 1, yoyo: true });
    tween.update(1);
    expect(box.x).toBe(100);
    tween.update(0.5);
    expect(box.x).toBeCloseTo(50, 6);
    tween.update(0.5);
    expect(box.x).toBe(0);
    expect(tween.isFinished).toBe(true);
  });

  it("runs callbacks in order", () => {
    const events: string[] = [];
    const box = target(0);
    const tween = Tween.to(box, { x: 10 }, {
      duration: 0.5,
      onStart: () => events.push("start"),
      onUpdate: () => events.push("update"),
      onComplete: () => events.push("complete")
    });
    tween.update(0.5);
    expect(events[0]).toBe("start");
    expect(events[events.length - 1]).toBe("complete");
    expect(events.filter((entry) => entry === "update")).toHaveLength(1);
  });

  it("stops updating after cancel and reports the cancel", () => {
    const box = target(0);
    const onCancel = vi.fn();
    const onComplete = vi.fn();
    const tween = Tween.to(box, { x: 100 }, { duration: 1, onCancel, onComplete });
    tween.update(0.5);
    tween.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(tween.update(0.5)).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    expect(box.x).toBe(50);
    expect(tween.isCancelled).toBe(true);
  });

  it("freezes while paused and continues after resume", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1 });
    tween.update(0.25);
    tween.pause();
    expect(tween.update(0.5)).toBe(true);
    expect(box.x).toBe(25);
    tween.resume();
    tween.update(0.25);
    expect(box.x).toBe(50);
  });

  it("supports dotted paths", () => {
    const box = { transform: { scaleX: 1 } };
    const tween = Tween.to(box, { "transform.scaleX": 3 }, { duration: 1 });
    tween.update(0.5);
    expect(box.transform.scaleX).toBe(2);
  });

  it("rejects non-numeric targets", () => {
    expect(() => Tween.to({ x: "nope" }, { x: 1 })).toThrow(/non-numeric/);
  });

  it("jumps to the start values for a from-tween", () => {
    const box = target(50);
    const tween = Tween.from(box, { x: 0 }, { duration: 1 });
    tween.update(0);
    expect(box.x).toBe(0);
    tween.update(0.5);
    expect(box.x).toBe(25);
    tween.update(0.5);
    expect(box.x).toBe(50);
  });

  it("completes instantly with a zero duration", () => {
    const box = target(0);
    const onComplete = vi.fn();
    const tween = Tween.to(box, { x: 7 }, { duration: 0, onComplete });
    tween.update(0.016);
    expect(box.x).toBe(7);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reports how much time it consumed", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 0.2 });
    const result = tween.consume(0.5);
    expect(result.alive).toBe(false);
    expect(result.consumed).toBeCloseTo(0.2, 6);
  });

  it("forces the end value on complete()", () => {
    const box = target(0);
    const tween = Tween.to(box, { x: 100 }, { duration: 1 });
    tween.update(0.1);
    tween.complete();
    expect(box.x).toBe(100);
    expect(tween.isFinished).toBe(true);
  });

  it("exposes a snapshot of the current values", () => {
    const box = { x: 0, y: 0 };
    const tween = Tween.to(box, { x: 10, y: 20 }, { duration: 1 });
    tween.update(0.5);
    expect(tween.values).toEqual({ x: 5, y: 10 });
    tween.values.x = 999;
    expect(box.x).toBe(5);
  });
});

describe("TweenManager", () => {
  it("updates registered tweens and drops finished ones", () => {
    const manager = new TweenManager();
    const box = target(0);
    manager.to(box, { x: 10 }, { duration: 0.1 });
    expect(manager.size).toBe(1);
    manager.update(0.2);
    expect(box.x).toBe(10);
    expect(manager.size).toBe(0);
  });

  it("does nothing when the delta is zero", () => {
    const manager = new TweenManager();
    const box = target(0);
    manager.to(box, { x: 10 }, { duration: 1 });
    manager.update(0);
    expect(box.x).toBe(0);
    expect(manager.size).toBe(1);
  });

  it("fires a delayed callback exactly once", () => {
    const manager = new TweenManager();
    const callback = vi.fn();
    manager.delay(0.2, callback);
    manager.update(0.1);
    expect(callback).not.toHaveBeenCalled();
    manager.update(0.15);
    expect(callback).toHaveBeenCalledTimes(1);
    manager.update(0.15);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs sequence steps in order", () => {
    const box = target(0);
    const order: string[] = [];
    const manager = new TweenManager();
    manager.sequence([
      { target: box, props: { x: 10 }, duration: 0.1, onComplete: () => order.push("first") },
      { target: box, props: { x: 20 }, duration: 0.1, onComplete: () => order.push("second") }
    ]);
    manager.update(0.1);
    expect(order).toEqual(["first"]);
    expect(box.x).toBe(10);
    manager.update(0.1);
    expect(order).toEqual(["first", "second"]);
    expect(box.x).toBe(20);
    expect(manager.sequenceCount).toBe(0);
  });

  it("carries leftover delta into the next sequence step", () => {
    const box = target(0);
    const manager = new TweenManager();
    manager.sequence([
      { target: box, props: { x: 10 }, duration: 0.1 },
      { target: box, props: { x: 30 }, duration: 0.1 }
    ]);
    manager.update(0.15);
    expect(box.x).toBeCloseTo(20, 6);
  });

  it("repeats a sequence and reports completion", () => {
    const box = target(0);
    const onComplete = vi.fn();
    const manager = new TweenManager();
    manager.sequence([{ target: box, props: { x: 10 }, duration: 0.1 }], { repeat: 2, onComplete });
    manager.update(0.1);
    manager.update(0.1);
    expect(onComplete).not.toHaveBeenCalled();
    manager.update(0.1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(manager.sequenceCount).toBe(0);
  });

  it("rejects an empty sequence", () => {
    expect(() => new TweenManager().sequence([])).toThrow(/at least one step/);
  });

  it("cancels tweens and sequences by owner", () => {
    const manager = new TweenManager();
    const box = target(0);
    manager.to(box, { x: 10 }, { duration: 1, owner: "scene-a" });
    manager.to(box, { x: 20 }, { duration: 1, owner: "scene-b" });
    manager.sequence([{ target: box, props: { x: 30 }, duration: 1 }], { owner: "scene-a" });
    expect(manager.stopOwner("scene-a")).toBe(2);
    expect(manager.size).toBe(1);
    expect(manager.sequenceCount).toBe(0);
    expect(box.x).toBe(0);
  });

  it("pauses and resumes every tween", () => {
    const manager = new TweenManager();
    const box = target(0);
    manager.to(box, { x: 100 }, { duration: 1 });
    manager.update(0.25);
    manager.pause();
    manager.update(0.5);
    expect(box.x).toBe(25);
    manager.resume();
    manager.update(0.25);
    expect(box.x).toBe(50);
  });

  it("stops everything on stopAll", () => {
    const manager = new TweenManager();
    const box = target(0);
    manager.to(box, { x: 10 }, { duration: 1 });
    manager.sequence([{ target: box, props: { x: 20 }, duration: 1 }]);
    manager.stopAll();
    expect(manager.activeCount).toBe(0);
    manager.update(1);
    expect(box.x).toBe(0);
  });

  it("cancels a single tween", () => {
    const manager = new TweenManager();
    const box = target(0);
    const tween = manager.to(box, { x: 10 }, { duration: 1 });
    expect(manager.cancel(tween)).toBe(true);
    expect(manager.cancel(tween)).toBe(false);
    expect(manager.size).toBe(0);
  });
});
