import type { AudioPort } from "../core/ports";

export type AudioChannel = "master" | "music" | "sfx" | "ui";

export const AUDIO_CHANNELS: readonly AudioChannel[] = ["master", "music", "sfx", "ui"];

export const DEFAULT_AUDIO_VOLUMES: Record<AudioChannel, number> = {
  master: 1,
  music: 0.7,
  sfx: 1,
  ui: 0.9
};

export type PlaySoundOptions = {
  channel?: AudioChannel;
  volume?: number;
  loop?: boolean;
  rate?: number;
  owner?: string;
};

export type AudioState = {
  attached: boolean;
  unlocked: boolean;
  muted: boolean;
  paused: boolean;
  volumes: Record<AudioChannel, number>;
  handles: number;
  pending: number;
};

export type HandleStatus = "pending" | "playing" | "stopped";

export class SoundHandle {
  readonly id: number;
  readonly assetId: string;
  readonly channel: AudioChannel;
  readonly owner: string;
  readonly loop: boolean;
  readonly rate: number;
  private manager: AudioManager;
  private volumeValue: number;
  private playbackId: string | null = null;
  private status: HandleStatus = "pending";

  constructor(
    manager: AudioManager,
    id: number,
    assetId: string,
    channel: AudioChannel,
    owner: string,
    volume: number,
    loop: boolean,
    rate: number
  ) {
    this.manager = manager;
    this.id = id;
    this.assetId = assetId;
    this.channel = channel;
    this.owner = owner;
    this.volumeValue = volume;
    this.loop = loop;
    this.rate = rate;
  }

  get statusName(): HandleStatus {
    return this.status;
  }

  get isPlaying(): boolean {
    return this.status !== "stopped";
  }

  get volume(): number {
    return this.volumeValue;
  }

  get effectiveVolume(): number {
    return this.manager.computeVolume(this.channel, this.volumeValue);
  }

  get playback(): string | null {
    return this.playbackId;
  }

  setVolume(volume: number): void {
    this.volumeValue = clampVolume(volume);
    this.manager.refreshHandle(this);
  }

  stop(): void {
    this.manager.stop(this);
  }

  internalMarkPlaying(playbackId: string): void {
    this.playbackId = playbackId;
    this.status = "playing";
  }

  internalMarkStopped(): void {
    this.playbackId = null;
    this.status = "stopped";
  }

  internalIsPending(): boolean {
    return this.status === "pending";
  }
}

const clampVolume = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

let nextHandleId = 1;

export class AudioManager {
  private port: AudioPort | null = null;
  private volumes: Record<AudioChannel, number> = { ...DEFAULT_AUDIO_VOLUMES };
  private muted = false;
  private paused = false;
  private unlocked = false;
  private handles = new Map<number, SoundHandle>();
  private pending: SoundHandle[] = [];
  private music: SoundHandle | null = null;
  private unlockListeners = new Set<(unlocked: boolean) => void>();

  attach(port: AudioPort): void {
    this.port = port;
    this.unlocked = port.isUnlocked();
    if (this.unlocked) this.flushPending();
  }

  detach(): void {
    for (const handle of this.handles.values()) handle.internalMarkStopped();
    this.handles.clear();
    this.pending = [];
    this.music = null;
    this.port?.stopAll?.();
    this.port = null;
    this.paused = false;
  }

  isAttached(): boolean {
    return this.port !== null;
  }

  getAudioPort(): AudioPort | null {
    return this.port;
  }

  play(assetId: string, options: PlaySoundOptions = {}): SoundHandle | null {
    const port = this.port;
    if (!port) return null;
    const channel = options.channel ?? "sfx";
    if (!AUDIO_CHANNELS.includes(channel)) throw new Error(`Unknown audio channel "${String(channel)}"`);
    const handle = new SoundHandle(
      this,
      nextHandleId++,
      assetId,
      channel,
      options.owner ?? "default",
      clampVolume(options.volume ?? 1),
      options.loop ?? false,
      options.rate ?? 1
    );
    this.handles.set(handle.id, handle);
    if (!this.unlocked) {
      this.pending.push(handle);
      return handle;
    }
    return this.startHandle(handle) ? handle : null;
  }

  playMusic(assetId: string, options: PlaySoundOptions = {}): SoundHandle | null {
    this.stopMusic();
    const handle = this.play(assetId, { ...options, channel: "music", loop: options.loop ?? true, owner: options.owner ?? "music" });
    this.music = handle;
    return handle;
  }

  stopMusic(): void {
    if (!this.music) return;
    this.stop(this.music);
    this.music = null;
  }

  getMusic(): SoundHandle | null {
    return this.music;
  }

