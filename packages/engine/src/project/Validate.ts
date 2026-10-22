import { AssetManifest, isValidAssetId, type AssetDescriptor } from "../assets/AssetManifest";
import {
  findUnsafeKey,
  isFiniteNumber,
  measureDepth,
  mergeLimits,
  type ProjectLimits
} from "./Limits";
import {
  CURRENT_PROJECT_VERSION,
  SCALE_MODES,
  SCENE_ID_PATTERN,
  type ProjectFormatV2,
  type ProjectIssue,
  type ProjectSettings,
  type SceneDefinition,
  type SceneObjectDefinition
} from "./Schema";

const issue = (
  code: ProjectIssue["code"],
  severity: ProjectIssue["severity"],
  message: string,
  path: string
): ProjectIssue => ({ code, severity, message, path });

const KNOWN_ROOT_KEYS = new Set(["formatVersion", "name", "settings", "assets", "scenes", "unknownFields"]);
const KNOWN_SETTINGS_KEYS = new Set([
  "width",
  "height",
  "scaleMode",
  "backgroundColor",
  "gravity",
  "seed",
  "fixedStepHz",
  "inputMap",
  "unknownFields"
]);
const KNOWN_SCENE_KEYS = new Set(["id", "camera", "objects", "properties", "unknownFields"]);
const KNOWN_OBJECT_KEYS = new Set([
  "id",
  "kind",
  "asset",
  "x",
  "y",
  "rotation",
  "scaleX",
  "scaleY",
  "width",
  "height",
  "text",
  "tags",
  "body",
  "properties",
  "unknownFields"
]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const pickUnknown = (input: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined => {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) if (!known.has(key)) extra[key] = value;
  return Object.keys(extra).length > 0 ? extra : undefined;
};

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type ProjectValidateOptions = {
  requireLicenses?: boolean;
  limits?: Partial<ProjectLimits>;
};

export type ProjectValidationResult = {
  valid: boolean;
  errors: ProjectIssue[];
  warnings: ProjectIssue[];
  project?: ProjectFormatV2;
};

export const validateProject = (input: unknown, options: ProjectValidateOptions = {}): ProjectValidationResult => {
  const errors: ProjectIssue[] = [];
  const warnings: ProjectIssue[] = [];
  const limits = mergeLimits(options.limits);

  if (!isRecord(input)) {
    return { valid: false, errors: [issue("invalid-type", "error", "Project must be a JSON object", "")], warnings };
  }
  const unsafe = findUnsafeKey(input);
  if (unsafe) {
    return {
      valid: false,
      errors: [issue("unsafe-key", "error", `Forbidden key at "${unsafe}" (prototype pollution guard)`, unsafe)],
      warnings
    };
  }
  const depth = measureDepth(input);
  if (depth > limits.maxDepth) {
    return {
      valid: false,
      errors: [issue("limit-exceeded", "error", `Project nesting depth ${depth} exceeds limit ${limits.maxDepth}`, "")],
      warnings
    };
  }

  const version = input["formatVersion"];
  if (version !== CURRENT_PROJECT_VERSION) {
    errors.push(
      issue(
        "unsupported-version",
        "error",
        version === undefined
          ? "Missing required field: formatVersion"
          : `Unsupported formatVersion ${String(version)}. Supported: ${CURRENT_PROJECT_VERSION} (use migrateProject for older versions)`,
        "formatVersion"
      )
    );
    return { valid: false, errors, warnings };
  }

  if (typeof input["name"] !== "string" || input["name"].trim() === "") {
    errors.push(issue("missing-field", "error", "Project name must be a non-empty string", "name"));
  } else if (input["name"].length > limits.maxStringLength) {
    errors.push(
      issue("limit-exceeded", "error", `Project name is ${input["name"].length} characters, limit ${limits.maxStringLength}`, "name")
    );
  }

  const settings = validateSettings(input["settings"], errors, limits);
  const assets = validateAssets(input["assets"], errors, warnings, options.requireLicenses ?? false, limits);
  const scenes = validateScenes(input["scenes"], errors, warnings, limits);

  const assetIds = new Set(assets.map((asset) => asset.id));
  for (const scene of scenes) {
    for (const object of scene.objects) {
      if (!object.asset) continue;
      if (!assetIds.has(object.asset)) {
        errors.push(
          issue("broken-reference", "error", `Scene "${scene.id}" object "${object.id}" references unknown asset "${object.asset}"`, `scenes.${scene.id}.objects.${object.id}.asset`)
        );
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors, warnings };

  const project: ProjectFormatV2 = {
    formatVersion: CURRENT_PROJECT_VERSION,
    name: input["name"] as string,
    settings: settings as ProjectSettings,
    assets,
    scenes,
    unknownFields: pickUnknown(input, KNOWN_ROOT_KEYS)
  };
  return { valid: true, errors, warnings, project };
};

const validateSettings = (input: unknown, errors: ProjectIssue[], limits: ProjectLimits): ProjectSettings | undefined => {
  if (!isRecord(input)) {
    errors.push(issue("missing-field", "error", "Missing required field: settings", "settings"));
    return undefined;
  }
  if (typeof input["width"] !== "number" || input["width"] <= 0) errors.push(issue("invalid-field", "error", "settings.width must be a positive number", "settings.width"));
  if (typeof input["height"] !== "number" || input["height"] <= 0) errors.push(issue("invalid-field", "error", "settings.height must be a positive number", "settings.height"));
  if (!SCALE_MODES.includes(input["scaleMode"] as never)) {
    errors.push(issue("invalid-field", "error", `settings.scaleMode must be one of ${SCALE_MODES.join(", ")}`, "settings.scaleMode"));
  }
  if (typeof input["backgroundColor"] !== "string" || !HEX_COLOR.test(input["backgroundColor"])) {
    errors.push(issue("invalid-field", "error", "settings.backgroundColor must be a hex colour", "settings.backgroundColor"));
  }
  if (input["seed"] !== undefined && (!Number.isInteger(input["seed"]) || (input["seed"] as number) < 0)) {
    errors.push(issue("invalid-field", "error", "settings.seed must be a non-negative integer", "settings.seed"));
  }
  if (input["fixedStepHz"] !== undefined && (typeof input["fixedStepHz"] !== "number" || input["fixedStepHz"] <= 0 || input["fixedStepHz"] > 480)) {
    errors.push(issue("invalid-field", "error", "settings.fixedStepHz must be between 1 and 480", "settings.fixedStepHz"));
  }
  if (input["inputMap"] !== undefined) {
    const map = input["inputMap"];
    if (!isRecord(map)) {
      errors.push(issue("invalid-type", "error", "settings.inputMap must be an object", "settings.inputMap"));
    } else {
      const actions = Object.keys(map);
      if (actions.length > limits.maxInputActions) {
        errors.push(
          issue("limit-exceeded", "error", `inputMap has ${actions.length} actions, limit ${limits.maxInputActions}`, "settings.inputMap")
        );
      }
      for (const action of actions) {
        if (action.length > limits.maxIdLength) {
          errors.push(issue("limit-exceeded", "error", `Action name "${action.slice(0, 16)}…" is too long`, `settings.inputMap.${action}`));
          continue;
        }
        const keys = map[action];
        if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string")) {
          errors.push(issue("invalid-type", "error", "Action bindings must be an array of strings", `settings.inputMap.${action}`));
          continue;
        }
        if (keys.length > limits.maxKeysPerAction) {
          errors.push(
            issue("limit-exceeded", "error", `Action "${action}" has ${keys.length} keys, limit ${limits.maxKeysPerAction}`, `settings.inputMap.${action}`)
          );
        }
      }
    }
  }
  const gravity = input["gravity"];
  if (gravity !== undefined) {
    if (!isRecord(gravity) || typeof gravity["x"] !== "number" || typeof gravity["y"] !== "number") {
      errors.push(issue("invalid-field", "error", "settings.gravity must be { x, y } numbers", "settings.gravity"));
    }
  }
  return {
    width: input["width"] as number,
    height: input["height"] as number,
    scaleMode: input["scaleMode"] as ProjectSettings["scaleMode"],
    backgroundColor: input["backgroundColor"] as string,
    gravity: isRecord(gravity) ? { x: gravity["x"] as number, y: gravity["y"] as number } : undefined,
    seed: input["seed"] as number | undefined,
    fixedStepHz: input["fixedStepHz"] as number | undefined,
    inputMap: isRecord(input["inputMap"]) ? (input["inputMap"] as Record<string, string[]>) : undefined,
    unknownFields: pickUnknown(input, KNOWN_SETTINGS_KEYS)
  };
};

const validateAssets = (
  input: unknown,
  errors: ProjectIssue[],
  warnings: ProjectIssue[],
  requireLicenses: boolean,
  limits: ProjectLimits
): AssetDescriptor[] => {
  if (input === undefined) {
    warnings.push(issue("missing-field", "warning", "Project has no assets array", "assets"));
    return [];
  }
  if (!Array.isArray(input)) {
    errors.push(issue("invalid-type", "error", "assets must be an array", "assets"));
    return [];
  }
  if (input.length > limits.maxAssets) {
    errors.push(issue("limit-exceeded", "error", `Project has ${input.length} assets, limit ${limits.maxAssets}`, "assets"));
  }
  const manifest = new AssetManifest();
  const assets: AssetDescriptor[] = [];
  input.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(issue("invalid-type", "error", "Asset entry must be an object", `assets[${index}]`));
      return;
    }
    if (typeof entry["id"] !== "string" || !isValidAssetId(entry["id"])) {
      errors.push(issue("invalid-field", "error", "Asset id must be a lower-case stable identifier", `assets[${index}].id`));
      return;
    }
    if (entry["id"].length > limits.maxIdLength) {
      errors.push(issue("limit-exceeded", "error", `Asset id "${entry["id"].slice(0, 16)}…" is too long`, `assets[${index}].id`));
      return;
    }
    if (manifest.has(entry["id"])) {
      errors.push(issue("duplicate-id", "error", `Duplicate asset id "${entry["id"]}"`, `assets[${index}].id`));
      return;
    }
    const descriptor = { ...entry } as unknown as AssetDescriptor;
    try {
      manifest.register(descriptor);
    } catch (error) {
      errors.push(issue("invalid-field", "error", (error as Error).message, `assets[${index}]`));
      return;
    }
    assets.push(descriptor);
  });
  for (const entry of manifest.validate({ requireLicenses })) {
    const target = entry.severity === "error" ? errors : warnings;
    target.push(issue(entry.code as ProjectIssue["code"], entry.severity, entry.message, `assets.${entry.id ?? ""}`));
  }
  return assets;
};

