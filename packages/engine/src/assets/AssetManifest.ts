export type AssetType = "image" | "spritesheet" | "atlas" | "audio" | "json" | "font" | "tilemap";

export const ASSET_TYPES: readonly AssetType[] = ["image", "spritesheet", "atlas", "audio", "json", "font", "tilemap"];

export type AssetLicense = {
  name: string;
  author?: string;
  url?: string;
};

export type AssetAnimation = {
  key: string;
  frames: readonly (number | string)[];
  frameRate?: number;
  repeat?: number;
  yoyo?: boolean;
};

export type AssetDescriptor = {
  id: string;
  type: AssetType;
  src: string;
  bytes?: number;
  optional?: boolean;
  group?: string;
  license?: AssetLicense;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  margin?: number;
  spacing?: number;
  atlasJson?: string;
  animations?: readonly AssetAnimation[];
  fontFamily?: string;
  data?: unknown;
};

export type AssetIssueCode =
  | "duplicate-id"
  | "duplicate-src"
  | "duplicate-animation"
  | "invalid-id"
  | "missing-src"
  | "unsupported-type"
  | "invalid-field"
  | "broken-reference"
  | "external-url"
  | "frame-out-of-range"
  | "heavy-asset"
  | "size-unknown"
  | "missing-license"
  | "load-failed"
  | "missing-file";

export type AssetIssue = {
  code: AssetIssueCode;
  severity: "error" | "warning";
  message: string;
  id?: string;
  path?: string;
};

export type AssetReferenceMap = Record<string, readonly string[]>;

export type AssetSizeLimits = {
  imageBytes: number;
  audioBytes: number;
  totalBytes: number;
};

export type AssetSizeEntry = {
  id: string;
  type: AssetType;
  bytes: number | null;
};

export type AssetSizeReport = {
  totalBytes: number;
  knownAssets: number;
  unknownAssets: number;
  byType: Partial<Record<AssetType, number>>;
  assets: AssetSizeEntry[];
  issues: AssetIssue[];
};

export const DEFAULT_SIZE_LIMITS: AssetSizeLimits = {
  imageBytes: 512 * 1024,
  audioBytes: 2 * 1024 * 1024,
  totalBytes: 8 * 1024 * 1024
};

const ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export const isValidAssetId = (id: string): boolean => ID_PATTERN.test(id);

export const animationKey = (assetId: string, key: string): string => `${assetId}:${key}`;

const issue = (
  code: AssetIssueCode,
  severity: "error" | "warning",
  message: string,
  id?: string,
  path?: string
): AssetIssue => ({ code, severity, message, id, path });

const isPositiveInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

export class AssetManifest {
  private assets = new Map<string, AssetDescriptor>();

  constructor(descriptors: readonly AssetDescriptor[] = []) {
    this.registerMany(descriptors);
  }

  register(descriptor: AssetDescriptor): AssetDescriptor {
    const normalized = AssetManifest.normalize(descriptor);
    if (this.assets.has(normalized.id)) {
      throw new Error(`Duplicate asset id "${normalized.id}"`);
    }
    this.assets.set(normalized.id, normalized);
    return normalized;
  }

  registerMany(descriptors: readonly AssetDescriptor[]): AssetDescriptor[] {
    const added: AssetDescriptor[] = [];
    for (const descriptor of descriptors) added.push(this.register(descriptor));
    return added;
  }

  replace(descriptors: readonly AssetDescriptor[]): void {
    const next = new AssetManifest(descriptors);
    this.assets = next.assets;
  }

  remove(id: string): boolean {
    return this.assets.delete(id);
  }

  has(id: string): boolean {
    return this.assets.has(id);
  }

  get(id: string): AssetDescriptor | undefined {
    return this.assets.get(id);
  }

  all(): AssetDescriptor[] {
    return Array.from(this.assets.values());
  }

  ids(): string[] {
    return Array.from(this.assets.keys());
  }

  count(): number {
    return this.assets.size;
  }

  groups(): string[] {
    const groups = new Set<string>();
    for (const descriptor of this.assets.values()) if (descriptor.group) groups.add(descriptor.group);
    return Array.from(groups).sort();
  }

  byGroup(group: string): AssetDescriptor[] {
    return this.all().filter((descriptor) => descriptor.group === group);
  }

