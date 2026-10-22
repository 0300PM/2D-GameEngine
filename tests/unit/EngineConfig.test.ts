import { describe, it, expect } from "vitest";
import { validateEngineConfig, resolveEngineConfig } from "../../packages/engine/src/core/EngineConfig";

describe("EngineConfig", () => {
  it("validates missing parent", () => {
    const errors = validateEngineConfig({});
    expect(errors.some((e) => e.includes("parent"))).toBe(true);
  });
  it("validates width", () => {
    const errors = validateEngineConfig({ parent: "app", width: -5 });
    expect(errors.some((e) => e.includes("width"))).toBe(true);
  });
  it("resolves defaults", () => {
    const cfg = resolveEngineConfig({ parent: "app", width: 800, height: 600 });
    expect(cfg.width).toBe(800);
    expect(cfg.backgroundColor).toBe("#151515");
    expect(cfg.scaleMode).toBe("fit");
  });
  it("throws on invalid", () => {
    expect(() => resolveEngineConfig({ parent: "", width: 800, height: 600 } as never)).toThrow();
  });
});
