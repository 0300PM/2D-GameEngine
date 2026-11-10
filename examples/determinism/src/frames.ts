import { Scene } from "../../../packages/engine/src/core/Scene";
import { Component, SYSTEM_ORDER, phaseRank, type SystemPhase } from "../../../packages/engine/src/core/Component";
import { Random } from "../../../packages/engine/src/core/Random";
import { checksum } from "../../../packages/engine/src/core/Checksum";
import { compareComponents, sortByPhase } from "../../../packages/engine/src/core/schedule";
import { composeTransform } from "../../../packages/engine/src/components/Transform";
import { createContext, mountHeadless } from "./harness";
import type { GameObject } from "../../../packages/engine/src/core/GameObject";

export type FrameStats = {
  impl: "typescript";
  objects: number;
  frames: number;
  componentUpdates: number;
  orderStable: boolean;
  digest: string;
};

export type FrameOptions = {
  objects?: number;
  frames?: number;
  seed?: number;
  width?: number;
  height?: number;
};

const STEP = 1 / 60;

class Mover extends Component {
  private readonly speed: number;
  private readonly drift: number;

  constructor(phase: SystemPhase, order: number, speed: number, drift: number) {
    super();
    this.phase = phase;
    this.order = order;
    this.speed = speed;
    this.drift = drift;
  }

  onUpdate(): void {
    const owner = this.owner;
    if (!owner) return;
    owner.translate(this.speed, this.drift);
  }
}

class DigestScene extends Scene {
  constructor() {
    super("determinism");
  }

  create(): void {
    return undefined;
  }
}

export const runFixedFrames = (options: FrameOptions = {}): FrameStats => {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const count = options.objects ?? 512;
  const frames = options.frames ?? 240;
  const seed = options.seed ?? 424242;

  const host = mountHeadless(new DigestScene(), createContext(width, height));
  const random = new Random(seed);
  const objects: GameObject[] = [];
  for (let position = 0; position < count; position += 1) {
    const object = host.scene.createRect(8, 8, {
      id: `unit-${position}`,
      x: random.float(0, width),
      y: random.float(0, height),
      color: 0xffffff,
      tags: position % 4 === 0 ? ["enemy", "fast"] : position % 4 === 1 ? ["enemy"] : ["pickup"]
    });
    object.add(
      new Mover(
        SYSTEM_ORDER[position % SYSTEM_ORDER.length],
        position % 11,
        (position % 3) - 1,
        ((position % 5) - 2) * 0.5
      )
    );
    objects.push(object);
  }
  host.scene.internalComponentsDirty();

  const scheduled = objects.map((object) => object.getComponents()[0]);
  const ordered = sortByPhase(scheduled);
  const orderStable = ordered.every(
    (component, position) => position === 0 || compareComponents(ordered[position - 1], component) <= 0
  );
  const phaseCounts = SYSTEM_ORDER.map((phase) => ordered.filter((component) => component.phase === phase).length);

  let componentUpdates = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    host.step(STEP);
    componentUpdates += ordered.length;
    if (frame % 30 === 0) host.scene.internalComponentsDirty();
  }

  const sampled: number[] = [];
  for (let position = 0; position < objects.length; position += 16) {
    const world = objects[position].world;
    sampled.push(Math.round(world.x * 100), Math.round(world.y * 100));
  }

  const composed = composeTransform(
    { x: 16, y: 24, rotation: 0.25, scaleX: 2, scaleY: 1.5 },
    { x: -4, y: 8, rotation: 0.5, scaleX: 0.5, scaleY: 0.5 }
  );

  const stats: FrameStats = {
    impl: "typescript",
    objects: host.scene.objectCount(),
    frames,
    componentUpdates,
    orderStable,
    digest: checksum({
      frames,
      objects: count,
      sampled,
      composed,
      phaseCounts,
      phases: ordered.map((component) => phaseRank(component.phase)),
      enemies: host.scene.findAll((object) => object.hasTag("enemy")).length,
      fast: host.scene.findAll((object) => object.hasTag("fast")).length,
      synced: host.synced.length,
      destroyed: host.destroyed.length
    })
  };

  random.dispose();
  host.dispose();
  return stats;
};
