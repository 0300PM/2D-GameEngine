import { describe, expect, it } from "vitest";
import { SYSTEM_ORDER, phaseRank, type SystemPhase } from "../../packages/engine/src/core/Component";
import { compareComponents, sortByPhase } from "../../packages/engine/src/core/schedule";

type Entry = { id: string; phase: SystemPhase; order: number; sequence: number };

const entries: Entry[] = [
  { id: "render", phase: "render", order: 0, sequence: 1 },
  { id: "behavior-b", phase: "behavior", order: 5, sequence: 2 },
  { id: "physics", phase: "physics", order: 0, sequence: 3 },
  { id: "input", phase: "input", order: 0, sequence: 4 },
  { id: "behavior-a", phase: "behavior", order: 1, sequence: 5 },
  { id: "animation", phase: "animation", order: 0, sequence: 6 }
];

describe("Component scheduling", () => {
  it("ranks phases in the documented order", () => {
    expect(SYSTEM_ORDER).toEqual(["input", "behavior", "physics", "animation", "render"]);
    expect(SYSTEM_ORDER.map((phase) => phaseRank(phase))).toEqual([0, 1, 2, 3, 4]);
  });

  it("sorts by phase, then order, then registration sequence", () => {
    expect(sortByPhase(entries).map((entry) => entry.id)).toEqual([
      "input",
      "behavior-a",
      "behavior-b",
      "physics",
      "animation",
      "render"
    ]);
  });

  it("is stable for identical keys", () => {
    const first = { id: "a", phase: "behavior" as SystemPhase, order: 0, sequence: 1 };
    const second = { id: "b", phase: "behavior" as SystemPhase, order: 0, sequence: 2 };
    expect(compareComponents(first, second)).toBeLessThan(0);
    expect(compareComponents(second, first)).toBeGreaterThan(0);
  });

  it("groups components by phase without changing their order", () => {
    const sorted = sortByPhase(entries);
    const behavior = sorted.filter((entry) => entry.phase === "behavior").map((entry) => entry.id);
    expect(behavior).toEqual(["behavior-a", "behavior-b"]);
  });
});
