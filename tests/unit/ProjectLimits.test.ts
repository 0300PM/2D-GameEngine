import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_LIMITS, byteLength, findUnsafeKey, measureDepth, mergeLimits } from "../../packages/engine/src/project/Limits";
import { validateProject } from "../../packages/engine/src/project/Validate";
import { importProject } from "../../packages/engine/src/project/Serialize";
import type { ProjectFormatV2 } from "../../packages/engine/src/project/Schema";
import type { ProjectLimits } from "../../packages/engine/src/project/Limits";

const base = (patch: Partial<ProjectFormatV2> = {}): ProjectFormatV2 => ({
  formatVersion: 2,
  name: "Limits",
  settings: { width: 1280, height: 720, scaleMode: "fit", backgroundColor: "#101010" },
  assets: [{ id: "player", type: "image" as const, src: "player.png", license: { name: "CC0" } }],
  scenes: [{ id: "main", objects: [{ id: "player", asset: "player", x: 1, y: 2 }] }],
  ...patch
});

const codes = (input: unknown, limits?: Partial<ProjectLimits>) =>
  validateProject(input, { requireLicenses: true, limits }).errors.map((entry) => entry.code);

describe("project limits", () => {
  it("accepts a project inside the defaults", () => {
    expect(validateProject(base(), { requireLicenses: true }).valid).toBe(true);
  });

  it("merges partial limits and ignores invalid values", () => {
    const limits = mergeLimits({ maxScenes: 3, maxAssets: -1, maxObjects: Number.NaN });
    expect(limits.maxScenes).toBe(3);
    expect(limits.maxAssets).toBe(DEFAULT_PROJECT_LIMITS.maxAssets);
    expect(limits.maxObjects).toBe(DEFAULT_PROJECT_LIMITS.maxObjects);
  });

  it("rejects too many scenes", () => {
    const scene = { id: "main", objects: [] };
    expect(codes(base({ scenes: [scene, { ...scene, id: "second" }, { ...scene, id: "third" }] }), { maxScenes: 2 })).toContain(
      "limit-exceeded"
    );
  });

  it("rejects too many objects in one scene", () => {
    const objects = Array.from({ length: 5 }, (_, index) => ({ id: `o${index}` }));
    expect(codes(base({ scenes: [{ id: "main", objects }] }), { maxObjectsPerScene: 3 })).toContain("limit-exceeded");
  });

  it("rejects too many objects in total", () => {
    const scene = (id: string) => ({ id, objects: Array.from({ length: 3 }, (_, i) => ({ id: `o${i}` })) });
    expect(codes(base({ scenes: [scene("a"), scene("b")] }), { maxObjects: 4 })).toContain("limit-exceeded");
  });

  it("rejects too many assets", () => {
    const assets = Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, type: "image" as const, src: `a${i}.png`, license: { name: "CC0" } }));
    expect(codes(base({ assets }), { maxAssets: 2 })).toContain("limit-exceeded");
  });

  it("rejects an over-long id", () => {
    const scenes = [{ id: "main", objects: [{ id: "x".repeat(40) }] }];
    expect(codes(base({ scenes }), { maxIdLength: 16 })).toContain("limit-exceeded");
  });

  it("rejects an over-long text field", () => {
    const scenes = [{ id: "main", objects: [{ id: "label", text: "y".repeat(50) }] }];
    expect(codes(base({ scenes }), { maxStringLength: 32 })).toContain("limit-exceeded");
  });

  it("rejects too many tags", () => {
    const scenes = [{ id: "main", objects: [{ id: "label", tags: ["a", "b", "c"] }] }];
    expect(codes(base({ scenes }), { maxTagsPerObject: 2 })).toContain("limit-exceeded");
  });

  it("rejects too many properties", () => {
    const scenes = [{ id: "main", objects: [{ id: "label", properties: { a: 1, b: 2, c: 3 } }] }];
    expect(codes(base({ scenes }), { maxPropertiesPerRecord: 2 })).toContain("limit-exceeded");
  });

  it("rejects coordinates outside the supported range", () => {
    const scenes = [{ id: "main", objects: [{ id: "far", x: 2_000_000 }] }];
    expect(codes(base({ scenes }), { maxCoordinate: 1_000 })).toContain("limit-exceeded");
  });

  it("rejects non-finite coordinates", () => {
    const scenes = [{ id: "main", objects: [{ id: "nan", x: Number.POSITIVE_INFINITY }] }];
    expect(codes(base({ scenes }))).toContain("invalid-field");
  });

  it("rejects an over-long action name and too many bindings", () => {
    const settings = { ...base().settings, inputMap: { a: ["KeyA", "KeyB"], b: ["KeyC"] } };
    expect(codes(base({ settings }), { maxKeysPerAction: 1 })).toContain("limit-exceeded");
    const longName = { ...base().settings, inputMap: { ["x".repeat(40)]: ["KeyA"] } };
    expect(codes(base({ settings: longName }), { maxIdLength: 12 })).toContain("limit-exceeded");
  });

  it("rejects too many actions", () => {
    const inputMap = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`a${i}`, ["KeyA"]]));
    expect(codes(base({ settings: { ...base().settings, inputMap } }), { maxInputActions: 3 })).toContain("limit-exceeded");
  });

  it("blocks prototype pollution keys", () => {
    const payload = JSON.parse('{"formatVersion":2,"name":"x","settings":{},"assets":[],"scenes":[],"__proto__":{"polluted":true}}');
    const result = validateProject(payload);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("unsafe-key");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects nesting deeper than the limit", () => {
    const deep = base({ unknownFields: { a: { b: { c: { d: { e: 1 } } } } } });
    expect(codes(deep, { maxDepth: 4 })).toContain("limit-exceeded");
  });

  it("measures depth and finds unsafe keys", () => {
    expect(measureDepth({ a: { b: 1 } })).toBe(2);
    expect(measureDepth([{ a: [1, 2] }])).toBe(3);
    expect(findUnsafeKey({ a: { b: 1 } })).toBeNull();
    expect(findUnsafeKey({ a: [{ constructor: 1 }] })).toBe("a[0].constructor");
  });
});

describe("project import guards", () => {
  it("rejects payloads over the byte limit before parsing", () => {
    const text = JSON.stringify(base()).padEnd(4096, " ");
    const result = importProject(text, { limits: { maxBytes: 1024 } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("limit-exceeded");
  });

  it("counts bytes, not characters", () => {
    expect(byteLength("ąćę")).toBeGreaterThan(3);
    expect(byteLength("abc")).toBe(3);
  });

  it("reports invalid JSON without throwing", () => {
    const result = importProject("{ not json");
    expect(result.errors[0]?.code).toBe("invalid-json");
  });

  it("still imports a valid envelope", () => {
    const result = importProject(JSON.stringify(base()), { requireLicenses: true });
    expect(result.valid).toBe(true);
    expect(result.migrated).toEqual([]);
  });

  it("applies limits after a migration", () => {
    const v1 = { formatVersion: 1, name: "Old", game: { width: 800, height: 600 }, assets: [], scenes: [] };
    const result = importProject(JSON.stringify(v1), { limits: { maxScenes: 100 } });
    expect(result.migrated).toEqual(["1->2"]);
    expect(result.valid).toBe(true);
  });
});
