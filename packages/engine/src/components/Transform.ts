export type TransformData = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

const STRIDE = 5;

export const identityTransform = (): TransformData => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });

export const composeTransform = (parent: TransformData, local: TransformData): TransformData => {
  if (parent.rotation === 0 && parent.scaleX === 1 && parent.scaleY === 1) {
    return {
      x: parent.x + local.x,
      y: parent.y + local.y,
      rotation: local.rotation,
      scaleX: local.scaleX,
      scaleY: local.scaleY
    };
  }
  const cosine = Math.cos(parent.rotation);
  const sine = Math.sin(parent.rotation);
  const localX = local.x * parent.scaleX;
  const localY = local.y * parent.scaleY;
  return {
    x: parent.x + localX * cosine - localY * sine,
    y: parent.y + localX * sine + localY * cosine,
    rotation: parent.rotation + local.rotation,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY
  };
};

export class Transform {
  constructor(
    public x = 0,
    public y = 0,
    public rotation = 0,
    public scaleX = 1,
    public scaleY = 1
  ) {}

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setRotation(rad: number): this {
    this.rotation = rad;
    return this;
  }

  setScale(x: number, y = x): this {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }

  translate(dx: number, dy: number): this {
    this.x += dx;
    this.y += dy;
    return this;
  }

  clone(): Transform {
    return new Transform(this.x, this.y, this.rotation, this.scaleX, this.scaleY);
  }

  toData(): TransformData {
    return { x: this.x, y: this.y, rotation: this.rotation, scaleX: this.scaleX, scaleY: this.scaleY };
  }

  writeTo(buffer: Float64Array, offset = 0): Float64Array {
    buffer[offset] = this.x;
    buffer[offset + 1] = this.y;
    buffer[offset + 2] = this.rotation;
    buffer[offset + 3] = this.scaleX;
    buffer[offset + 4] = this.scaleY;
    return buffer;
  }

  readFrom(buffer: Float64Array, offset = 0): this {
    this.x = buffer[offset];
    this.y = buffer[offset + 1];
    this.rotation = buffer[offset + 2];
    this.scaleX = buffer[offset + 3];
    this.scaleY = buffer[offset + 4];
    return this;
  }

  compose(parent: TransformData): Transform {
    const world = composeTransform(parent, this.toData());
    return new Transform(world.x, world.y, world.rotation, world.scaleX, world.scaleY);
  }

  static fromData(d: TransformData): Transform {
    return new Transform(d.x, d.y, d.rotation, d.scaleX, d.scaleY);
  }

  static stride = STRIDE;
}