  stop(handle: SoundHandle | null): boolean {
    if (!handle) return false;
    if (handle.internalIsPending()) {
      const index = this.pending.indexOf(handle);
      if (index >= 0) this.pending.splice(index, 1);
      handle.internalMarkStopped();
      this.handles.delete(handle.id);
      return true;
    }
    return this.stopHandle(handle);
  }

  stopAsset(assetId: string): number {
    let stopped = 0;
    for (const handle of Array.from(this.handles.values())) {
      if (handle.assetId !== assetId) continue;
      if (this.stop(handle)) stopped += 1;
    }
    if (this.music?.statusName === "stopped") this.music = null;
    return stopped;
  }

  stopOwner(owner: string): number {
    let stopped = 0;
    for (const handle of Array.from(this.handles.values())) {
      if (handle.owner !== owner) continue;
      if (this.stop(handle)) stopped += 1;
    }
    if (this.music?.statusName === "stopped") this.music = null;
    return stopped;
  }

  stopAll(): void {
    for (const handle of Array.from(this.handles.values())) this.stop(handle);
    this.handles.clear();
    this.pending = [];
    this.music = null;
    this.port?.stopAll?.();
  }

  pauseAll(): void {
    if (this.paused) return;
    this.paused = true;
    this.port?.pauseAll?.();
  }

  resumeAll(): void {
    if (!this.paused) return;
    this.paused = false;
    this.port?.resumeAll?.();
  }

  isPaused(): boolean {
    return this.paused;
  }

  setVolume(channel: AudioChannel, value: number): void {
    if (!AUDIO_CHANNELS.includes(channel)) throw new Error(`Unknown audio channel "${String(channel)}"`);
    this.volumes[channel] = clampVolume(value);
    if (channel === "master") {
      for (const handle of this.handles.values()) this.refreshHandle(handle);
      return;
    }
    for (const handle of this.handles.values()) {
      if (handle.channel === channel) this.refreshHandle(handle);
    }
  }

  setMasterVolume(value: number): void {
    this.setVolume("master", value);
  }

  getVolume(channel: AudioChannel = "master"): number {
    return this.volumes[channel];
  }

  getVolumes(): Record<AudioChannel, number> {
    return { ...this.volumes };
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    for (const handle of this.handles.values()) this.refreshHandle(handle);
  }

  mute(): void {
    this.setMuted(true);
  }

  unmute(): void {
    this.setMuted(false);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): boolean {
    const port = this.port;
    if (!port) return false;
    if (this.unlocked) return true;
    const result = port.unlock();
    const unlocked = result || port.isUnlocked();
    if (!unlocked) return false;
    this.unlocked = true;
    this.flushPending();
    for (const listener of Array.from(this.unlockListeners)) listener(true);
    return true;
  }

  onUnlock(listener: (unlocked: boolean) => void): () => void {
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  getHandleCount(): number {
    return this.handles.size;
  }

  getPendingCount(): number {
    return this.pending.length;
  }

  computeVolume(channel: AudioChannel, volume: number): number {
    if (this.muted) return 0;
    return clampVolume(this.volumes.master * this.volumes[channel] * clampVolume(volume));
  }

  refreshHandle(handle: SoundHandle): void {
    if (!handle.playback) return;
    this.port?.setVolume(handle.playback, handle.effectiveVolume);
  }

  stopHandle(handle: SoundHandle): boolean {
    if (handle.statusName === "stopped") return false;
    const playbackId = handle.playback;
    handle.internalMarkStopped();
    this.handles.delete(handle.id);
    if (this.music === handle) this.music = null;
    if (!playbackId) return false;
    this.port?.stop(playbackId);
    return true;
  }

  getState(): AudioState {
    return {
      attached: this.port !== null,
      unlocked: this.unlocked,
      muted: this.muted,
      paused: this.paused,
      volumes: this.getVolumes(),
      handles: this.handles.size,
      pending: this.pending.length
    };
  }

  private startHandle(handle: SoundHandle): boolean {
    const port = this.port;
    if (!port) return false;
    const playbackId = port.play({
      key: handle.assetId,
      volume: handle.effectiveVolume,
      loop: handle.loop,
      rate: handle.rate
    });
    if (!playbackId) {
      handle.internalMarkStopped();
      this.handles.delete(handle.id);
      if (this.music === handle) this.music = null;
      return false;
    }
    handle.internalMarkPlaying(playbackId);
    return true;
  }

  private flushPending(): void {
    const pending = this.pending;
    this.pending = [];
    for (const handle of pending) {
      if (handle.statusName === "stopped") continue;
      this.startHandle(handle);
    }
  }
}
