import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — narzędzie CLI bez deklaracji typów
import { applyVersion, bumpSemver, checkVersions, compareSemver, parseSemver, workspaceManifests } from "../../scripts/versions.mjs";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("semver helpers", () => {
  it("parses and rejects versions", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
    expect(parseSemver("1.2.3-rc.1")?.prerelease).toBe("rc.1");
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("v1.2.3")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });

  it("bumps according to semver rules", () => {
    expect(bumpSemver("0.1.0", "patch")).toBe("0.1.1");
    expect(bumpSemver("0.1.9", "minor")).toBe("0.2.0");
    expect(bumpSemver("0.9.9", "major")).toBe("1.0.0");
    expect(bumpSemver("1.0.0-rc.1", "patch")).toBe("1.0.1");
    expect(() => bumpSemver("1.0.0", "huge")).toThrow();
  });

  it("orders versions", () => {
    expect(compareSemver("0.1.0", "0.1.1")).toBeLessThan(0);
    expect(compareSemver("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareSemver("0.1.0", "0.1.0")).toBe(0);
  });
});

describe("monorepo versions", () => {
  it("keeps every package on the root version", () => {
    const report = checkVersions(ROOT);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.packages.length).toBe(4);
    for (const entry of report.packages) expect(entry.version).toBe(report.rootVersion);
  });

  it("keeps internal dependencies at the exact locked version", () => {
    for (const file of workspaceManifests(ROOT) as string[]) {
      const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string>>;
      for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          if (!name.startsWith("@browser2d/")) continue;
          expect(range, `${name} w ${file}`).toMatch(/^\d+\.\d+\.\d+$/);
        }
      }
    }
  });

  it("writes the same version everywhere without leaving drift", () => {
    const report = checkVersions(ROOT);
    const result = applyVersion(report.rootVersion);
    expect(result.changed).toContain("package.json");
    expect(result.changed).toContain("packages/engine/src/version.ts");
    expect(checkVersions(ROOT).problems).toEqual([]);
  });
});

describe("release contract", () => {
  it("keeps CHANGELOG.md with a section for the current version", () => {
    const version = checkVersions(ROOT).rootVersion as string;
    const changelog = read("CHANGELOG.md");
    expect(changelog).toContain("## [Unreleased]");
    expect(changelog).toContain(`## [${version}]`);
    expect(changelog).toMatch(/Keep a Changelog/);
    expect(changelog).toMatch(/Semantic Versioning/);
  });

  it("documents every change type the tooling understands", () => {
    const changelog = read("CHANGELOG.md");
    for (const heading of ["### Added", "### Changed", "### Deprecated", "### Removed", "### Fixed", "### Security"]) {
      expect(changelog).toContain(heading);
    }
  });

  it("ships a release notes template with the required sections", () => {
    const template = read("docs/RELEASE_NOTES_TEMPLATE.md");
    for (const section of ["## Highlights", "## Breaking changes", "## Migrations", "## Quality gate", "## Artifacts", "## Stability"]) {
      expect(template).toContain(section);
    }
  });

  it("keeps the technical debt and ADR indexes in sync with the files on disk", () => {
    const debt = read("docs/TECH_DEBT.md");
    expect(debt).toMatch(/D-\d{3}/);
    const adrIndex = read("docs/adr/README.md");
    const numbers = [...adrIndex.matchAll(/\((\d{4})-[a-z0-9-]+\.md\)/g)].map((match) => match[1]);
    expect(numbers.length).toBeGreaterThanOrEqual(6);
    for (const number of numbers) {
      expect(adrIndex, `wpis ${number}`).toContain(`(${number}-`);
    }
  });
});
