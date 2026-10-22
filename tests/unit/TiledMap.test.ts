import { describe, expect, it } from "vitest";
import { collectSpawns, importTiledMap } from "../../packages/engine/src/assets/TiledMap";

const map = {
  type: "map",
  version: "1.10",
  orientation: "orthogonal",
  infinite: false,
  width: 4,
  height: 2,
  tilewidth: 16,
  tileheight: 16,
  properties: [{ name: "music", type: "string", value: "cave" }],
  tilesets: [
    {
      firstgid: 1,
      name: "terrain",
      image: "tiles/terrain.png",
      imagewidth: 64,
      tilewidth: 16,
      tileheight: 16,
      columns: 4,
      tilecount: 8
    }
  ],
  layers: [
    { type: "tilelayer", name: "ground", width: 4, height: 2, visible: true, opacity: 1, data: [1, 2, 3, 4, 5, 6, 7, 8] },
    {
      type: "objectgroup",
      name: "spawns",
      visible: true,
      objects: [
        {
          id: 7,
          name: "player-start",
          type: "spawn",
          x: 32,
          y: 48,
          width: 16,
          height: 16,
          properties: [{ name: "team", type: "string", value: "blue" }]
        }
      ]
    }
  ]
};

describe("importTiledMap", () => {
  it("imports layers, tilesets and object groups", () => {
    const result = importTiledMap(map);
    expect(result.issues).toEqual([]);
    const imported = result.map!;
    expect(imported.size).toEqual({ width: 4, height: 2, tileWidth: 16, tileHeight: 16 });
    expect(imported.layers[0].data).toHaveLength(8);
    expect(imported.tilesets[0]).toMatchObject({ assetId: "tileset:terrain", firstGid: 1, tileCount: 8, columns: 4 });
    expect(imported.objectLayers[0].objects[0]).toMatchObject({ name: "player-start", x: 32, y: 48 });
    expect(imported.objectLayers[0].objects[0].properties).toEqual({ team: "blue" });
    expect(imported.properties).toEqual({ music: "cave" });
  });

  it("derives stable tileset asset ids from the file name", () => {
    const result = importTiledMap(
      { ...map, tilesets: [{ ...map.tilesets[0], name: "Dungeon Tiles", image: "art/Dungeon Tiles.png" }] },
      { assetIdPrefix: "map:" }
    );
    expect(result.map!.tilesets[0].assetId).toBe("map:dungeon-tiles");
  });

  it("rejects infinite maps", () => {
    const result = importTiledMap({ ...map, infinite: true });
    expect(result.map).toBeNull();
    expect(result.issues[0].message).toMatch(/infinite/i);
  });

  it("rejects non-orthogonal orientations", () => {
    const result = importTiledMap({ ...map, orientation: "isometric" });
    expect(result.map).toBeNull();
    expect(result.issues.some((entry) => entry.message.includes("orthogonal"))).toBe(true);
  });

  it("flags external tilesets and missing tile data", () => {
    const result = importTiledMap({
      ...map,
      tilesets: [{ firstgid: 1, source: "terrain.tsx" }],
      layers: [{ type: "tilelayer", name: "broken", width: 4, height: 2 }]
    });
    expect(result.map).toBeNull();
    expect(result.issues.map((entry) => entry.message).join(" ")).toContain("External tileset");
  });

  it("reports non-object input", () => {
    expect(importTiledMap(null).issues[0].code).toBe("invalid-field");
  });

  it("extracts spawn points from an object layer", () => {
    const imported = importTiledMap(map).map!;
    const spawns = collectSpawns(imported, "spawns");
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ name: "player-start", type: "spawn", x: 32, y: 48 });
    expect(collectSpawns(imported, "missing")).toEqual([]);
  });
});
