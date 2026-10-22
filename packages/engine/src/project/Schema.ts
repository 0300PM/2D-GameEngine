import type { ScaleMode } from "../core/EngineConfig";
import type { AssetDescriptor } from "../assets/AssetManifest";

export const CURRENT_PROJECT_VERSION = 2;

export type SceneObjectDefinition = {
  id: string;
  kind?: "sprite" | "text" | "rect" | "ellipse" | "body";
  asset?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  text?: string;
  tags?: string[];
  body?: "dynamic" | "static";
  properties?: Record<string, unknown>;
  unknownFields?: Record<string, unknown>;
};

export type SceneDefinition = {
  id: string;
  camera?: { x?: number; y?: number; zoom?: number };
  objects: SceneObjectDefinition[];
  properties?: Record<string, unknown>;
  unknownFields?: Record<string, unknown>;
};

export type ProjectSettings = {
  width: number;
  height: number;
  scaleMode: ScaleMode;
  backgroundColor: string;
  gravity?: { x: number; y: number };
  seed?: number;
  fixedStepHz?: number;
  inputMap?: Record<string, string[]>;
  unknownFields?: Record<string, unknown>;
};

export type ProjectFormatV2 = {
  formatVersion: 2;
  name: string;
  settings: ProjectSettings;
  assets: AssetDescriptor[];
  scenes: SceneDefinition[];
  unknownFields?: Record<string, unknown>;
};

export type ProjectConfig = ProjectFormatV2;

export type ProjectIssue = {
  code:
    | "invalid-type"
    | "missing-field"
    | "invalid-field"
    | "duplicate-id"
    | "broken-reference"
    | "unsupported-version"
    | "checksum-mismatch"
    | "invalid-json"
    | "limit-exceeded"
    | "unsafe-key"
    | "missing-license"
    | "duplicate-src"
    | "broken-asset-ref"
    | "frame-out-of-range"
    | "heavy-asset"
    | "size-unknown"
    | "external-url";
  severity: "error" | "warning";
  message: string;
  path: string;
};

export const SCENE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const SCALE_MODES: readonly ScaleMode[] = ["fit", "fill", "fixed", "expand"];

export const createDefaultProject = (name = "Untitled"): ProjectFormatV2 => ({
  formatVersion: CURRENT_PROJECT_VERSION,
  name,
  settings: {
    width: 1280,
    height: 720,
    scaleMode: "fit",
    backgroundColor: "#151515"
  },
  assets: [],
  scenes: []
});
