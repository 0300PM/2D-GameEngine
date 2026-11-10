import { Scene, type SceneContext, type ScenePorts } from "../../../packages/engine/src/core/Scene";
import type { GameObject } from "../../../packages/engine/src/core/GameObject";
import type { RenderPort } from "../../../packages/engine/src/core/ports";
import { Time } from "../../../packages/engine/src/core/Time";
import { Random } from "../../../packages/engine/src/core/Random";
import { AssetManager } from "../../../packages/engine/src/systems/AssetManager";
import { CameraManager } from "../../../packages/engine/src/systems/CameraManager";
import { EventBus } from "../../../packages/engine/src/systems/EventBus";
import { InputManager } from "../../../packages/engine/src/systems/InputManager";
import { Logger } from "../../../packages/engine/src/systems/Logger";
import { PhysicsManager } from "../../../packages/engine/src/systems/PhysicsManager";
import { Scheduler } from "../../../packages/engine/src/systems/Scheduler";
import { AudioManager } from "../../../packages/engine/src/audio/AudioManager";
import { defaultInputMap } from "../../../packages/engine/src/core/EngineConfig";

export type HeadlessScene = {
  scene: Scene;
  ctx: SceneContext;
  synced: GameObject[];
  destroyed: GameObject[];
  step: (deltaTime?: number, frames?: number) => void;
  dispose: () => void;
};

const createPorts = (): { ports: ScenePorts; synced: GameObject[]; destroyed: GameObject[] } => {
  const synced: GameObject[] = [];
  const destroyed: GameObject[] = [];
  const render: RenderPort = {
    create: () => undefined,
    destroy: (object) => {
      destroyed.push(object);
    },
    sync: (objects) => {
      for (const object of objects) synced.push(object);
    },
    clear: () => {
      synced.length = 0;
      destroyed.length = 0;
    }
  };
  return { ports: { render }, synced, destroyed };
};

export const createContext = (width: number, height: number): SceneContext => ({
  audio: new AudioManager(),
  assets: new AssetManager(),
  input: new InputManager(defaultInputMap),
  physics: new PhysicsManager(),
  camera: new CameraManager(),
  events: new EventBus(),
  logger: new Logger("determinism", "error"),
  time: new Time(0.1),
  scheduler: new Scheduler(),
  random: new Random(1337),
  width,
  height
});

export const mountHeadless = (scene: Scene, ctx: SceneContext): HeadlessScene => {
  const { ports, synced, destroyed } = createPorts();
  scene.initInternal(ctx, ports);
  scene.internalCreate();
  return {
    scene,
    ctx,
    synced,
    destroyed,
    step: (deltaTime = 1 / 60, frames = 1) => {
      for (let frame = 0; frame < frames; frame += 1) scene.internalUpdate(deltaTime);
    },
    dispose: () => {
      scene.internalShutdown();
      ctx.time.dispose();
      ctx.random.dispose();
    }
  };
};
