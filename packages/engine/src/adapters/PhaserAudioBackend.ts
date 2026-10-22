import Phaser from "phaser";
import type { AudioPlaybackOptions, AudioPort } from "../core/ports";

type SoundLike = Phaser.Sound.BaseSound & {
  setVolume?(value: number): unknown;
  setRate?(value: number): unknown;
};

type LockableSoundManager = Phaser.Sound.BaseSoundManager & {
  locked?: boolean;
  unlock?: () => void;
};

export class PhaserAudioBackend implements AudioPort {
  private sounds = new Map<string, SoundLike>();
  private counter = 0;

  constructor(private game: Phaser.Game) {}

  private get manager(): LockableSoundManager | null {
    return (this.game.sound as LockableSoundManager | undefined) ?? null;
  }

  play(options: AudioPlaybackOptions): string | null {
    const manager = this.manager;
    if (!manager) return null;
    if (!manager.game.cache.audio.exists(options.key)) return null;
    const sound = manager.add(options.key, {
      volume: options.volume,
      loop: options.loop,
      rate: options.rate
    }) as SoundLike | null;
    if (!sound) return null;
    const id = `snd-${this.counter++}`;
    sound.setVolume?.(options.volume);
    if (options.rate !== 1) sound.setRate?.(options.rate);
    sound.play();
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      this.sounds.delete(id);
    });
    sound.once(Phaser.Sound.Events.STOP, () => {
      this.sounds.delete(id);
    });
    this.sounds.set(id, sound);
    return id;
  }

  stop(id: string): void {
    const sound = this.sounds.get(id);
    if (!sound) return;
    this.sounds.delete(id);
    sound.stop();
    sound.destroy();
  }

  setVolume(id: string, volume: number): void {
    this.sounds.get(id)?.setVolume?.(volume);
  }

  pauseAll(): void {
    for (const sound of this.sounds.values()) sound.pause();
  }

  resumeAll(): void {
    for (const sound of this.sounds.values()) sound.resume();
  }

  stopAll(): void {
    for (const sound of this.sounds.values()) {
      sound.stop();
      sound.destroy();
    }
    this.sounds.clear();
  }

  isUnlocked(): boolean {
    const manager = this.manager;
    if (!manager) return false;
    return manager.locked !== true;
  }

  unlock(): boolean {
    const manager = this.manager;
    if (!manager) return false;
    manager.unlock?.();
    return manager.locked !== true;
  }

  getActiveCount(): number {
    return this.sounds.size;
  }

  destroy(): void {
    this.stopAll();
  }
}
