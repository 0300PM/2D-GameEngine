import { describe, it, expect } from "vitest";
import { Scene } from "../../packages/engine/src/core/Scene";
import { SceneManager } from "../../packages/engine/src/core/SceneManager";
import { EventBus } from "../../packages/engine/src/systems/EventBus";
import { Logger } from "../../packages/engine/src/systems/Logger";

class DummyScene extends Scene {
  constructor(id: string) { super(id); }
  create(): void {}
}

describe("Engine lifecycle", () => {
  it("registers duplicate scene throws", () => {
    const logger = new Logger("test", "error");
    const events = new EventBus();
    const mgr = new SceneManager(logger, events);
    mgr.register(new DummyScene("a"));
    expect(() => mgr.register(new DummyScene("a"))).toThrow();
  });
  it("reports active scene", () => {
    const logger = new Logger("test", "error");
    const events = new EventBus();
    const mgr = new SceneManager(logger, events);
    mgr.register(new DummyScene("menu"));
    mgr.register(new DummyScene("game"));
    expect(mgr.list()).toEqual(["menu", "game"]);
    expect(mgr.has("game")).toBe(true);
    expect(mgr.getActiveSceneId()).toBeNull();
  });
});
