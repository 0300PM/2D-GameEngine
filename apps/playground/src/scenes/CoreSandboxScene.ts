import { benchmarkNativeCore, Component, formatBenchmark, Random, Scene } from "@engine";
import type { GameObject, SystemPhase, TextStyleData } from "@engine";

const style = (size: string, color: string, fontStyle?: string): TextStyleData => ({
  fontFamily: "monospace",
  fontSize: size,
  color,
  fontStyle
});

class Bobbing extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;

  constructor(
    private amplitude = 12,
    private speed = 2.4
  ) {
    super();
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.elapsed += deltaTime;
    owner.y += Math.sin(this.elapsed * this.speed) * this.amplitude * deltaTime;
  }
}

class Orbit extends Component {
  phase: SystemPhase = "physics";
  private angle = 0;

  constructor(
    private readonly target: GameObject,
    private readonly radius = 140,
    private readonly speed = 0.9
  ) {
    super();
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.angle += deltaTime * this.speed;
    owner.setPosition(
      this.target.x + Math.cos(this.angle) * this.radius,
      this.target.y + Math.sin(this.angle) * this.radius
    );
  }
}

export class CoreSandboxScene extends Scene {
  private hud: GameObject | null = null;
  private spawnTimer = 0;
  private spawned = 0;

  constructor() {
    super("core-sandbox");
  }

  create(): void {
    const { width, height } = this;
    this.getCamera().setBackgroundColor("#0f1216");
    this.createRect(width, height, { x: width / 2, y: height / 2, color: 0x0f1216, tags: ["ui"] });
    this.createText("C++ CORE SANDBOX", {
      x: 32,
      y: 28,
      style: style("20px", "#7ee2a8", "bold"),
      tags: ["ui"]
    });

    const center = this.createEllipse(28, { x: width / 2, y: height / 2, color: 0x7ee2a8, tags: ["core"] });
    const random = this.getRandom();
    for (let index = 0; index < 8; index += 1) {
      const satellite = this.createEllipse(10 + random.int(0, 6), {
        x: center.x,
        y: center.y,
        color: random.pick([0x6ec6ff, 0xf2b544, 0xff7b72]),
        tags: ["satellite"]
      });
      satellite.add(new Orbit(center, 90 + index * 26, 0.5 + index * 0.08));
      satellite.add(new Bobbing(6, 3));
    }

    const bench = benchmarkNativeCore({ frames: 120, objects: 128, seed: this.getRandom().int(1, 9999) });
    this.hud = this.createText(formatBenchmark(bench), {
      x: 32,
      y: height - 64,
      style: style("14px", "#a8afba"),
      tags: ["ui"]
    });
    this.createText("SPACE — spawn ring · R — reset · M — menu", {
      x: 32,
      y: height - 36,
      style: style("13px", "#6c7684"),
      tags: ["ui"]
    });
  }

  update(deltaTime: number): void {
    const input = this.getInput();
    if (input.isActionPressed("interact")) this.spawnRing();
    if (input.isActionPressed("restart")) {
      this.destroyAllObjects();
      this.create();
    }
    if (input.isActionPressed("menu")) this.getEvents().emit("request:scene", { to: "menu" });

    this.spawnTimer += deltaTime;
    if (this.spawnTimer > 1) {
      this.spawnTimer = 0;
      const satellites = this.findByTag("satellite").length;
      this.hud?.setRender({
        kind: "text",
        text: `${formatBenchmark(benchmarkNativeCore({ frames: 30, objects: 64, seed: this.spawned + 1 }))} · satellites ${satellites}`,
        style: style("14px", "#a8afba")
      });
    }
  }

  private spawnRing(): void {
    this.spawned += 1;
    const random = new Random(this.getRandom().int(1, 100000));
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      this.createEllipse(6, {
        x: this.width / 2 + Math.cos(angle) * 200,
        y: this.height / 2 + Math.sin(angle) * 200,
        color: random.pick([0x7ee2a8, 0x6ec6ff, 0xf2b544]),
        tags: ["ring"]
      });
    }
    random.dispose();
  }
}
