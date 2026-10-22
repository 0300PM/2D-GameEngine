import { describe, it, expect } from "vitest";
import { EventBus } from "../../packages/engine/src/systems/EventBus";

describe("EventBus", () => {
  it("emits to subscribers", () => {
    const bus = new EventBus();
    let got = 0;
    bus.on("test", (p: number) => (got = p as number));
    bus.emit("test", 42);
    expect(got).toBe(42);
  });
  it("unsubscribes", () => {
    const bus = new EventBus();
    let c = 0;
    const off = bus.on("ev", () => c++);
    off();
    bus.emit("ev", null);
    expect(c).toBe(0);
  });
  it("clears scene subscriptions", () => {
    const bus = new EventBus();
    let c = 0;
    bus.subscribeForScene("sceneA", "ev", () => c++);
    bus.emit("ev", null);
    expect(c).toBe(1);
    bus.clearScene("sceneA");
    bus.emit("ev", null);
    expect(c).toBe(1);
  });
});
