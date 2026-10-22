import { Component, Scene, type GameObject, type SystemPhase } from "@engine";

class PlayerController extends Component {
  phase: SystemPhase = "physics";
  private speed: number;

  constructor(speed = 220) {
    super();
    this.speed = speed;
  }

  onUpdate(): void {
    const scene = this.scene;
    const owner = this.owner;
    if (!scene || !owner) return;
    const input = scene.getInput();
    let vx = 0;
    let vy = 0;
    if (input.isActionDown("move-left")) vx -= 1;
    if (input.isActionDown("move-right")) vx += 1;
    if (input.isActionDown("move-up")) vy -= 1;
    if (input.isActionDown("move-down")) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    scene.getPhysics().setVelocity(owner, vx * this.speed, vy * this.speed);
  }
}

class Bobbing extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;
  private baseY: number | null = null;

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    if (this.baseY === null) this.baseY = owner.y;
    this.elapsed += deltaTime;
    owner.y = this.baseY + Math.sin(this.elapsed * 6) * 5;
  }
}

class FadeAndDestroy extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;

  constructor(private duration = 0.2) {
    super();
  }

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.elapsed += deltaTime;
    const progress = Math.min(1, this.elapsed / this.duration);
    owner.setScale(1 + progress * 0.5).setAlpha(1 - progress);
    if (progress >= 1) owner.destroy();
  }
}

class Sparkle extends Component {
  phase: SystemPhase = "animation";
  private elapsed = 0;
  private readonly duration = 0.9;

  onUpdate(deltaTime: number): void {
    const owner = this.owner;
    if (!owner) return;
    this.elapsed += deltaTime;
    const progress = Math.min(1, this.elapsed / this.duration);
    owner.setScale(0.4 + progress).setAlpha(1 - progress);
    if (progress >= 1) owner.destroy();
  }
}

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1400;

const WALLS = [
  { x: WORLD_WIDTH / 2, y: 12, width: WORLD_WIDTH, height: 24 },
  { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 12, width: WORLD_WIDTH, height: 24 },
  { x: 12, y: WORLD_HEIGHT / 2, width: 24, height: WORLD_HEIGHT },
  { x: WORLD_WIDTH - 12, y: WORLD_HEIGHT / 2, width: 24, height: WORLD_HEIGHT },
  { x: 520, y: 420, width: 280, height: 24 },
  { x: 1200, y: 600, width: 24, height: 320 },
  { x: 900, y: 1050, width: 400, height: 24 }
];

const COINS = [
  { x: 320, y: 220 },
  { x: 780, y: 360 },
  { x: 1100, y: 340 },
  { x: 1650, y: 560 },
  { x: 1450, y: 1000 },
  { x: 600, y: 1060 }
];

export class GameScene extends Scene {
  private player: GameObject | null = null;
  private hud: GameObject | null = null;
  private coins: GameObject[] = [];
  private score = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.getCamera().setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.getCamera().setBackgroundColor("#151515");
    this.getPhysics().setWorldBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.createRect(WORLD_WIDTH, WORLD_HEIGHT, {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      color: 0x1a1d21,
      depth: -10,
      tags: ["world"]
    });

    for (const [index, wall] of WALLS.entries()) {
      this.createRect(wall.width, wall.height, {
        id: `wall-${index}`,
        x: wall.x,
        y: wall.y,
        color: 0x2b3036,
        body: { type: "static" },
        tags: ["wall"]
      });
    }

    const player = this.createEllipse(14, {
      id: "player",
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      color: 0x7ee2a8,
      body: { type: "dynamic", shape: "circle", radius: 14, collideWorldBounds: true },
      tags: ["player"],
      depth: 10
    });
    player.add(new PlayerController(220));
    this.player = player;
    this.getCamera().follow(player, 0.08, 0.08);

    for (const [index, position] of COINS.entries()) {
      const coin = this.createEllipse(9, {
        id: `coin-${index}`,
        x: position.x,
        y: position.y,
        color: 0xffcc33,
        body: { type: "static" },
        tags: ["coin"],
        depth: 5
      });
      coin.add(new Bobbing());
      this.coins.push(coin);
    }

    this.getTimer().interval(2.5, () => this.spawnSparkle());

    this.hud = this.createText("", {
      id: "hud",
      x: 16,
      y: 16,
      scrollFactor: 0,
      depth: 100,
      style: { fontFamily: "monospace", fontSize: "16px", color: "#e8eaed" },
      tags: ["ui"]
    });
    this.updateHud();

    this.getPhysics().addCollider(player, this.findByTag("wall"));
    for (const coin of this.coins) {
      this.getPhysics().addOverlap(player, coin, (_target, collected) => this.collect(collected));
    }
  }

  update(): void {
    const input = this.getInput();
    if (input.isActionPressed("restart")) this.getEvents().emit("request:scene", { to: "game" });
    if (input.isActionPressed("menu")) this.getEvents().emit("request:scene", { to: "menu" });
    if (input.isActionPressed("time-slow")) this.applyTimeScale(0.5);
    if (input.isActionPressed("time-fast")) this.applyTimeScale(2);
    if (input.isActionPressed("time-normal")) this.applyTimeScale(1);
  }

  shutdown(): void {
    this.coins = [];
    this.score = 0;
    this.getTime().setTimeScale(1);
  }

  private applyTimeScale(scale: number): void {
    this.getTime().setTimeScale(scale);
    this.updateHud();
    this.getEvents().emit("game:timeScale", { timeScale: scale });
  }

  private spawnSparkle(): void {
    const random = this.getRandom();
    const sparkle = this.createEllipse(6, {
      x: random.float(120, WORLD_WIDTH - 120),
      y: random.float(120, WORLD_HEIGHT - 120),
      color: 0x8ad7ff,
      depth: 6,
      tags: ["sparkle"]
    });
    sparkle.add(new Sparkle());
  }

  private collect(coin: GameObject): void {
    if (coin.destroyed || !coin.isActiveInHierarchy) return;
    this.getPhysics().detachBody(coin);
    coin.remove(Bobbing);
    coin.removeTag("coin").addTag("collected");
    coin.add(new FadeAndDestroy(0.2));
    this.coins = this.coins.filter((entry) => entry !== coin);
    this.score += 1;
    this.updateHud();
    this.getEvents().emit("game:collected", { id: coin.id, score: this.score, total: COINS.length });
    if (this.score === COINS.length) this.getEvents().emit("game:completed", { score: this.score });
  }

  private updateHud(): void {
    this.hud?.setRender({
      kind: "text",
      text: `  Zebrano: ${this.score} / ${COINS.length}   ${this.getTime().timeScale.toFixed(1)}x   `,
      style: { fontFamily: "monospace", fontSize: "16px", color: "#e8eaed" }
    });
  }
}
