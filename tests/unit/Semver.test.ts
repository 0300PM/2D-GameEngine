import { describe, expect, it } from "vitest";
import { compareVersions, isValidRange, parseVersion, satisfiesRange } from "../../packages/engine/src/plugins/semver";

describe("parseVersion", () => {
  it("parses full versions", () => {
    expect(parseVersion("1.2.3")).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: "" });
  });

  it("fills missing parts with zero", () => {
    expect(parseVersion("2")).toMatchObject({ major: 2, minor: 0, patch: 0 });
    expect(parseVersion("2.5")).toMatchObject({ major: 2, minor: 5, patch: 0 });
  });

  it("keeps prerelease tags", () => {
    expect(parseVersion("1.0.0-beta.2")?.prerelease).toBe("beta.2");
  });

  it("rejects invalid input", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("one.two.three")).toBeNull();
    expect(parseVersion("1.2.3.4")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by major, minor and patch", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("puts prereleases before releases", () => {
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBe(-1);
  });

  it("throws on unparsable versions", () => {
    expect(() => compareVersions("x", "1.0.0")).toThrow(/Cannot compare versions/);
  });
});

describe("isValidRange", () => {
  it("accepts supported range syntax", () => {
    for (const range of ["*", "1.2.3", "=1.2.3", "^1.2.3", "~1.2", ">=1.0.0", ">=1.0.0 <2.0.0", "^1.0.0 || ^2.0.0"]) {
      expect(isValidRange(range)).toBe(true);
    }
  });

  it("rejects garbage", () => {
    expect(isValidRange("latest")).toBe(false);
    expect(isValidRange(">=abc")).toBe(false);
  });
});

describe("satisfiesRange", () => {
  it("matches exact and wildcard ranges", () => {
    expect(satisfiesRange("1.2.3", "1.2.3")).toBe(true);
    expect(satisfiesRange("1.2.4", "1.2.3")).toBe(false);
    expect(satisfiesRange("9.9.9", "*")).toBe(true);
  });

  it("matches caret ranges across majors", () => {
    expect(satisfiesRange("1.9.0", "^1.2.3")).toBe(true);
    expect(satisfiesRange("2.0.0", "^1.2.3")).toBe(false);
    expect(satisfiesRange("0.1.5", "^0.1.0")).toBe(true);
    expect(satisfiesRange("0.2.0", "^0.1.0")).toBe(false);
  });

  it("matches tilde ranges within a minor", () => {
    expect(satisfiesRange("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfiesRange("1.3.0", "~1.2.0")).toBe(false);
    expect(satisfiesRange("1.9.0", "~1")).toBe(true);
  });

  it("matches comparisons and conjunction", () => {
    expect(satisfiesRange("1.5.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(satisfiesRange("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
    expect(satisfiesRange("1.0.0", "<=1.0.0")).toBe(true);
  });

  it("matches alternatives", () => {
    expect(satisfiesRange("1.4.0", "^1.0.0 || ^2.0.0")).toBe(true);
    expect(satisfiesRange("2.4.0", "^1.0.0 || ^2.0.0")).toBe(true);
    expect(satisfiesRange("3.0.0", "^1.0.0 || ^2.0.0")).toBe(false);
  });

  it("returns false for invalid versions or ranges", () => {
    expect(satisfiesRange("nope", "^1.0.0")).toBe(false);
    expect(satisfiesRange("1.0.0", "nope")).toBe(false);
  });
});
