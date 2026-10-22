import { afterEach, describe, expect, it } from "vitest";
import { DebugOverlay } from "../../packages/engine/src/systems/DebugOverlay";
import { formatMemory } from "../../packages/engine/src/systems/Memory";

const host = (): HTMLDivElement => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return element;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DebugOverlay", () => {
  it("stays out of the DOM until enabled", () => {
    const parent = host();
    const overlay = new DebugOverlay(false);
    overlay.mount(parent);
    expect(parent.querySelector("[data-b2d-overlay]")).toBeNull();
    overlay.setEnabled(true);
    expect(parent.querySelector("[data-b2d-overlay]")).not.toBeNull();
    overlay.setEnabled(false);
    expect(parent.querySelector("[data-b2d-overlay]")).toBeNull();
    overlay.destroy();
  });

  it("renders fps, frame times, counts, memory and profile lines", () => {
    const parent = host();
    const overlay = new DebugOverlay(true);
    overlay.mount(parent);
    overlay.setActiveScene("game");
    overlay.setStats({
      deltaTime: 16.7,
      realDeltaTime: 33.4,
      objects: 80,
      bodies: 12,
      colliders: 3,
      timeScale: 1,
      audio: "on · 1 h · 0 q",
      profile: [{ name: "update", ms: 0.4 }]
    });
    overlay.update(1000);

    const lines = overlay.getLines();
    expect(lines[0]).toContain("fps");
    expect(lines[1]).toContain("frame 33.4 ms → 16.7 ms · x1.00");
    expect(lines[2]).toBe("scene game · 80 objects · 12 bodies · 3 pairs");
    expect(lines[3]).toContain("memory");
    expect(lines[4]).toContain("audio on · 1 h · 0 q");
    expect(lines[5]).toContain("prof update");

    const text = parent.querySelector("[data-b2d-overlay]")?.textContent ?? "";
    expect(text).toContain("80 objects");
    expect(text).toContain("scene game");
  });

  it("computes fps from the sampling window", () => {
    const parent = host();
    const overlay = new DebugOverlay(true);
    overlay.mount(parent);
    for (let frame = 0; frame < 130; frame += 1) overlay.update(frame * 8);
    expect(overlay.getFps()).toBeGreaterThan(50);
    expect(overlay.getFps()).toBeLessThan(200);
  });

  it("appends extra lines and supports custom labels", () => {
    const parent = host();
    const overlay = new DebugOverlay(true, { objects: "obiekty", scene: "scena", paused: "pauza" });
    overlay.mount(parent);
    overlay.setExtra(["custom line"]);
    overlay.setStats({ objects: 4, paused: true });
    const lines = overlay.getLines();
    expect(lines[2]).toContain("4 obiekty");
    expect(lines[2]).toContain("scena");
    expect(lines[0]).toContain("pauza");
    expect(lines[lines.length - 1]).toBe("custom line");
  });

  it("clears state on destroy and detaches from the DOM", () => {
    const parent = host();
    const overlay = new DebugOverlay(true);
    overlay.mount(parent);
    overlay.setExtra(["x"]);
    overlay.destroy();
    expect(parent.querySelector("[data-b2d-overlay]")).toBeNull();
    expect(overlay.isEnabled()).toBe(false);
    expect(overlay.getLines()).toHaveLength(4);
  });

  it("formats memory with a stable fallback", () => {
    expect(formatMemory(null)).toBe("n/a");
    expect(formatMemory({ used: 4 * 1024 * 1024, total: 8 * 1024 * 1024, limit: 2048 * 1024 * 1024, source: "performance.memory" })).toBe(
      "4.0 MB / 2048.0 MB"
    );
  });
});
