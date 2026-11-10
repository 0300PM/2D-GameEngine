import { Random } from "../../../packages/engine/src/core/Random";
import { checksum } from "../../../packages/engine/src/core/Checksum";
import { sortByPhase } from "../../../packages/engine/src/core/schedule";
import { composeTransform } from "../../../packages/engine/src/components/Transform";
import { Time } from "../../../packages/engine/src/core/Time";
import type { SystemPhase } from "../../../packages/engine/src/core/Component";

export type DigestReport = {
  impl: "typescript";
  objects: number;
  frames: number;
  digest: string;
};

export type DigestOptions = {
  objects?: number;
  frames?: number;
  seed?: number;
};

const PHASES: readonly SystemPhase[] = ["input", "behavior", "physics", "animation", "render"];

type Sample = { x: number; y: number; tag: string };

export const runDeterministicDigest = (options: DigestOptions = {}): DigestReport => {
  const count = options.objects ?? 256;
  const frames = options.frames ?? 120;
  const seed = options.seed ?? 1337;

  const time = new Time(0.1);
  time.setFixedStep(60, 5);
  const random = new Random(seed);
  const samples: Sample[] = [];
  for (let position = 0; position < count; position += 1) {
    samples.push({
      x: random.float(-64, 64),
      y: random.float(-64, 64),
      tag: position % 3 === 0 ? "red" : position % 3 === 1 ? "blue" : "pickup"
    });
  }

  const schedule = samples.map((_, position) => ({
    phase: PHASES[position % PHASES.length],
    order: position % 7,
    sequence: position
  }));

  let fixedSteps = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    time.update(1000 / 60);
    while (time.consumeFixedStep()) {
      fixedSteps += 1;
      for (let position = 0; position < samples.length; position += 1) {
        const sample = samples[position];
        sample.x += position % 3 === 0 ? 0.5 : 0.25;
        sample.y += position % 5 === 0 ? -0.25 : 0.125;
      }
    }
  }

  const rounded = samples.map((sample) => `${Math.round(sample.x * 100)}:${Math.round(sample.y * 100)}:${sample.tag}`);
  const ordered = sortByPhase(schedule).map((entry) => `${entry.phase}:${entry.order}:${entry.sequence}`);
  const composed = composeTransform(
    { x: 12, y: 8, rotation: 0.35, scaleX: 1.5, scaleY: 1.25 },
    { x: 4, y: -2, rotation: 0.1, scaleX: 1, scaleY: 1 }
  );

  const report: DigestReport = {
    impl: "typescript",
    objects: samples.length,
    frames: time.frame,
    digest: checksum({
      fixedSteps,
      rounded,
      ordered,
      composed,
      frame: time.frame,
      state: random.saveState()
    })
  };

  time.dispose();
  random.dispose();
  return report;
};
