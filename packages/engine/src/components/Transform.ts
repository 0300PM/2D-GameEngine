export type TransformData = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
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

  static fromData(d: TransformData): Transform {
    return new Transform(d.x, d.y, d.rotation, d.scaleX, d.scaleY);
  }
}
