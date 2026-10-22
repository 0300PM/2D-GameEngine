import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDeprecations,
  deprecate,
  deprecationReport,
  findDeprecation,
  formatDeprecation,
  getDeprecations,
  registerDeprecation,
  resetDeprecationNotices
} from "../../packages/engine/src/deprecation";

const sample = {
  id: "scene.oldThing",
  replacement: "scene.newThing",
  since: "0.2.0",
  removeIn: "0.4.0",
  message: "oldThing is kept for one minor"
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deprecation registry", () => {
  it("registers and reads back a record without sharing the object", () => {
    registerDeprecation(sample);
    const found = findDeprecation(sample.id);
    expect(found).toEqual(sample);
    found!.since = "9.9.9";
    expect(findDeprecation(sample.id)?.since).toBe("0.2.0");
    clearDeprecations();
  });

  it("sorts entries by id", () => {
    registerDeprecation({ ...sample, id: "z.last" });
    registerDeprecation({ ...sample, id: "a.first" });
    expect(getDeprecations().map((entry) => entry.id)).toEqual(["a.first", "z.last"]);
    clearDeprecations();
  });

  it("formats a message with the replacement and the removal version", () => {
    expect(formatDeprecation(sample)).toBe(
      "scene.oldThing is deprecated since 0.2.0 — use scene.newThing (removed in 0.4.0)"
    );
    expect(formatDeprecation({ ...sample, replacement: null })).toBe(
      "scene.oldThing is deprecated since 0.2.0 (removed in 0.4.0)"
    );
  });

  it("returns null for an unknown id instead of throwing", () => {
    expect(findDeprecation("nope")).toBeNull();
    expect(deprecate("nope")).toBeNull();
  });
});

describe("deprecation notices", () => {
  it("notifies once per id, not once per call", () => {
    registerDeprecation(sample);
    resetDeprecationNotices();
    const sink = vi.fn();
    for (let index = 0; index < 5; index += 1) deprecate(sample.id, sink);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toContain("deprecated since 0.2.0");
    resetDeprecationNotices();
    deprecate(sample.id, sink);
    expect(sink).toHaveBeenCalledTimes(2);
    clearDeprecations();
  });

  it("reports what was already announced", () => {
    registerDeprecation(sample);
    resetDeprecationNotices();
    deprecate(sample.id);
    const report = deprecationReport();
    expect(report.notified).toContain(sample.id);
    expect(report.entries.some((entry) => entry.id === sample.id)).toBe(true);
    clearDeprecations();
  });
});
