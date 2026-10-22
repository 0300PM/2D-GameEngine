import { describe, expect, it, vi } from "vitest";
import { AudioManager, DEFAULT_AUDIO_VOLUMES } from "../../packages/engine/src/audio/AudioManager";
import { FakeAudioPort } from "../helpers/harness";

const build = () => {
  const manager = new AudioManager();
  const port = new FakeAudioPort();
  manager.attach(port);
  return { manager, port };
};

describe("AudioManager", () => {
  it("returns null when no backend is attached", () => {
    const manager = new AudioManager();
    expect(manager.play("coin")).toBeNull();
    expect(manager.isAttached()).toBe(false);
  });

  it("plays a sound on the sfx channel with a default owner", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    const handle = manager.play("coin", { volume: 0.5 });
    expect(handle?.statusName).toBe("playing");
    expect(handle?.channel).toBe("sfx");
    expect(handle?.owner).toBe("default");
    expect(port.plays[0]).toMatchObject({ key: "coin", loop: false, rate: 1 });
    expect(port.plays[0].volume).toBeCloseTo(0.5 * DEFAULT_AUDIO_VOLUMES.sfx, 6);
  });

  it("queues playback until the backend is unlocked", () => {
    const { manager, port } = build();
    const handle = manager.play("coin");
    expect(handle?.statusName).toBe("pending");
    expect(manager.getPendingCount()).toBe(1);
    expect(port.plays).toHaveLength(0);

    expect(manager.unlock()).toBe(true);
    expect(handle?.statusName).toBe("playing");
    expect(manager.getPendingCount()).toBe(0);
    expect(port.plays).toHaveLength(1);
  });

  it("notifies unlock listeners once", () => {
    const { manager } = build();
    const listener = vi.fn();
    manager.onUnlock(listener);
    manager.unlock();
    manager.unlock();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("drops a queued sound when it is stopped before unlock", () => {
    const { manager, port } = build();
    const handle = manager.play("coin");
    handle?.stop();
    expect(manager.getPendingCount()).toBe(0);
    manager.unlock();
    expect(port.plays).toHaveLength(0);
  });

  it("stops a playing sound and frees its handle", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    const handle = manager.play("coin");
    expect(manager.getHandleCount()).toBe(1);
    handle?.stop();
    expect(port.plays[0].stopped).toBe(true);
    expect(manager.getHandleCount()).toBe(0);
  });

  it("multiplies master and channel volumes", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.setVolume("master", 0.5);
    manager.setVolume("sfx", 0.5);
    manager.play("coin", { volume: 1 });
    expect(port.plays[0].volume).toBeCloseTo(0.25, 6);
  });

  it("updates live handles when a channel volume changes", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin", { channel: "ui", volume: 1 });
    manager.setVolume("ui", 0.25);
    expect(port.plays[0].volume).toBeCloseTo(0.25, 6);
    manager.setVolume("music", 0.1);
    expect(port.plays[0].volume).toBeCloseTo(0.25, 6);
  });

  it("silences every handle while muted and restores them afterwards", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin", { volume: 1 });
    manager.mute();
    expect(port.plays[0].volume).toBe(0);
    expect(manager.toggleMute()).toBe(false);
    expect(port.plays[0].volume).toBeCloseTo(DEFAULT_AUDIO_VOLUMES.sfx, 6);
  });

  it("clamps volumes to the 0..1 range", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.setVolume("master", 4);
    expect(manager.getVolume("master")).toBe(1);
    manager.setVolume("master", -2);
    expect(manager.getVolume("master")).toBe(0);
    manager.setVolume("music", Number.NaN);
    expect(manager.getVolume("music")).toBe(0);
  });

  it("replaces music instead of stacking it", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.playMusic("theme");
    const first = port.plays[0];
    manager.playMusic("boss");
    expect(first.stopped).toBe(true);
    expect(port.plays[1]).toMatchObject({ key: "boss", loop: true });
    expect(manager.getMusic()?.assetId).toBe("boss");
    expect(manager.getMusic()?.channel).toBe("music");
  });

  it("stops music on request", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.playMusic("theme");
    manager.stopMusic();
    expect(port.plays[0].stopped).toBe(true);
    expect(manager.getMusic()).toBeNull();
  });

  it("stops every sound owned by a scene", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin", { owner: "game" });
    manager.play("hit", { owner: "game" });
    manager.play("click", { owner: "menu" });
    expect(manager.stopOwner("game")).toBe(2);
    expect(port.active.map((entry) => entry.key)).toEqual(["click"]);
  });

  it("stops sounds by asset id", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin");
    manager.play("coin");
    manager.play("hit");
    expect(manager.stopAsset("coin")).toBe(2);
    expect(port.active.map((entry) => entry.key)).toEqual(["hit"]);
  });

  it("pauses and resumes every playback once", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin");
    manager.pauseAll();
    manager.pauseAll();
    expect(port.pauseCalls).toBe(1);
    expect(port.plays[0].paused).toBe(true);
    manager.resumeAll();
    expect(port.resumeCalls).toBe(1);
    expect(port.plays[0].paused).toBe(false);
  });

  it("stops everything on stopAll", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin");
    manager.playMusic("theme");
    manager.stopAll();
    expect(manager.getHandleCount()).toBe(0);
    expect(manager.getMusic()).toBeNull();
    expect(port.active).toHaveLength(0);
  });

  it("ignores a backend that refuses playback", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    port.failNext = true;
    expect(manager.play("missing")).toBeNull();
    expect(manager.getHandleCount()).toBe(0);
  });

  it("detaches the backend and silences playback", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    manager.play("coin");
    manager.detach();
    expect(manager.isAttached()).toBe(false);
    expect(port.stopAllCalls).toBe(1);
    expect(manager.getHandleCount()).toBe(0);
  });

  it("rejects an unknown channel", () => {
    const { manager, port } = build();
    port.unlocked = true;
    manager.attach(port);
    expect(() => manager.play("coin", { channel: "voice" as never })).toThrow(/Unknown audio channel/);
    expect(() => manager.setVolume("voice" as never, 1)).toThrow(/Unknown audio channel/);
  });

  it("reports its state", () => {
    const { manager, port } = build();
    manager.play("coin");
    manager.setVolume("sfx", 0.4);
    expect(manager.getState()).toMatchObject({
      attached: true,
      unlocked: false,
      muted: false,
      paused: false,
      handles: 1,
      pending: 1
    });
    expect(manager.getState().volumes.sfx).toBeCloseTo(0.4, 6);
    expect(port.unlockedCalls).toBe(0);
  });
});
