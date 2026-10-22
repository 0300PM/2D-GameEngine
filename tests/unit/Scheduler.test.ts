import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../../packages/engine/src/systems/Scheduler";
import { Timer } from "../../packages/engine/src/systems/Timer";

describe("Scheduler", () => {
  it("fires a delay once after enough time", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.delay(0.1, callback);
    scheduler.update(0.05);
    expect(callback).not.toHaveBeenCalled();
    scheduler.update(0.05);
    expect(callback).toHaveBeenCalledTimes(1);
    scheduler.update(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs an interval repeatedly", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.interval(0.1, callback);
    for (let index = 0; index < 5; index += 1) scheduler.update(0.1);
    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("honours the repeat limit", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.interval(0.1, callback, { repeat: 2 });
    for (let index = 0; index < 10; index += 1) scheduler.update(0.1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(scheduler.count()).toBe(0);
  });

  it("caps catch-up work per frame", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.interval(0.001, callback);
    scheduler.update(10);
    expect(callback.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("can be cancelled before firing", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    const handle = scheduler.delay(0.1, callback);
    handle.cancel();
    expect(handle.cancelled).toBe(true);
    scheduler.update(1);
    expect(callback).not.toHaveBeenCalled();
    expect(scheduler.has(handle.id)).toBe(false);
  });

  it("cancels every task of an owner", () => {
    const scheduler = new Scheduler();
    const first = vi.fn();
    const second = vi.fn();
    scheduler.delay(0.1, first, { owner: "scene:a" });
    scheduler.delay(0.1, second, { owner: "scene:b" });
    expect(scheduler.cancelOwner("scene:a")).toBe(1);
    scheduler.update(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps running when a callback throws", () => {
    const scheduler = new Scheduler();
    const onError = vi.fn();
    const after = vi.fn();
    scheduler.delay(0.1, () => {
      throw new Error("boom");
    }, { onError });
    scheduler.delay(0.1, after);
    scheduler.update(0.1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(scheduler.errorCount).toBe(1);
  });

  it("rejects invalid durations", () => {
    const scheduler = new Scheduler();
    expect(() => scheduler.delay(-1, () => undefined)).toThrow();
    expect(() => scheduler.delay(Number.POSITIVE_INFINITY, () => undefined)).toThrow();
  });

  it("ignores non-positive updates", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.delay(0.1, callback);
    scheduler.update(0);
    scheduler.update(-1);
    expect(callback).not.toHaveBeenCalled();
  });

  it("clears everything", () => {
    const scheduler = new Scheduler();
    const callback = vi.fn();
    scheduler.delay(0.1, callback, { owner: "x" });
    scheduler.clear();
    expect(scheduler.count()).toBe(0);
    scheduler.update(1);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("Timer", () => {
  it("scopes tasks to its owner", () => {
    const scheduler = new Scheduler();
    const timer = new Timer(scheduler, "scene:game");
    const callback = vi.fn();
    timer.delay(0.1, callback);
    expect(timer.pending).toBe(1);
    expect(scheduler.cancelOwner("scene:game")).toBe(1);
    scheduler.update(1);
    expect(callback).not.toHaveBeenCalled();
    expect(timer.pending).toBe(0);
  });

  it("clears only its own tasks", () => {
    const scheduler = new Scheduler();
    const game = new Timer(scheduler, "scene:game");
    const menu = new Timer(scheduler, "scene:menu");
    game.delay(1, () => undefined);
    menu.delay(1, () => undefined);
    expect(game.clear()).toBe(1);
    expect(menu.pending).toBe(1);
  });

  it("forwards repeat limits", () => {
    const scheduler = new Scheduler();
    const timer = new Timer(scheduler, "scene:game");
    const callback = vi.fn();
    timer.interval(0.1, callback, { repeat: 1 });
    scheduler.update(0.1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(timer.pending).toBe(0);
  });

  it("cancels a handle", () => {
    const scheduler = new Scheduler();
    const timer = new Timer(scheduler, "scene:game");
    const callback = vi.fn();
    const handle = timer.delay(0.5, callback);
    timer.cancel(handle);
    scheduler.update(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
