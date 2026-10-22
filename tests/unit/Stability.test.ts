import { describe, expect, it } from "vitest";
import { API_LEVEL, API_STABILITY, ENGINE_VERSION } from "../../packages/engine/src/version";
import {
  FEATURE_STATUS,
  getFeatureStatus,
  getStabilityReport,
  isExperimental,
  isStable,
  listFeatures,
  STABILITY_CHANNELS
} from "../../packages/engine/src/stability";

describe("feature stability registry", () => {
  it("uses only known channels", () => {
    for (const feature of listFeatures()) {
      expect(STABILITY_CHANNELS).toContain(feature.channel);
    }
  });

  it("gives every feature a semver since tag and a note", () => {
    for (const feature of listFeatures()) {
      expect(feature.since).toMatch(/^\d+\.\d+\.\d+$/);
      expect(feature.note.length).toBeGreaterThan(10);
      expect(feature.id).toBe(feature.id.trim().toLowerCase());
    }
  });

  it("keeps experimental features out of the stable channel", () => {
    expect(isStable("wasm")).toBe(false);
    expect(isExperimental("wasm")).toBe(true);
    expect(isStable("ecs")).toBe(false);
    expect(isStable("tiled-import")).toBe(false);
  });

  it("marks the core surface as stable", () => {
    for (const id of ["engine-core", "scenes", "objects", "input", "physics", "saves", "project-format"]) {
      expect(isStable(id), id).toBe(true);
    }
  });

  it("returns an internal placeholder for unknown features", () => {
    const status = getFeatureStatus("does-not-exist");
    expect(status.id).toBe("does-not-exist");
    expect(status.channel).toBe("internal");
    expect(isStable("does-not-exist")).toBe(false);
  });

  it("filters by channel", () => {
    expect(listFeatures("experimental").every((feature) => feature.channel === "experimental")).toBe(true);
    expect(listFeatures("stable").length).toBeGreaterThan(10);
  });
});

describe("stability report", () => {
  it("counts every channel and matches the registry size", () => {
    const report = getStabilityReport();
    expect(report.counts.stable + report.counts.experimental + report.counts.internal).toBe(report.features.length);
    expect(report.features.length).toBe(Object.keys(FEATURE_STATUS).length);
  });

  it("repeats the version constants of the package", () => {
    const report = getStabilityReport();
    expect(report.version).toBe(ENGINE_VERSION);
    expect(report.apiLevel).toBe(API_LEVEL);
    expect(report.apiStability).toBe(API_STABILITY);
  });

  it("ships at least one experimental feature so the channel is not a claim", () => {
    expect(getStabilityReport().counts.experimental).toBeGreaterThan(0);
  });
});
