import { Component } from "../packages/engine/src/core/Component";
import { GameObject } from "../packages/engine/src/core/GameObject";
import { ObjectIndex } from "../packages/engine/src/core/ObjectIndex";
import { PhysicsManager } from "../packages/engine/src/systems/PhysicsManager";
import { AssetManager } from "../packages/engine/src/systems/AssetManager";
import { collectSpawns, importTiledMap } from "../packages/engine/src/assets/TiledMap";
import type { ColliderHandle, ColliderPair, CollisionHandler, PhysicsPort, Vec2 } from "../packages/engine/src/core/ports";
import type { AssetDescriptor } from "../packages/engine/src/assets/AssetManifest";

export type BenchmarkCase = {
  group: string;
  name: string;
  run: () => void;
};

class Drift extends Component {
  phase = "behavior" as const;

  onUpdate(): void {
    const owner = this.owner;
    if (owner) owner.transform.x += 0.5;
  }
}

class StubPhysicsPort implements PhysicsPort {
  readonly colliders: { a: ColliderPair; b: ColliderPair; handler?: CollisionHandler }[] = [];

  setWorldBounds(): void {
    return undefined;
  }

  attachBody(): void {
    return undefined;
  }

  detachBody(): void {
    return undefined;
  }

  readPosition(): Vec2 | null {
    return { x: 0, y: 0 };
  }

  setVelocity(): void {
    return undefined;
  }

  getVelocity(): Vec2 {
    return { x: 0, y: 0 };
  }

  setImmovable(): void {
    return undefined;
  }

  setCollideWorldBounds(): void {
    return undefined;
  }

  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle {
    this.colliders.push({ a, b, handler });
    return { active: true, destroy: () => undefined };
  }

  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle {
    this.colliders.push({ a, b, handler });
    return { active: true, destroy: () => undefined };
  }

  clear(): void {
    this.colliders.length = 0;
  }
}

const buildObjects = (count: number): GameObject[] => {
  const objects: GameObject[] = [];
  for (let index = 0; index < count; index += 1) {
    objects.push(
      new GameObject(`object-${index}`, {
        x: index % 100,
        y: Math.floor(index / 100),
        tags: ["entity"],
        render: { kind: "rect", width: 8, height: 8, color: 0xffffff }
      })
    );
  }
  return objects;
};

const buildIndex = (size: number): ObjectIndex => {
  const index = new ObjectIndex();
  for (let position = 0; position < size; position += 1) {
    index.add(
      new GameObject(`id-${position}`, {
        name: `unit-${position}`,
        x: position % 100,
        y: Math.floor(position / 100),
        tags: position % 2 === 0 ? ["enemy", "red"] : ["enemy", "blue"]
      })
    );
  }
  return index;
};

const MAP_SIZE = 128;
const SPAWNS = 64;

const buildTiledMap = (): unknown => {
  const ground = new Array<number>(MAP_SIZE * MAP_SIZE);
  for (let index = 0; index < ground.length; index += 1) ground[index] = index % 7 === 0 ? 1 : 2;
  return {
    name: "bench-map",
    orientation: "orthogonal",
    width: MAP_SIZE,
    height: MAP_SIZE,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { name: "ground", type: "tilelayer", width: MAP_SIZE, height: MAP_SIZE, data: ground },
      {
        name: "walls",
        type: "tilelayer",
        width: MAP_SIZE,
        height: MAP_SIZE,
        data: new Array<number>(MAP_SIZE * MAP_SIZE).fill(0).map((_, index) => (index % 11 === 0 ? 3 : 0))
      }
    ],
    tilesets: [{ firstgid: 1, name: "tiles", tilewidth: 32, tileheight: 32, tilecount: 64, columns: 8, image: "tiles.png" }],
    objectgroups: [
      {
        name: "spawns",
        type: "objectgroup",
        objects: Array.from({ length: SPAWNS }, (_, index) => ({
          id: index + 1,
          name: "crystal",
          x: (index % 8) * 256,
          y: Math.floor(index / 8) * 256,
          width: 16,
          height: 16
        }))
      }
    ]
  };
};

const ASSET_COUNT = 500;