  animations(): { assetId: string; key: string; animation: AssetAnimation }[] {
    const entries: { assetId: string; key: string; animation: AssetAnimation }[] = [];
    for (const descriptor of this.assets.values()) {
      for (const animation of descriptor.animations ?? []) {
        entries.push({ assetId: descriptor.id, key: animationKey(descriptor.id, animation.key), animation });
      }
    }
    return entries;
  }

  validate(options: { requireLicenses?: boolean; limits?: Partial<AssetSizeLimits> } = {}): AssetIssue[] {
    const issues: AssetIssue[] = [];
    const bySrc = new Map<string, string>();
    for (const descriptor of this.assets.values()) {
      issues.push(...AssetManifest.validateDescriptor(descriptor, options.requireLicenses ?? false));
      const previous = bySrc.get(descriptor.src);
      if (previous) {
        issues.push(
          issue(
            "duplicate-src",
            "warning",
            `Assets "${previous}" and "${descriptor.id}" point at the same file "${descriptor.src}"`,
            descriptor.id,
            "src"
          )
        );
      } else {
        bySrc.set(descriptor.src, descriptor.id);
      }
    }
    issues.push(...this.checkAnimations());
    issues.push(...this.sizeReport(options.limits).issues);
    return issues;
  }

  checkReferences(references: AssetReferenceMap): AssetIssue[] {
    const issues: AssetIssue[] = [];
    for (const [owner, ids] of Object.entries(references)) {
      for (const id of ids) {
        if (this.assets.has(id)) continue;
        issues.push(issue("broken-reference", "error", `"${owner}" references unknown asset "${id}"`, id, owner));
      }
    }
    return issues;
  }

