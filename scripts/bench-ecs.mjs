import { performance } from "node:perf_hooks";

const ENTITIES = 20000;
const FRAMES = 120;
const WARMUP = 10;
const DESTROY_BATCH = 5000;

class Component {
  constructor() {
    this.sequence = 0;
    this.phase = "behavior";
    this.order = 0;
    this.enabled = true;
    this.owner = null;
  }
  onUpdate() {}
}

class Transform {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.scaleX = 1;
    this.scaleY = 1;
  }
}

class GameObject {
  constructor(id, x, y) {
    this.id = id;
    this.tags = new Set();
    this.transform = new Transform();
    this.transform.x = x;
    this.transform.y = y;
    this.children = [];
    this.components = new Map();
    this.worldDirty = true;
    this.world = new Transform();
  }

  add(component) {
    this.components.set(component.constructor, component);
    component.owner = this;
    return component;
  }

  get(ctor) {
    return this.components.get(ctor);
  }

  markWorldDirty() {
    this.worldDirty = true;
  }

  recomputeWorld() {
    const parent = this.parent;
    if (!parent) {
      this.world.x = this.transform.x;
      this.world.y = this.transform.y;
    } else {
      this.world.x = parent.world.x + this.transform.x;
      this.world.y = parent.world.y + this.transform.y;
    }
    this.worldDirty = false;
  }
}

class Motion extends Component {
  constructor(vx, vy) {
    super();
    this.vx = vx;
    this.vy = vy;
  }
  onUpdate(dt) {
    const owner = this.owner;
    owner.transform.x += this.vx * dt;
    owner.transform.y += this.vy * dt;
    owner.markWorldDirty();
  }
}

class Lifetime extends Component {
  constructor(seconds) {
    super();
    this.remaining = seconds;
  }
  onUpdate(dt) {
    this.remaining -= dt;
  }
}

const measure = (label, fn) => {
  let best = Number.POSITIVE_INFINITY;
  let value;
  for (let repeat = 0; repeat < 3; repeat += 1) {
    for (let index = 0; index < WARMUP; index += 1) fn();
    const before = performance.now();
    value = fn();
    best = Math.min(best, performance.now() - before);
  }
  return { label, ms: Number(best.toFixed(2)), value };
};

const instantiateObjects = () => {
  const objects = [];
  for (let index = 0; index < ENTITIES; index += 1) {
    const object = new GameObject(`entity-${index}`, index % 100, Math.floor(index / 100));
    object.tags.add("mover");
    if (index % 3 === 0) object.tags.add("fast");
    object.add(new Motion(1, 0.5));
    if (index % 2 === 0) object.add(new Lifetime(30));
    objects.push(object);
  }
  return objects;
};

const runObjectUpdate = (objects) => {
  let sum = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (let index = 0; index < objects.length; index += 1) {
      const object = objects[index];
      const motion = object.get(Motion);
      if (motion) motion.onUpdate(0.016);
      const lifetime = object.get(Lifetime);
      if (lifetime) lifetime.onUpdate(0.016);
      if (object.worldDirty) {
        object.recomputeWorld();
        sum += object.world.x;
      }
    }
  }
  return sum;
};

const runObjectDestroy = (objects) => {
  const pending = new Set(objects.slice(0, DESTROY_BATCH));
  let alive = objects;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (let index = 0; index < alive.length; index += 1) {
      const motion = alive[index].get(Motion);
      if (motion) motion.onUpdate(0.016);
    }
    if (frame === 0) alive = alive.filter((object) => !pending.has(object));
  }
  return alive.length;
};

const runObjectQuery = (objects) => {
  const matches = [];
  for (const object of objects) {
    if (object.tags.has("mover") && object.tags.has("fast")) matches.push(object);
  }
  return matches.length;
};

