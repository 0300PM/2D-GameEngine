import { describe, it, expect } from "vitest";
import { validateProjectConfig, parseProjectJson } from "../../packages/engine/src/project-format/ProjectFormat";

describe("ProjectFormat", () => {
  it("validates correct config", () => {
    const cfg = {
      formatVersion: 1,
      name: "TopDownDemo",
      game: { width: 1280, height: 720, scaleMode: "fit", backgroundColor: "#151515" },
      assets: [{ id: "player", type: "image", src: "/assets/player.png" }]
    };
    const r = validateProjectConfig(cfg);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("detects missing name", () => {
    const r = validateProjectConfig({ formatVersion: 1, game: { width: 100, height: 100, scaleMode: "fit", backgroundColor: "#000000" } });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("name"))).toBe(true);
  });
  it("detects unsupported version", () => {
    const r = validateProjectConfig({ formatVersion: 99, name: "x", game: { width: 100, height: 100, scaleMode: "fit", backgroundColor: "#000000" } });
    expect(r.valid).toBe(false);
  });
  it("detects duplicate asset id", () => {
    const cfg = {
      formatVersion: 1,
      name: "t",
      game: { width: 100, height: 100, scaleMode: "fit", backgroundColor: "#000" },
      assets: [
        { id: "a", type: "image", src: "/a.png" },
        { id: "a", type: "image", src: "/b.png" }
      ]
    };
    const r = validateProjectConfig(cfg);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });
  it("parses JSON string", () => {
    const json = JSON.stringify({ formatVersion: 1, name: "t", game: { width: 100, height: 100, scaleMode: "fit", backgroundColor: "#000000" }, assets: [] });
    const r = parseProjectJson(json);
    expect(r.valid).toBe(true);
  });
  it("fails on invalid JSON", () => {
    const r = parseProjectJson("{bad}");
    expect(r.valid).toBe(false);
  });
});
