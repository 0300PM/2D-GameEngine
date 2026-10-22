import type { AssetIssue } from "./AssetManifest";

export type TiledMapSize = { width: number; height: number; tileWidth: number; tileHeight: number };

export type TiledTileset = {
  assetId: string;
  firstGid: number;
  name: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  tileCount: number;
  image?: string;
  source?: string;
};

export type TiledTileLayer = {
  name: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  data: number[];
};

export type TiledObject = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | number | boolean>;
};

export type TiledObjectLayer = {
  name: string;
  visible: boolean;
  objects: TiledObject[];
};

export type TiledMap = {
  name: string;
  orientation: "orthogonal";
  size: TiledMapSize;
  layers: TiledTileLayer[];
  objectLayers: TiledObjectLayer[];
  tilesets: TiledTileset[];
  properties: Record<string, string | number | boolean>;
};

export type TiledImportResult = {
  map: TiledMap | null;
  issues: AssetIssue[];
};

export type TiledSpawn = {
  name: string;
  type: string;
  x: number;
  y: number;
  properties: Record<string, string | number | boolean>;
};

const issue = (message: string, path?: string): AssetIssue => ({ code: "invalid-field", severity: "error", message, path });

const toNumber = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

const readProperties = (input: unknown): Record<string, string | number | boolean> => {
  const output: Record<string, string | number | boolean> = {};
  if (!Array.isArray(input)) return output;
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) continue;
    const property = entry as { name?: unknown; value?: unknown };
    if (typeof property.name !== "string") continue;
    if (typeof property.value === "string" || typeof property.value === "number" || typeof property.value === "boolean") {
      output[property.name] = property.value;
    }
  }
  return output;
};

const assetIdFor = (source: string, prefix: string): string => {
  const file = source.split(/[\\/]/).pop() ?? source;
  const base = file.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}${slug || "tileset"}`;
};

export const importTiledMap = (input: unknown, options: { assetIdPrefix?: string } = {}): TiledImportResult => {
  const issues: AssetIssue[] = [];
  const prefix = options.assetIdPrefix ?? "tileset:";
  if (typeof input !== "object" || input === null) {
    return { map: null, issues: [issue("Tiled map must be an object")] };
  }
  const raw = input as Record<string, unknown>;
  if (raw["infinite"] === true) issues.push(issue("Infinite Tiled maps are not supported; export with fixed size"));
  const orientation = raw["orientation"] ?? "orthogonal";
  if (orientation !== "orthogonal") issues.push(issue(`Only orthogonal maps are supported, got "${String(orientation)}"`));

  const width = toNumber(raw["width"]);
  const height = toNumber(raw["height"]);
  const tileWidth = toNumber(raw["tilewidth"]);
  const tileHeight = toNumber(raw["tileheight"]);
  if (width <= 0 || height <= 0) issues.push(issue("Map width and height must be positive"));
  if (tileWidth <= 0 || tileHeight <= 0) issues.push(issue("Map tilewidth and tileheight must be positive"));

  const tilesets: TiledTileset[] = [];
  const rawTilesets = Array.isArray(raw["tilesets"]) ? raw["tilesets"] : [];
  rawTilesets.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      issues.push(issue(`tilesets[${index}] must be an object`, `tilesets[${index}]`));
      return;
    }
    const tileset = entry as Record<string, unknown>;
    const firstGid = toNumber(tileset["firstgid"]);
    const source = typeof tileset["source"] === "string" ? tileset["source"] : undefined;
    if (source) issues.push(issue(`External tileset "${source}" must be embedded before import`, `tilesets[${index}]`));
    const name = typeof tileset["name"] === "string" ? tileset["name"] : `tileset-${index}`;
    const image = typeof tileset["image"] === "string" ? tileset["image"] : undefined;
    const imageWidth = toNumber(tileset["imagewidth"]);
    const columns = toNumber(tileset["columns"]) || (imageWidth > 0 ? Math.floor(imageWidth / Math.max(1, toNumber(tileset["tilewidth"], 1))) : 0);
    tilesets.push({
      assetId: assetIdFor(source ?? image ?? name, prefix),
      firstGid,
      name,
      tileWidth: toNumber(tileset["tilewidth"], tileWidth),
      tileHeight: toNumber(tileset["tileheight"], tileHeight),
      columns,
      tileCount: toNumber(tileset["tilecount"]),
      image,
      source
    });
  });

  const layers: TiledTileLayer[] = [];
  const objectLayers: TiledObjectLayer[] = [];
  const rawLayers = Array.isArray(raw["layers"]) ? raw["layers"] : [];
  rawLayers.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      issues.push(issue(`layers[${index}] must be an object`, `layers[${index}]`));
      return;
    }
    const layer = entry as Record<string, unknown>;
    const name = typeof layer["name"] === "string" ? layer["name"] : `layer-${index}`;
    if (layer["type"] === "tilelayer") {
      const data = Array.isArray(layer["data"]) ? layer["data"].map((value) => toNumber(value)) : null;
      if (!data) {
        issues.push(issue(`Tile layer "${name}" needs encoded or base64 data`, `layers[${index}]`));
        return;
      }
      layers.push({
        name,
        width: toNumber(layer["width"], width),
        height: toNumber(layer["height"], height),
        visible: layer["visible"] !== false,
        opacity: toNumber(layer["opacity"], 1),
        data
      });
      return;
    }
    if (layer["type"] === "objectgroup") {
      const objects: TiledObject[] = [];
      const rawObjects = Array.isArray(layer["objects"]) ? layer["objects"] : [];
      rawObjects.forEach((value, objectIndex) => {
        if (typeof value !== "object" || value === null) {
          issues.push(issue(`objects[${objectIndex}] of "${name}" must be an object`, `layers[${index}].objects[${objectIndex}]`));
          return;
        }
        const object = value as Record<string, unknown>;
        objects.push({
          id: toNumber(object["id"]),
          name: typeof object["name"] === "string" ? object["name"] : "",
          type: typeof object["type"] === "string" ? object["type"] : typeof object["class"] === "string" ? object["class"] : "",
          x: toNumber(object["x"]),
          y: toNumber(object["y"]),
          width: toNumber(object["width"]),
          height: toNumber(object["height"]),
          properties: readProperties(object["properties"])
        });
      });
      objectLayers.push({ name, visible: layer["visible"] !== false, objects });
    }
  });

  if (issues.some((entry) => entry.severity === "error")) return { map: null, issues };

  return {
    map: {
      name: typeof raw["name"] === "string" ? raw["name"] : "tiled-map",
      orientation: "orthogonal",
      size: { width, height, tileWidth, tileHeight },
      layers,
      objectLayers,
      tilesets,
      properties: readProperties(raw["properties"])
    },
    issues
  };
};

export const collectSpawns = (map: TiledMap, layerName: string): TiledSpawn[] => {
  const layer = map.objectLayers.find((entry) => entry.name === layerName);
  if (!layer) return [];
  return layer.objects.map((object) => ({
    name: object.name || object.type || `object-${object.id}`,
    type: object.type,
    x: object.x,
    y: object.y,
    properties: object.properties
  }));
};

export const objectLayerToSpawns = collectSpawns;
