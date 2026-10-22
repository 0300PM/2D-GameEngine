import { describe, expect, it } from "vitest";
import { AssetManifest, DEFAULT_SIZE_LIMITS, animationKey, formatBytes, isValidAssetId } from "../../packages/engine/src/assets/AssetManifest";

describe("AssetManifest", () => {
  it("accepts stable ids and rejects malformed ones", () => {
    expect(isValidAssetId("hero")).toBe(true);
    expect(isValidAssetId("ui.menu_button-2")).toBe(true);
    expect(isValidAssetId("Hero")).toBe(false);
    expect(isValidAssetId("2hero")).toBe(false);
    expect(isValidAssetId("hero icon")).toBe(false);
    expect(isValidAssetId("")).toBe(false);
  });

  it("registers assets and exposes them by id", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png" }]);
    expect(manifest.count()).toBe(1);
    expect(manifest.has("hero")).toBe(true);
    expect(manifest.get("hero")?.src).toBe("/hero.png");
    expect(manifest.ids()).toEqual(["hero"]);
  });

  it("refuses duplicate ids", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png" }]);
    expect(() => manifest.register({ id: "hero", type: "image", src: "/other.png" })).toThrow(/Duplicate asset id/);
  });

  it("refuses descriptors without id or src", () => {
    const manifest = new AssetManifest();
    expect(() => manifest.register({ id: "", type: "image", src: "/a.png" })).toThrow(/id/);
    expect(() => manifest.register({ id: "a", type: "image", src: "" })).toThrow(/src/);
  });

  it("freezes descriptors so ids cannot drift at runtime", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png", animations: [{ key: "walk", frames: [0, 1] }] }]);
    const descriptor = manifest.get("hero")!;
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.animations)).toBe(true);
  });

  it("reports invalid ids, types and fields", () => {
    const manifest = new AssetManifest([
      { id: "Bad Id", type: "image", src: "/a.png" },
      { id: "broken", type: "nope" as never, src: "/b.png" },
      { id: "sheet", type: "spritesheet", src: "/c.png" },
      { id: "atlas", type: "atlas", src: "/d.png" }
    ]);
    const codes = manifest.validate().map((entry) => entry.code);
    expect(codes).toContain("invalid-id");
    expect(codes).toContain("unsupported-type");
    expect(codes).toContain("invalid-field");
  });

  it("warns about duplicate sources", () => {
    const manifest = new AssetManifest([
      { id: "hero", type: "image", src: "/shared.png" },
      { id: "hero-alias", type: "image", src: "/shared.png" }
    ]);
    const duplicate = manifest.validate().find((entry) => entry.code === "duplicate-src");
    expect(duplicate?.severity).toBe("warning");
    expect(duplicate?.message).toContain("hero-alias");
  });

  it("warns about absolute urls that break offline builds", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "https://example.com/hero.png" }]);
    expect(manifest.validate().map((entry) => entry.code)).toContain("external-url");
  });

  it("validates animation frames against the declared frame count", () => {
    const manifest = new AssetManifest([
      {
        id: "hero",
        type: "spritesheet",
        src: "/hero.png",
        frameWidth: 32,
        frameHeight: 32,
        frameCount: 4,
        animations: [{ key: "walk", frames: [0, 1, 9], frameRate: 8 }]
      }
    ]);
    const frames = manifest.validate().filter((entry) => entry.code === "frame-out-of-range");
    expect(frames).toHaveLength(1);
    expect(frames[0].message).toContain("9");
  });

  it("rejects duplicate animation keys and empty frame lists", () => {
    const manifest = new AssetManifest([
      {
        id: "hero",
        type: "spritesheet",
        src: "/hero.png",
        frameWidth: 32,
        frameHeight: 32,
        animations: [
          { key: "walk", frames: [0] },
          { key: "walk", frames: [1] },
          { key: "idle", frames: [] }
        ]
      }
    ]);
    const codes = manifest.validate().map((entry) => entry.code);
    expect(codes).toContain("duplicate-animation");
    expect(codes.filter((code) => code === "invalid-field").length).toBeGreaterThan(0);
  });

  it("exposes animations with namespaced keys", () => {
    const manifest = new AssetManifest([
      { id: "hero", type: "spritesheet", src: "/h.png", frameWidth: 16, frameHeight: 16, animations: [{ key: "walk", frames: [0, 1] }] }
    ]);
    const animations = manifest.animations();
    expect(animations).toHaveLength(1);
    expect(animations[0].key).toBe("hero:walk");
    expect(animationKey("hero", "walk")).toBe("hero:walk");
  });

  it("detects broken references between assets", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png" }]);
    const issues = manifest.checkReferences({ "scene:game": ["hero", "missing"], "scene:menu": ["hero"] });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("broken-reference");
    expect(issues[0].message).toContain("missing");
  });

  it("computes a size report with heavy asset warnings", () => {
    const manifest = new AssetManifest([
      { id: "hero", type: "image", src: "/hero.png", bytes: 1200 },
      { id: "music", type: "audio", src: "/music.mp3", bytes: 3 * 1024 * 1024 },
      { id: "huge", type: "image", src: "/huge.png", bytes: 2 * 1024 * 1024 },
      { id: "unknown", type: "json", src: "/data.json" }
    ]);
    const report = manifest.sizeReport();
    expect(report.knownAssets).toBe(3);
    expect(report.unknownAssets).toBe(1);
    expect(report.totalBytes).toBeGreaterThan(DEFAULT_SIZE_LIMITS.imageBytes);
    expect(report.byType.audio).toBe(3 * 1024 * 1024);
    expect(report.assets[0].bytes).toBe(3 * 1024 * 1024);
    const heavy = report.issues.filter((entry) => entry.code === "heavy-asset");
    expect(heavy.length).toBe(2);
    expect(report.issues.map((entry) => entry.code)).toContain("size-unknown");
  });

  it("respects custom size limits", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png", bytes: 5000 }]);
    expect(manifest.sizeReport().issues).toHaveLength(0);
    expect(manifest.sizeReport({ imageBytes: 1000 }).issues[0].code).toBe("heavy-asset");
  });

  it("flags missing licenses only when asked", () => {
    const manifest = new AssetManifest([{ id: "hero", type: "image", src: "/hero.png" }]);
    expect(manifest.validate().some((entry) => entry.code === "missing-license")).toBe(false);
    expect(manifest.validate({ requireLicenses: true }).some((entry) => entry.code === "missing-license")).toBe(true);
  });

  it("groups assets and removes them", () => {
    const manifest = new AssetManifest([
      { id: "hero", type: "image", src: "/h.png", group: "world" },
      { id: "menu", type: "image", src: "/m.png", group: "ui" }
    ]);
    expect(manifest.groups()).toEqual(["ui", "world"]);
    expect(manifest.byGroup("world").map((entry) => entry.id)).toEqual(["hero"]);
    expect(manifest.remove("hero")).toBe(true);
    expect(manifest.count()).toBe(1);
  });

  it("formats byte sizes for reports", () => {
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(2048)).toBe("2.0 kB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB");
  });
});
