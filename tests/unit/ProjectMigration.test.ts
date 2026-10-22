import { describe, expect, it } from "vitest";
import { migrateProject } from "../../packages/engine/src/project/Migrate";
import { validateProject } from "../../packages/engine/src/project/Validate";
import { checksum, exportProject, importProject, importProjectValue } from "../../packages/engine/src/project/Serialize";
import { createDefaultProject } from "../../packages/engine/src/project/Schema";

const v1 = () => ({
  formatVersion: 1,
  name: "Legacy",
  game: { width: 800, height: 600, scaleMode: "fit", backgroundColor: "#101010", renderer: "webgl" },
  assets: [{ id: "hero", type: "image", src: "/hero.png" }],
  editor: { zoom: 2 }
});

describe("migrateProject", () => {
  it("migrates version 1 to version 2", () => {
    const result = migrateProject(v1());
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual(["1->2"]);
    expect(result.project?.formatVersion).toBe(2);
    expect(result.project?.settings).toMatchObject({ width: 800, height: 600, backgroundColor: "#101010" });
    expect(result.project?.assets).toHaveLength(1);
    expect(result.project?.scenes).toEqual([]);
  });

  it("keeps unknown fields during migration", () => {
    const result = migrateProject(v1());
    expect(result.project?.unknownFields).toEqual({ editor: { zoom: 2 } });
    expect(result.project?.settings.unknownFields).toEqual({ renderer: "webgl" });
  });

  it("produces a project that passes validation", () => {
    const result = migrateProject(v1());
    const validation = validateProject(result.project);
    expect(validation.valid).toBe(true);
  });

  it("leaves version 2 untouched", () => {
    const project = createDefaultProject("Current");
    const result = migrateProject(project);
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual([]);
    expect(result.project).toEqual(project);
  });

  it("refuses projects from a newer engine", () => {
    const result = migrateProject({ ...createDefaultProject("Future"), formatVersion: 99 });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("unsupported-version");
    expect(result.original).toBeDefined();
  });

  it("refuses non-objects and missing versions", () => {
    expect(migrateProject("nope").ok).toBe(false);
    expect(migrateProject({ name: "x" }).errors[0].message).toContain("formatVersion");
  });

  it("rejects migrated projects with duplicate asset ids", () => {
    const result = migrateProject({
      ...v1(),
      assets: [
        { id: "hero", type: "image", src: "/a.png" },
        { id: "hero", type: "image", src: "/b.png" }
      ]
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("duplicate-id");
  });
});

describe("project serialization", () => {
  it("wraps projects in a checksummed envelope", () => {
    const project = createDefaultProject("Envelope");
    const text = exportProject(project);
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe("browser2d-project");
    expect(parsed.checksum).toBe(checksum(project));
    expect(importProject(text).valid).toBe(true);
  });

  it("detects tampering through the checksum", () => {
    const project = createDefaultProject("Tamper");
    const parsed = JSON.parse(exportProject(project));
    parsed.project.name = "Changed";
    const result = importProjectValue(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("checksum-mismatch");
  });

  it("can skip checksum verification on purpose", () => {
    const project = createDefaultProject("Tamper");
    const parsed = JSON.parse(exportProject(project));
    parsed.project.name = "Changed";
    expect(importProjectValue(parsed, { verifyChecksum: false }).valid).toBe(true);
  });

  it("imports bare projects without an envelope", () => {
    const project = createDefaultProject("Bare");
    expect(importProject(JSON.stringify(project)).valid).toBe(true);
  });

  it("migrates during import and reports applied steps", () => {
    const result = importProjectValue(v1());
    expect(result.valid).toBe(true);
    expect(result.migrated).toEqual(["1->2"]);
    expect(result.project?.name).toBe("Legacy");
  });

  it("reports invalid JSON without throwing", () => {
    const result = importProject("{oops");
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("invalid-json");
  });

  it("is insensitive to key order when computing checksums", () => {
    const first = { b: 2, a: 1 };
    const second = { a: 1, b: 2 };
    expect(checksum(first)).toBe(checksum(second));
  });
});
