import type { ScaleMode } from "../core/EngineConfig";
import type { AssetDescriptor } from "../systems/AssetManager";

export type ProjectFormatV1 = {
  formatVersion: 1;
  name: string;
  game: {
    width: number;
    height: number;
    scaleMode: ScaleMode;
    backgroundColor: string;
  };
  assets: AssetDescriptor[];
};

export type ProjectConfig = ProjectFormatV1;

export const CURRENT_FORMAT_VERSION = 1;

export function validateProjectConfig(input: unknown): { valid: boolean; errors: string[]; config?: ProjectConfig } {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["Project config must be an object"] };
  }
  const o = input as Record<string, unknown>;
  if (o["formatVersion"] !== 1) {
    if (o["formatVersion"] === undefined) errors.push("Missing required field: formatVersion");
    else errors.push(`Unsupported formatVersion ${String(o["formatVersion"])}. Supported: 1`);
  }
  if (typeof o["name"] !== "string" || (o["name"] as string).trim() === "") {
    errors.push("Missing or empty required field: name");
  }
  const game = o["game"] as Record<string, unknown> | undefined;
  if (!game || typeof game !== "object") {
    errors.push("Missing required field: game");
  } else {
    if (typeof game["width"] !== "number" || game["width"] <= 0) errors.push("game.width must be a positive number");
    if (typeof game["height"] !== "number" || game["height"] <= 0) errors.push("game.height must be a positive number");
    if (!["fit", "fill", "fixed", "expand"].includes(game["scaleMode"] as string)) errors.push("game.scaleMode must be one of fit, fill, fixed, expand");
    if (typeof game["backgroundColor"] !== "string" || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(game["backgroundColor"] as string)) {
      errors.push("game.backgroundColor must be a valid hex color");
    }
  }
  const assets = o["assets"] as unknown[] | undefined;
  if (assets !== undefined) {
    if (!Array.isArray(assets)) errors.push("assets must be an array");
    else {
      const seen = new Set<string>();
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i] as Record<string, unknown>;
        if (typeof a["id"] !== "string" || (a["id"] as string).trim() === "") errors.push(`assets[${i}].id must be a non-empty string`);
        else if (seen.has(a["id"] as string)) errors.push(`Duplicate asset id "${a["id"] as string}" at assets[${i}]`);
        else seen.add(a["id"] as string);
        if (!["image", "audio", "json", "spritesheet", "atlas"].includes(a["type"] as string)) errors.push(`assets[${i}].type must be one of image, audio, json, spritesheet, atlas`);
        if (typeof a["src"] !== "string" || (a["src"] as string).trim() === "") errors.push(`assets[${i}].src must be a non-empty string`);
      }
    }
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], config: input as ProjectConfig };
}

export function parseProjectJson(json: string): { valid: boolean; errors: string[]; config?: ProjectConfig } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  return validateProjectConfig(parsed);
}

export function createDefaultProject(name: string): ProjectConfig {
  return {
    formatVersion: 1,
    name,
    game: {
      width: 1280,
      height: 720,
      scaleMode: "fit",
      backgroundColor: "#151515"
    },
    assets: []
  };
}
