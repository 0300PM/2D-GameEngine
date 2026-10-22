import { describe, expect, it } from "vitest";
import { validateProject } from "../../packages/engine/src/project/Validate";
import { createDefaultProject } from "../../packages/engine/src/project/Schema";

const base = () => ({
  formatVersion: 2,
  name: "Demo",
  settings: { width: 1280, height: 720, scaleMode: "fit", backgroundColor: "#151515" },
  assets: [{ id: "hero", type: "image", src: "/hero.png" }],
  scenes: [{ id: "game", objects: [{ id: "player", asset: "hero", x: 10, y: 20 }] }]
});

describe("validateProject", () => {
  it("accepts a valid project", () => {
    const result = validateProject(base());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.project?.scenes[0].objects[0].asset).toBe("hero");
  });

  it("creates a default project that validates", () => {
    const result = validateProject(createDefaultProject("New"));
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported versions with a migration hint", () => {
    const result = validateProject({ ...base(), formatVersion: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("unsupported-version");
    expect(result.errors[0].message).toContain("migrateProject");
  });

  it("validates settings fields", () => {
    const result = validateProject({ ...base(), settings: { width: 0, height: -1, scaleMode: "stretch", backgroundColor: "red" } });
    expect(result.valid).toBe(false);
    const paths = result.errors.map((entry) => entry.path);
    expect(paths).toContain("settings.width");
    expect(paths).toContain("settings.height");
    expect(paths).toContain("settings.scaleMode");
    expect(paths).toContain("settings.backgroundColor");
  });

  it("detects duplicate asset ids and duplicate scene ids", () => {
    const result = validateProject({
      ...base(),
      assets: [
        { id: "hero", type: "image", src: "/hero.png" },
        { id: "hero", type: "image", src: "/hero2.png" }
      ],
      scenes: [
        { id: "game", objects: [] },
        { id: "game", objects: [] }
      ]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.filter((entry) => entry.code === "duplicate-id")).toHaveLength(2);
  });

  it("rejects invalid asset ids and malformed scene ids", () => {
    const result = validateProject({
      ...base(),
      assets: [{ id: "Hero Asset", type: "image", src: "/hero.png" }],
      scenes: [{ id: "Game Scene", objects: [] }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.path)).toEqual(expect.arrayContaining(["assets[0].id", "scenes[0].id"]));
  });

  it("reports broken references between scenes and assets", () => {
    const result = validateProject({
      ...base(),
      scenes: [{ id: "game", objects: [{ id: "player", asset: "ghost" }] }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("broken-reference");
    expect(result.errors[0].message).toContain("ghost");
  });

  it("requires per-object unique ids", () => {
    const result = validateProject({
      ...base(),
      scenes: [{ id: "game", objects: [{ id: "a" }, { id: "a" }] }]
    });
    expect(result.errors.some((entry) => entry.code === "duplicate-id")).toBe(true);
  });

  it("validates body and numeric fields", () => {
    const result = validateProject({
      ...base(),
      scenes: [{ id: "game", objects: [{ id: "player", body: "kinematic", x: "ten" }] }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["scenes.game.objects.player.body", "scenes.game.objects.player.x"])
    );
  });

  it("preserves unknown root, settings, scene and object fields", () => {
    const result = validateProject({
      ...base(),
      editor: { grid: 16 },
      settings: { ...base().settings, renderer: "webgl" },
      scenes: [
        {
          id: "game",
          objects: [{ id: "player", asset: "hero", tuned: { speed: 120 } }],
          notes: "chapter one"
        }
      ]
    });
    expect(result.valid).toBe(true);
    const project = result.project!;
    expect(project.unknownFields).toEqual({ editor: { grid: 16 } });
    expect(project.settings.unknownFields).toEqual({ renderer: "webgl" });
    expect(project.scenes[0].unknownFields).toEqual({ notes: "chapter one" });
    expect(project.scenes[0].objects[0].unknownFields).toEqual({ tuned: { speed: 120 } });
  });

  it("warns when assets or scenes arrays are missing", () => {
    const result = validateProject({ formatVersion: 2, name: "x", settings: base().settings });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((entry) => entry.path)).toEqual(expect.arrayContaining(["assets", "scenes"]));
  });

  it("turns a missing licence into a blocking error when licences are required", () => {
    const result = validateProject(base(), { requireLicenses: true });
    expect(result.valid).toBe(false);
    expect(result.errors.some((entry) => entry.message.includes("license"))).toBe(true);
    expect(result.warnings.some((entry) => entry.message.includes("license"))).toBe(false);
  });

  it("leaves a missing licence as a warning by default", () => {
    const result = validateProject(base());
    expect(result.valid).toBe(true);
    expect(result.warnings.some((entry) => entry.message.includes("license"))).toBe(false);
  });
});