class SoaWorld {
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;
    this.positionX = new Float64Array(capacity);
    this.positionY = new Float64Array(capacity);
    this.velocityX = new Float64Array(capacity);
    this.velocityY = new Float64Array(capacity);
    this.lifetime = new Float64Array(capacity);
    this.mask = new Uint8Array(capacity);
    this.fast = new Uint8Array(capacity);
  }

  spawn(x, y, vx, vy, hasLifetime, isFast) {
    const index = this.count;
    this.positionX[index] = x;
    this.positionY[index] = y;
    this.velocityX[index] = vx;
    this.velocityY[index] = vy;
    this.lifetime[index] = hasLifetime ? 30 : 0;
    this.mask[index] = 1 | (hasLifetime ? 2 : 0);
    this.fast[index] = isFast ? 1 : 0;
    this.count += 1;
    return index;
  }

  removeBatch(amount) {
    const keep = this.count - amount;
    for (let index = amount; index < this.count; index += 1) {
      const target = index - amount;
      this.positionX[target] = this.positionX[index];
      this.positionY[target] = this.positionY[index];
      this.velocityX[target] = this.velocityX[index];
      this.velocityY[target] = this.velocityY[index];
      this.lifetime[target] = this.lifetime[index];
      this.mask[target] = this.mask[index];
      this.fast[target] = this.fast[index];
    }
    this.count = keep;
  }
}

const instantiateSoa = () => {
  const world = new SoaWorld(ENTITIES + 1);
  for (let index = 0; index < ENTITIES; index += 1) {
    world.spawn(index % 100, Math.floor(index / 100), 1, 0.5, index % 2 === 0, index % 3 === 0);
  }
  return world;
};

const runSoaUpdate = (world) => {
  let sum = 0;
  const { positionX, positionY, velocityX, velocityY, lifetime, mask } = world;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (let index = 0; index < world.count; index += 1) {
      const flags = mask[index];
      if (flags & 1) {
        positionX[index] += velocityX[index] * 0.016;
        positionY[index] += velocityY[index] * 0.016;
        sum += positionX[index];
      }
      if (flags & 2) lifetime[index] -= 0.016;
    }
  }
  return sum;
};

const runSoaDestroy = (world) => {
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const { positionX, positionY, velocityX, velocityY, mask } = world;
    for (let index = 0; index < world.count; index += 1) {
      if (mask[index] & 1) {
        positionX[index] += velocityX[index] * 0.016;
        positionY[index] += velocityY[index] * 0.016;
      }
    }
    if (frame === 0) world.removeBatch(DESTROY_BATCH);
  }
  return world.count;
};

const runSoaQuery = (world) => {
  let matches = 0;
  for (let index = 0; index < world.count; index += 1) {
    if (world.mask[index] & 1 && world.fast[index]) matches += 1;
  }
  return matches;
};

const report = (rows) => {
  const width = Math.max(...rows.map((row) => row.label.length)) + 2;
  for (const row of rows) {
    const perFrame = row.label.startsWith("update") || row.label.startsWith("destroy") ? `${(row.ms / FRAMES).toFixed(3)} ms/frame` : "";
    console.log(`${row.label.padEnd(width)}${String(row.value).padStart(12)}${String(row.ms).padStart(10)} ms  ${perFrame}`);
  }
};

const results = {};
const objects = instantiateObjects();
const soa = instantiateSoa();

const updateObjects = measure("update/objects", () => runObjectUpdate(objects));
const updateSoa = measure("update/ecs", () => runSoaUpdate(soa));
const spawnObjects = measure("spawn/objects", () => instantiateObjects().length);
const spawnSoa = measure("spawn/ecs", () => instantiateSoa().count);
const destroyObjects = measure("destroy/objects", () => runObjectDestroy(instantiateObjects()));
const destroySoa = measure("destroy/ecs", () => runSoaDestroy(instantiateSoa()));
const queryObjects = measure("query/objects", () => runObjectQuery(objects));
const querySoa = measure("query/ecs", () => runSoaQuery(soa));

results.entities = ENTITIES;
results.frames = FRAMES;
results.rows = [updateObjects, updateSoa, spawnObjects, spawnSoa, destroyObjects, destroySoa, queryObjects, querySoa];

report(results.rows);
console.log(JSON.stringify({ entities: ENTITIES, frames: FRAMES, rows: results.rows }));