  sizeReport(limits: Partial<AssetSizeLimits> = {}): AssetSizeReport {
    const resolved = { ...DEFAULT_SIZE_LIMITS, ...limits };
    const assets: AssetSizeEntry[] = [];
    const byType: Partial<Record<AssetType, number>> = {};
    const issues: AssetIssue[] = [];
    let totalBytes = 0;
    let unknownAssets = 0;

    for (const descriptor of this.assets.values()) {
      const declared = typeof descriptor.bytes === "number" && descriptor.bytes >= 0 ? descriptor.bytes : null;
      const bytes = declared ?? dataUriBytes(descriptor.src);
      assets.push({ id: descriptor.id, type: descriptor.type, bytes });
      if (bytes === null) {
        unknownAssets += 1;
        issues.push(issue("size-unknown", "warning", `Asset "${descriptor.id}" has no declared byte size`, descriptor.id, "bytes"));
        continue;
      }
      totalBytes += bytes;
      byType[descriptor.type] = (byType[descriptor.type] ?? 0) + bytes;
      if ((descriptor.type === "image" || descriptor.type === "spritesheet" || descriptor.type === "atlas") && bytes > resolved.imageBytes) {
        issues.push(
          issue("heavy-asset", "warning", `Image "${descriptor.id}" is ${formatBytes(bytes)} (limit ${formatBytes(resolved.imageBytes)})`, descriptor.id, "bytes")
        );
      }
      if (descriptor.type === "audio" && bytes > resolved.audioBytes) {
        issues.push(
          issue("heavy-asset", "warning", `Audio "${descriptor.id}" is ${formatBytes(bytes)} (limit ${formatBytes(resolved.audioBytes)})`, descriptor.id, "bytes")
        );
      }
    }

    if (totalBytes > resolved.totalBytes) {
      issues.push(issue("heavy-asset", "warning", `Total asset budget ${formatBytes(totalBytes)} exceeds ${formatBytes(resolved.totalBytes)}`));
    }

    return {
      totalBytes,
      knownAssets: assets.length - unknownAssets,
      unknownAssets,
      byType,
      assets: assets.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)),
      issues
    };
  }

  toJSON(): AssetDescriptor[] {
    return this.all();
  }

  private checkAnimations(): AssetIssue[] {
    const issues: AssetIssue[] = [];
    const seen = new Set<string>();
    for (const descriptor of this.assets.values()) {
      for (const animation of descriptor.animations ?? []) {
        const key = animationKey(descriptor.id, animation.key);
        if (seen.has(key)) {
          issues.push(issue("duplicate-animation", "error", `Duplicate animation key "${key}"`, descriptor.id, "animations"));
          continue;
        }
        seen.add(key);
        if (animation.key.trim() === "") {
          issues.push(issue("invalid-field", "error", `Animation key of "${descriptor.id}" must not be empty`, descriptor.id, "animations"));
        }
        if (animation.frames.length === 0) {
          issues.push(issue("invalid-field", "error", `Animation "${key}" has no frames`, descriptor.id, "animations"));
        }
        if (animation.frameRate !== undefined && (typeof animation.frameRate !== "number" || animation.frameRate <= 0)) {
          issues.push(issue("invalid-field", "error", `Animation "${key}" frameRate must be positive`, descriptor.id, "animations"));
        }
        const frameCount = descriptor.frameCount;
        if (frameCount === undefined) continue;
        for (const frame of animation.frames) {
          if (typeof frame !== "number" || (frame >= 0 && frame < frameCount)) continue;
          issues.push(issue("frame-out-of-range", "error", `Animation "${key}" frame ${frame} is outside 0..${frameCount - 1}`, descriptor.id, "animations"));
        }
      }
    }
    return issues;
  }

  private static validateDescriptor(descriptor: AssetDescriptor, requireLicenses: boolean): AssetIssue[] {
    const issues: AssetIssue[] = [];
    const id = descriptor.id;
    if (!isValidAssetId(id)) {
      issues.push(issue("invalid-id", "error", `Asset id "${id}" must match ${ID_PATTERN.source}`, id, "id"));
    }
    if (!ASSET_TYPES.includes(descriptor.type)) {
      issues.push(issue("unsupported-type", "error", `Asset "${id}" has unsupported type "${String(descriptor.type)}"`, id, "type"));
    }
    if (typeof descriptor.src !== "string" || descriptor.src.trim() === "") {
      issues.push(issue("missing-src", "error", `Asset "${id}" has no src`, id, "src"));
    } else if (/^https?:\/\//i.test(descriptor.src)) {
      issues.push(
        issue("external-url", "warning", `Asset "${id}" uses an absolute URL; the game will not run offline`, id, "src")
      );
    }
    if (descriptor.type === "spritesheet") {
      if (!isPositiveInt(descriptor.frameWidth) || !isPositiveInt(descriptor.frameHeight)) {
        issues.push(
          issue("invalid-field", "error", `Spritesheet "${id}" needs positive integer frameWidth and frameHeight`, id, "frameWidth")
        );
      }
    }
    if (descriptor.type === "atlas" && !descriptor.atlasJson) {
      issues.push(issue("invalid-field", "error", `Atlas "${id}" needs atlasJson`, id, "atlasJson"));
    }
    if (descriptor.type === "font" && !descriptor.atlasJson) {
      issues.push(issue("invalid-field", "error", `Bitmap font "${id}" needs atlasJson with the font data URL`, id, "atlasJson"));
    }
    if (descriptor.bytes !== undefined && (typeof descriptor.bytes !== "number" || descriptor.bytes < 0)) {
      issues.push(issue("invalid-field", "error", `Asset "${id}" bytes must be a non-negative number`, id, "bytes"));
    }
    if (requireLicenses && !descriptor.license) {
      issues.push(issue("missing-license", "error", `Asset "${id}" has no license entry`, id, "license"));
    } else if (descriptor.license && typeof descriptor.license.name !== "string") {
      issues.push(issue("invalid-field", "error", `Asset "${id}" license needs a name`, id, "license"));
    }
    return issues;
  }

  private static normalize(descriptor: AssetDescriptor): AssetDescriptor {
    if (typeof descriptor !== "object" || descriptor === null) throw new Error("Asset descriptor must be an object");
    if (typeof descriptor.id !== "string" || descriptor.id.trim() === "") throw new Error("Asset descriptor needs a non-empty id");
    if (typeof descriptor.src !== "string" || descriptor.src.trim() === "") {
      throw new Error(`Asset "${descriptor.id}" needs a non-empty src`);
    }
    const animations = descriptor.animations ? Object.freeze(descriptor.animations.map((entry) => Object.freeze({ ...entry, frames: Object.freeze([...entry.frames]) }))) : undefined;
    const license = descriptor.license ? Object.freeze({ ...descriptor.license }) : undefined;
    return Object.freeze({ ...descriptor, animations, license });
  }
}

export const dataUriBytes = (src: string): number | null => {
  if (!src.startsWith("data:")) return null;
  const comma = src.indexOf(",");
  if (comma === -1) return null;
  const meta = src.slice(5, comma);
  const payload = src.slice(comma + 1);
  if (meta.includes(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch (error) {
    return null;
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