const validateScenes = (
  input: unknown,
  errors: ProjectIssue[],
  warnings: ProjectIssue[],
  limits: ProjectLimits
): SceneDefinition[] => {
  if (input === undefined) {
    warnings.push(issue("missing-field", "warning", "Project has no scenes array", "scenes"));
    return [];
  }
  if (!Array.isArray(input)) {
    errors.push(issue("invalid-type", "error", "scenes must be an array", "scenes"));
    return [];
  }
  if (input.length > limits.maxScenes) {
    errors.push(issue("limit-exceeded", "error", `Project has ${input.length} scenes, limit ${limits.maxScenes}`, "scenes"));
  }
  const seenScenes = new Set<string>();
  const scenes: SceneDefinition[] = [];
  let objectTotal = 0;
  input.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(issue("invalid-type", "error", "Scene entry must be an object", `scenes[${index}]`));
      return;
    }
    const id = entry["id"];
    if (typeof id !== "string" || !SCENE_ID_PATTERN.test(id)) {
      errors.push(issue("invalid-field", "error", "Scene id must match a lower-case identifier", `scenes[${index}].id`));
      return;
    }
    if (seenScenes.has(id)) {
      errors.push(issue("duplicate-id", "error", `Duplicate scene id "${id}"`, `scenes[${index}].id`));
      return;
    }
    seenScenes.add(id);
    if (id.length > limits.maxIdLength) {
      errors.push(issue("limit-exceeded", "error", `Scene id "${id.slice(0, 16)}…" is too long`, `scenes[${index}].id`));
      return;
    }
    const objects = validateObjects(id, entry["objects"], errors, limits);
    objectTotal += objects.length;
    if (objects.length > limits.maxObjectsPerScene) {
      errors.push(
        issue("limit-exceeded", "error", `Scene "${id}" has ${objects.length} objects, limit ${limits.maxObjectsPerScene}`, `scenes.${id}.objects`)
      );
    }
    scenes.push({
      id,
      camera: isRecord(entry["camera"]) ? (entry["camera"] as SceneDefinition["camera"]) : undefined,
      objects,
      properties: isRecord(entry["properties"]) ? (entry["properties"] as Record<string, unknown>) : undefined,
      unknownFields: pickUnknown(entry, KNOWN_SCENE_KEYS)
    });
  });
  if (objectTotal > limits.maxObjects) {
    errors.push(issue("limit-exceeded", "error", `Project has ${objectTotal} objects in total, limit ${limits.maxObjects}`, "scenes"));
  }
  return scenes;
};

