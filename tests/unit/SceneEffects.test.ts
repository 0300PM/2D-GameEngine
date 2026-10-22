import { describe, expect, it } from "vitest";
import { Scene } from "../../packages/engine/src/core/Scene";
import { CameraManager } from "../../packages/engine/src/systems/CameraManager";
import { createHarness, type Harness } from "../helpers/harness";

class EffectScene extends Scene {
  created = 0;
  shutdowns = 0;

  constructor() {
    super("effects");
  }

  create(): void {
    this.created += 1;
  }

  shutdown(): void {
    this.shutdowns += 1;
  }
}

const build = (): { scene: EffectScene; harness: Harness } => {
  const scene = new EffectScene();
  const harness = createHarness(scene);
  harness.audio.unlocked = true;
  harness.managerAudio.attach(harness.audio);
  return { scene, harness };
};

describe("Scene tweens", () => {
  it("animates object properties through the scene clock", () => {
    const { scene, harness } = build();
    const box = scene.createRect(10, 10, { color: 0xffffff, x: 0, y: 0 });
    scene.tween(box, { x: 100 }, { duration: 1, easing: "linear" });
    harness.step(0.5);
    expect(box.x).toBeCloseTo(50, 6);
    harness.step(0.5);
    expect(box.x).toBeCloseTo(100, 6);
    expect(scene.getTweens().activeCount).toBe(0);
  });

  it("stops every tween when the scene shuts down", () => {
    const { scene, harness } = build();
    const box = scene.createRect(10, 10, { color: 0xffffff, x: 0 });
    scene.tween(box, { x: 100 }, { duration: 1, easing: "linear" });
    harness.step(0.25);
    scene.internalShutdown();
    expect(scene.getTweens().activeCount).toBe(0);
    expect(box.x).toBeCloseTo(25, 6);
  });

  it("runs a scene sequence", () => {
    const { scene, harness } = build();
    const box = scene.createRect(10, 10, { color: 0xffffff, x: 0, y: 0 });
    scene.tweenSequence([
      { target: box, props: { x: 10 }, duration: 0.1 },
      { target: box, props: { y: 20 }, duration: 0.1 }
    ]);
    harness.step(0.1);
    harness.step(0.1);
    expect(box.x).toBe(10);
    expect(box.y).toBe(20);
  });

  it("runs a scene delay", () => {
    const { scene, harness } = build();
    let fired = 0;
    scene.delay(0.2, () => {
      fired += 1;
    });
    harness.step(0.1);
    expect(fired).toBe(0);
    harness.step(0.15);
    expect(fired).toBe(1);
  });

  it("freezes tweens when the delta is zero", () => {
    const { scene, harness } = build();
    const box = scene.createRect(10, 10, { color: 0xffffff, x: 0 });
    scene.tween(box, { x: 100 }, { duration: 1 });
    harness.step(0);
    expect(box.x).toBe(0);
  });
});

describe("Scene audio", () => {
  it("tags scene sounds with the scene owner", () => {
    const { scene, harness } = build();
    scene.playSound("coin", { volume: 0.4 });
    expect(harness.audio.plays[0].key).toBe("coin");
    expect(harness.managerAudio.getHandleCount()).toBe(1);
    expect(harness.managerAudio.getMusic()).toBeNull();
  });

  it("stops scene sounds on shutdown but leaves other owners alone", () => {
    const { scene, harness } = build();
    harness.managerAudio.play("ui-click", { owner: "menu" });
    scene.playSound("coin");
    scene.playMusic("theme");
    expect(harness.audio.active).toHaveLength(3);
    scene.internalShutdown();
    expect(harness.audio.active.map((entry) => entry.key)).toEqual(["ui-click"]);
    expect(scene.shutdowns).toBe(1);
  });

  it("forwards channel volume to the audio manager", () => {
    const { scene, harness } = build();
    scene.setChannelVolume("music", 0.3);
    expect(harness.managerAudio.getVolume("music")).toBeCloseTo(0.3, 6);
  });

  it("exposes the audio manager", () => {
    const { scene, harness } = build();
    expect(scene.getAudio()).toBe(harness.managerAudio);
  });
});

describe("Scene animation control", () => {
  it("plays a known animation and reports success", () => {
    const { scene, harness } = build();
    const hero = scene.createSprite("hero", { id: "hero" });
    expect(scene.playAnimation(hero, "hero:walk")).toBe(true);
    expect(harness.render.animations[0]).toMatchObject({ kind: "play", key: "hero:walk" });
  });

  it("forwards play options and rejects unknown keys", () => {
    const { scene, harness } = build();
    const hero = scene.createSprite("hero", { id: "hero" });
    expect(scene.playAnimation("hero", "hero:walk", { restart: true, frame: 2, rate: 2 })).toBe(true);
    expect(harness.render.animations[0]).toMatchObject({ kind: "play", options: { restart: true, frame: 2, rate: 2 } });
    expect(scene.playAnimation(hero, "hero:fly")).toBe(false);
    expect(scene.playAnimation("missing", "hero:walk")).toBe(false);
  });

  it("stops, pauses and seeks animations", () => {
    const { scene, harness } = build();
    const hero = scene.createSprite("hero", { id: "hero" });
    scene.playAnimation(hero, "hero:walk");
    scene.pauseAnimation(hero, true);
    expect(harness.render.animationState.get(hero)?.isPaused).toBe(true);
    expect(scene.getAnimationState(hero)).toMatchObject({ key: "hero:walk", isPaused: true });
    scene.pauseAnimation(hero, false);
    expect(harness.render.animationState.get(hero)?.isPaused).toBe(false);
    expect(scene.setFrame(hero, 3)).toBe(true);
    expect(harness.render.animations.some((entry) => entry.kind === "frame" && entry.frame === 3)).toBe(true);
    scene.stopAnimation(hero, "hero:walk");
    expect(scene.getAnimationState(hero)).toBeNull();
  });

  it("tolerates animation calls on unknown objects", () => {
    const { scene } = build();
    expect(scene.setFrame("ghost", 0)).toBe(false);
    expect(scene.getAnimationState("ghost")).toBeNull();
    expect(() => scene.stopAnimation("ghost")).not.toThrow();
    expect(() => scene.pauseAnimation("ghost")).not.toThrow();
  });
});

describe("Scene camera effects", () => {
  it("forwards shake, flash, fade and reset", () => {
    const { scene, harness } = build();
    const camera = scene.getCamera();
    camera.shake(120, 0.02);
    camera.flash(90, 255, 0, 0);
    camera.fadeOut(250);
    camera.fadeIn(180);
    camera.resetEffects();
    expect(harness.camera.shakes).toEqual([{ duration: 120, intensity: 0.02 }]);
    expect(harness.camera.flashes).toEqual([{ duration: 90, red: 255, green: 0, blue: 0 }]);
    expect(harness.camera.fades).toEqual([
      { direction: "out", duration: 250 },
      { direction: "in", duration: 180 }
    ]);
    expect(harness.camera.resets).toBe(1);
    expect(camera.supportsEffects()).toBe(true);
  });

  it("tolerates a camera without effect support", () => {
    const manager = new CameraManager();
    expect(() => manager.flash(10)).not.toThrow();
    expect(() => manager.fadeOut(10)).not.toThrow();
    expect(() => manager.resetEffects()).not.toThrow();
    expect(manager.supportsEffects()).toBe(false);
  });
});
