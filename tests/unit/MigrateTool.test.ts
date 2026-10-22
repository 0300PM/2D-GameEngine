import { describe, expect, it } from "vitest";
import { formatMigrationSummary, migrateProjectText, migrateSaveText, migrateText } from "../../packages/engine/src/project/MigrateTool";

const v1 = JSON.stringify({
  formatVersion: 1,
  name: "Demo",
  game: { width: 1280, height: 720 },
  assets: [
    { id: "player", type: "image", src: "player.png" },
    { id: "coin", type: "image", src: "coin.png" }
  ]
});

const save = (version: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version, playerId: "demo", slot: "auto", updatedAt: "2026-01-01T00:00:00.000Z", progress: { crystals: 3 }, ...extra });

describe("project migration", () => {
  it("migrates v1 to the current format and returns pretty JSON", () => {
    const result = migrateProjectText(v1);
    expect(result.ok).toBe(true);
    expect(result.from).toBe(1);
    expect(result.to).toBe(2);
    expect(result.applied).toEqual(["1->2"]);
    expect(JSON.parse(result.text as string).formatVersion).toBe(2);
    expect(result.text?.endsWith("\n")).toBe(true);
  });

  it("is idempotent on an already migrated project", () => {
    const once = migrateProjectText(v1);
    const twice = migrateProjectText(once.text as string);
    expect(twice.ok).toBe(true);
    expect(twice.applied).toEqual([]);
    expect(twice.text).toBe(once.text);
  });

  it("reports warnings without failing", () => {
    const result = migrateProjectText(v1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/^invalid-field @ |^size-unknown @ /);
  });

  it("refuses a project from a newer engine", () => {
    const result = migrateProjectText(JSON.stringify({ formatVersion: 99 }));
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("unsupported-version");
    expect(result.text).toBeNull();
  });

  it("refuses garbage without throwing", () => {
    for (const input of ["", "{", "[]", "null", "42", '"text"']) {
      const result = migrateProjectText(input);
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
    }
  });

  it("rejects a project whose asset has no licence when licences are required", () => {
    const result = migrateProjectText(v1, { requireLicenses: true });
    expect(result.ok).toBe(false);
    expect(result.errors.map((problem) => problem.code)).toContain("missing-license");
  });
});

describe("save migration", () => {
  it("keeps a current save untouched", () => {
    const result = migrateSaveText(save(1));
    expect(result.ok).toBe(true);
    expect(result.applied).toEqual([]);
    expect(JSON.parse(result.text as string).progress).toEqual({ crystals: 3 });
  });

  it("refuses a save from a newer build", () => {
    const result = migrateSaveText(save(9));
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("future-version");
  });

  it("refuses a save without a version", () => {
    const result = migrateSaveText(JSON.stringify({ progress: {} }));
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("invalid-version");
  });
});

describe("summary formatting", () => {
  it("describes each outcome in one line", () => {
    expect(formatMigrationSummary(migrateProjectText(v1))).toBe("project: 1 -> 2 (1->2)");
    expect(formatMigrationSummary(migrateSaveText(save(1)))).toBe("save: version 1, migration not required");
    expect(formatMigrationSummary(migrateProjectText("{"))).toContain("project: FAILED (invalid-json");
  });

  it("dispatches on the kind", () => {
    expect(migrateText(save(1), "save").kind).toBe("save");
    expect(migrateText(v1, "project").kind).toBe("project");
  });
});