const buildAssets = (): AssetManager => {
  const manager = new AssetManager();
  const descriptors: AssetDescriptor[] = Array.from({ length: ASSET_COUNT }, (_, index) => ({
    id: `asset-${index}`,
    type: index % 5 === 0 ? "audio" : "image",
    src: `/assets/file-${index}.${index % 5 === 0 ? "wav" : "png"}`,
    bytes: 4096 + index,
    license: { name: "CC0" }
  }));
  manager.registerMany(descriptors);
  return manager;
};

const assetIds = (count: number): string[] => Array.from({ length: count }, (_, index) => `asset-${index}`);
const tiledMap = buildTiledMap();
const player = new GameObject("player", { x: 0, y: 0 });
const enemies = Array.from({ length: 200 }, (_, index) => new GameObject(`enemy-${index}`, { x: index, y: index }));

const aabb = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

export const BENCHMARK_CASES: readonly BenchmarkCase[] = [
  {
    group: "objects",
    name: "create 2 000 objects",
    run: () => {
      buildObjects(2000);
    }
  },
  {
    group: "objects",
    name: "create 2 000 objects with a component",
    run: () => {
      for (const object of buildObjects(2000)) object.add(new Drift());
    }
  },
  {
    group: "objects",
    name: "update 2 000 transforms and read world space",
    run: () => {
      let sum = 0;
      for (const object of buildObjects(2000)) {
        object.translate(1, 1);
        sum += object.world.x;
      }
      if (sum < 0) throw new Error("unreachable");
    }
  },
  {
    group: "objects",
    name: "destroy 2 000 objects",
    run: () => {
      for (const object of buildObjects(2000)) object.internalDestroy();
    }
  },
  {
    group: "queries",
    name: "index 2 000 objects",
    run: () => {
      buildIndex(2000);
    }
  },
  {
    group: "queries",
    name: "find by id in 2 000 objects",
    run: () => {
      const index = buildIndex(2000);
      for (let position = 0; position < 2000; position += 1) index.get(`id-${position}`);
    }
  },
  {
    group: "queries",
    name: "find 1 000 by tag",
    run: () => {
      buildIndex(2000).byTagName("enemy");
    }
  },
  {
    group: "queries",
    name: "find by two tags (all) in 2 000 objects",
    run: () => {
      buildIndex(2000).byTags(["enemy", "red"], "all");
    }
  },
  {
    group: "collisions",
    name: "register 200 overlap pairs",
    run: () => {
      const manager = new PhysicsManager();
      manager.attach(new StubPhysicsPort());
      for (const enemy of enemies) manager.addOverlap(player, enemy, () => undefined);
    }
  },
  {
    group: "collisions",
    name: "dispatch 5 000 overlap callbacks",
    run: () => {
      const handler = (): void => undefined;
      for (let iteration = 0; iteration < 5000; iteration += 1) handler();
    }
  },
  {
    group: "collisions",
    name: "broad-phase AABB over 5 000 pairs",
    run: () => {
      let hits = 0;
      for (let iteration = 0; iteration < 5000; iteration += 1) {
        const x = iteration % 640;
        const y = Math.floor(iteration / 640);
        if (aabb(x, y, 16, 16, x + 8, y + 8, 16, 16)) hits += 1;
      }
      if (hits < 0) throw new Error("unreachable");
    }
  },
  {
    group: "tilemap",
    name: "import 128×128 Tiled map",
    run: () => {
      importTiledMap(tiledMap);
    }
  },
  {
    group: "tilemap",
    name: "import and collect spawns",
    run: () => {
      const result = importTiledMap(tiledMap);
      if (result.map) collectSpawns(result.map);
    }
  },
  {
    group: "assets",
    name: "register 500 assets",
    run: () => {
      buildAssets();
    }
  },
  {
    group: "assets",
    name: "validate a 500 asset manifest",
    run: () => {
      buildAssets().validate({ requireLicenses: true });
    }
  },
  {
    group: "assets",
    name: "build a size report for 500 assets",
    run: () => {
      buildAssets().sizeReport();
    }
  },
  {
    group: "assets",
    name: "diagnose usage of 500 assets",
    run: () => {
      buildAssets().diagnose({ usedIds: assetIds(400) });
    }
  }
];