const validateObjects = (
  sceneId: string,
  input: unknown,
  errors: ProjectIssue[],
  limits: ProjectLimits
): SceneObjectDefinition[] => {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    errors.push(issue("invalid-type", "error", `Scene "${sceneId}" objects must be an array`, `scenes.${sceneId}.objects`));
    return [];
  }
  const seen = new Set<string>();
  const objects: SceneObjectDefinition[] = [];
  input.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(issue("invalid-type", "error", "Object entry must be an object", `scenes.${sceneId}.objects[${index}]`));
      return;
    }
    const id = entry["id"];
    if (typeof id !== "string" || id.trim() === "") {
      errors.push(issue("missing-field", "error", "Object needs a non-empty id", `scenes.${sceneId}.objects[${index}].id`));
      return;
    }
    if (seen.has(id)) {
      errors.push(issue("duplicate-id", "error", `Duplicate object id "${id}" in scene "${sceneId}"`, `scenes.${sceneId}.objects[${index}].id`));
      return;
    }
    seen.add(id);
    if (entry["body"] !== undefined && entry["body"] !== "dynamic" && entry["body"] !== "static") {
      errors.push(issue("invalid-field", "error", "body must be \"dynamic\" or \"static\"", `scenes.${sceneId}.objects.${id}.body`));
    }
    if (id.length > limits.maxIdLength) {
      errors.push(issue("limit-exceeded", "error", `Object id "${id.slice(0, 16)}…" is too long`, `scenes.${sceneId}.objects[${index}].id`));
      return;
    }
    if (typeof entry["text"] === "string" && entry["text"].length > limits.maxStringLength) {
      errors.push(
        issue("limit-exceeded", "error", `Object text is ${entry["text"].length} characters, limit ${limits.maxStringLength}`, `scenes.${sceneId}.objects.${id}.text`)
      );
    }
    const tags = entry["tags"];
    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
        errors.push(issue("invalid-type", "error", "tags must be an array of strings", `scenes.${sceneId}.objects.${id}.tags`));
      } else if (tags.length > limits.maxTagsPerObject) {
        errors.push(
          issue("limit-exceeded", "error", `Object has ${tags.length} tags, limit ${limits.maxTagsPerObject}`, `scenes.${sceneId}.objects.${id}.tags`)
        );
      }
    }
    const properties = entry["properties"];
    if (properties !== undefined) {
      if (!isRecord(properties)) {
        errors.push(issue("invalid-type", "error", "properties must be an object", `scenes.${sceneId}.objects.${id}.properties`));
      } else if (Object.keys(properties).length > limits.maxPropertiesPerRecord) {
        errors.push(
          issue("limit-exceeded", "error", `Object has ${Object.keys(properties).length} properties, limit ${limits.maxPropertiesPerRecord}`, `scenes.${sceneId}.objects.${id}.properties`)
        );
      }
    }
    for (const key of ["x", "y", "rotation", "scaleX", "scaleY", "width", "height"] as const) {
      const value = entry[key];
      if (value === undefined) continue;
      if (!isFiniteNumber(value)) {
        errors.push(issue("invalid-field", "error", `${key} must be a finite number`, `scenes.${sceneId}.objects.${id}.${key}`));
        continue;
      }
      if ((key === "x" || key === "y" || key === "width" || key === "height") && Math.abs(value) > limits.maxCoordinate) {
        errors.push(
          issue("limit-exceeded", "error", `${key} ${value} exceeds the supported range ±${limits.maxCoordinate}`, `scenes.${sceneId}.objects.${id}.${key}`)
        );
      }
    }
    objects.push({ ...(entry as unknown as SceneObjectDefinition), unknownFields: pickUnknown(entry, KNOWN_OBJECT_KEYS) });
  });
  return objects;
};
