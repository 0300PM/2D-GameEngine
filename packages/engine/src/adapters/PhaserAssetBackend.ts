import Phaser from "phaser";
import type { AssetDescriptor } from "../assets/AssetManifest";
import type { AssetBackend } from "../core/ports";
import { AssetError } from "../systems/AssetManager";

export type InlineAudioHooks = {
  onLoaded?: (id: string) => void;
  onError?: (error: AssetError) => void;
};

type DecodingSoundManager = Phaser.Sound.BaseSoundManager & {
  decodeAudio?: (key: string, data: ArrayBuffer) => Promise<unknown>;
};

export class PhaserAssetBackend implements AssetBackend {
  constructor(
    private scene: Phaser.Scene,
    private hooks: InlineAudioHooks = {}
  ) {}

  queue(descriptors: readonly AssetDescriptor[]): void {
    const loader = this.scene.load;
    for (const descriptor of descriptors) {
      if (descriptor.type === "audio" && descriptor.src.startsWith("data:")) {
        void this.loadInlineAudio(descriptor);
        continue;
      }
      switch (descriptor.type) {
        case "image":
          loader.image(descriptor.id, descriptor.src);
          break;
        case "audio":
          loader.audio(descriptor.id, descriptor.src);
          break;
        case "json":
          loader.json(descriptor.id, descriptor.src);
          break;
        case "spritesheet":
          loader.spritesheet(descriptor.id, descriptor.src, {
            frameWidth: descriptor.frameWidth ?? 32,
            frameHeight: descriptor.frameHeight ?? 32,
            margin: descriptor.margin ?? 0,
            spacing: descriptor.spacing ?? 0
          });
          break;
        case "atlas":
          if (descriptor.atlasJson) loader.atlas(descriptor.id, descriptor.src, descriptor.atlasJson);
          break;
        case "font":
          if (descriptor.atlasJson) loader.bitmapFont(descriptor.id, descriptor.src, descriptor.atlasJson);
          break;
        case "tilemap":
          loader.tilemapTiledJSON(descriptor.id, descriptor.src);
          break;
      }
    }
  }

  private async loadInlineAudio(descriptor: AssetDescriptor): Promise<void> {
    try {
      const response = await fetch(descriptor.src);
      const buffer = await response.arrayBuffer();
      const sound = this.scene.sound as DecodingSoundManager;
      if (typeof sound.decodeAudio === "function") {
        await sound.decodeAudio(descriptor.id, buffer);
      } else {
        const element = new Audio(descriptor.src);
        this.scene.cache.audio.add(descriptor.id, element);
      }
      this.hooks.onLoaded?.(descriptor.id);
    } catch (cause) {
      this.hooks.onError?.(
        new AssetError(`Failed to decode inline audio "${descriptor.id}": ${(cause as Error).message}`, descriptor.id, descriptor.src.slice(0, 32))
      );
    }
  }

  retry(descriptors: readonly AssetDescriptor[]): void {
    this.queue(descriptors);
  }

  cancel(): boolean {
    const loader = this.scene.load;
    if (loader.isLoading()) return false;
    loader.removeAllListeners();
    return true;
  }

  unload(id: string): void {
    if (this.scene.textures.exists(id)) this.scene.textures.remove(id);
    if (this.scene.cache.json.exists(id)) this.scene.cache.json.remove(id);
    if (this.scene.cache.audio.exists(id)) this.scene.cache.audio.remove(id);
  }

  hasTexture(id: string): boolean {
    return this.scene.textures.exists(id);
  }

  has(id: string): boolean {
    return (
      this.scene.textures.exists(id) ||
      this.scene.cache.json.exists(id) ||
      this.scene.cache.audio.exists(id) ||
      this.scene.cache.tilemap.exists(id)
    );
  }

  sizeOf(id: string): number | null {
    const texture = this.scene.textures.get(id);
    if (!texture || texture.key === "__MISSING") return null;
    const source = texture.source?.[0];
    if (!source) return null;
    return typeof source.width === "number" && typeof source.height === "number" ? source.width * source.height * 4 : null;
  }

  registerAnimations(animations: readonly { key: string; textureId: string; frames: readonly (number | string)[]; frameRate?: number; repeat?: number; yoyo?: boolean }[]): void {
    for (const animation of animations) {
      if (this.scene.anims.exists(animation.key)) continue;
      if (!this.scene.textures.exists(animation.textureId)) continue;
      this.scene.anims.create({
        key: animation.key,
        frames: animation.frames.map((frame) =>
          typeof frame === "number" ? { key: animation.textureId, frame } : { key: animation.textureId, frame }
        ),
        frameRate: animation.frameRate ?? 12,
        repeat: animation.repeat ?? -1,
        yoyo: animation.yoyo ?? false
      });
    }
  }
}
