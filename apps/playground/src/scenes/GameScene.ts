import {
  LocalStorageStore,
  MemoryStore,
  PlayerSaveRepository,
  Scene,
  type ColliderHandle,
  type GameObject,
  type PlayerSave,
  type TextStyleData
} from "@engine";
import { t } from "../i18n";
import { assetUrl } from "../assets";
import { PlayerController } from "../components/PlayerController";
import { Bobbing } from "../components/Bobbing";
import { CollectEffect } from "../components/CollectEffect";
import { ClickRipple } from "../components/ClickRipple";
import { TimedDestroy } from "../components/TimedDestroy";
import { Sparkle } from "../components/Sparkle";

type WallSpec = { x: number; y: number; width: number; height: number };

const DEMO_LICENSE = { name: "CC0-1.0", author: "Browser2DEngine demo" };
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1400;
const GRID_STEP = 64;

const WALLS: readonly WallSpec[] = [
  { x: WORLD_WIDTH / 2, y: 12, width: WORLD_WIDTH, height: 24 },
  { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 12, width: WORLD_WIDTH, height: 24 },
  { x: 12, y: WORLD_HEIGHT / 2, width: 24, height: WORLD_HEIGHT },
  { x: WORLD_WIDTH - 12, y: WORLD_HEIGHT / 2, width: 24, height: WORLD_HEIGHT },
  { x: 520, y: 420, width: 280, height: 24 },
  { x: 1200, y: 600, width: 24, height: 320 },
  { x: 900, y: 1050, width: 400, height: 24 },
  { x: 1600, y: 900, width: 260, height: 24 },
  { x: 400, y: 900, width: 220, height: 24 },
  { x: 700, y: 700, width: 24, height: 260 },
  { x: 300, y: 300, width: 120, height: 120 },
  { x: 1500, y: 400, width: 140, height: 140 },
  { x: 1300, y: 1100, width: 160, height: 120 }
];

const CRYSTAL_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 320, y: 220 },
  { x: 780, y: 360 },
  { x: 1100, y: 340 },
  { x: 1650, y: 560 },
  { x: 1450, y: 1000 },
  { x: 600, y: 1060 },
  { x: 360, y: 740 },
  { x: WORLD_WIDTH / 2 + 200, y: WORLD_HEIGHT / 2 - 400 }
];

const HUD_STYLE: TextStyleData = {
  fontFamily: "monospace",
  fontSize: "16px",
  color: "#f2f3f5",
  backgroundColor: "#0b0c0ecc",
  padding: 6
};

const HINT_STYLE: TextStyleData = {
  fontFamily: "monospace",
  fontSize: "12px",
  color: "#7d848f"
};

export class GameScene extends Scene {
  private player: GameObject | null = null;
  private hud: GameObject | null = null;
  private crystals: GameObject[] = [];
  private crystalColliders = new Map<GameObject, ColliderHandle>();
  private score = 0;
  private pointerWasDown = false;
  private sparkleTicks = 0;
  private lastTimeScale = 1;
  private collected: string[] = [];
  private isLive = false;
  private save: PlayerSaveRepository | null = null;

  constructor() {
    super("game");
  }

  preload(): void {
    this.declareAssets([
      { id: "player", type: "image", src: assetUrl("player", "/assets/player.png"), license: DEMO_LICENSE },
      { id: "coin", type: "image", src: assetUrl("coin", "/assets/coin.png"), license: DEMO_LICENSE },
      { id: "tiles", type: "image", src: assetUrl("tiles", "/assets/tiles.png"), license: DEMO_LICENSE },
      {
        id: "spark",
        type: "spritesheet",
        src: assetUrl("spark", "/assets/spark.png"),
        frameWidth: 20,
        frameHeight: 20,
        animations: [{ key: "spin", frames: [0, 1, 2, 3, 4, 5], frameRate: 10, repeat: -1 }],
        license: DEMO_LICENSE
      },
      { id: "pickup", type: "audio", src: assetUrl("pickup", "/assets/pickup.wav"), license: DEMO_LICENSE }
    ]);
  }

  create(): void {
    this.isLive = true;
    this.getCamera().setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.getCamera().setBackgroundColor("#0b0c0e");
    this.getPhysics().setWorldBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.createFloor();
    this.createWalls();
    this.createPlayer();
    this.createCrystals();
    this.createSpark();
    this.createHud();
    this.registerCollisions();
    this.restoreProgress();
    this.getTimer().interval(5, () => this.spawnSparkleBurst());

    this.getLogger().info("GameScene ready", { objects: this.objectCount() });
  }

  update(): void {
    const input = this.getInput();
    if (input.isActionPressed("restart")) {
      this.getEvents().emit("request:scene", { to: "game" });
      return;
    }
    if (input.isActionPressed("menu")) {
      this.getEvents().emit("request:scene", { to: "menu" });
      return;
    }
    if (input.isActionPressed("time-slow")) this.applyTimeScale(0.5);
    if (input.isActionPressed("time-fast")) this.applyTimeScale(2);
    if (input.isActionPressed("time-normal")) this.applyTimeScale(1);
    if (input.isActionPressed("mute")) {
      this.getAudio().toggleMute();
      this.updateHud();
    }
    if (this.getTime().timeScale !== this.lastTimeScale) this.updateHud();
    const pointer = input.getPointer();
    const isDown = pointer.isDown && pointer.button === 0;
    if (isDown && !this.pointerWasDown) this.spawnRipple(input.getPointerWorldPosition());
    this.pointerWasDown = isDown;
  }

  fixedUpdate(): void {
    this.sparkleTicks += 1;
    if (this.sparkleTicks % 60 !== 0) return;
    this.spawnSparkle();
  }

  shutdown(): void {
    this.isLive = false;
    this.crystalColliders.clear();
    this.crystals = [];
    this.collected = [];
    this.score = 0;
    this.pointerWasDown = false;
    this.sparkleTicks = 0;
    this.save = null;
    this.getTime().setTimeScale(1);
    this.lastTimeScale = 1;
    this.getLogger().info("GameScene shutdown");
  }

  private createFloor(): void {
    this.createRect(WORLD_WIDTH, WORLD_HEIGHT, {
      id: "floor",
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      color: 0x0f1115,
      depth: -20,
      tags: ["world"]
    });
    const grid = this.group("grid");
    for (let x = 0; x <= WORLD_WIDTH; x += GRID_STEP) {
      grid.add(
        this.createRect(1, WORLD_HEIGHT, {
          x,
          y: WORLD_HEIGHT / 2,
          color: 0x171a1e,
          depth: -15,
          tags: ["grid"]
        })
      );
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += GRID_STEP) {
      grid.add(
        this.createRect(WORLD_WIDTH, 1, {
          x: WORLD_WIDTH / 2,
          y,
          color: 0x171a1e,
          depth: -15,
          tags: ["grid"]
        })
      );
    }
  }

  private createWalls(): void {
    const walls = this.group("walls");
    WALLS.forEach((spec, index) => {
      walls.add(
        this.createRect(spec.width, spec.height, {
          id: `wall-${index}`,
          x: spec.x,
          y: spec.y,
          color: 0x24272c,
          strokeColor: 0x32373d,
          strokeWidth: 1,
          body: { type: "static" },
          tags: ["wall"]
        })
      );
    });
  }

  private createPlayer(): void {
    const player = this.createSprite("player", {
      id: "player",
      name: "player",
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      displayWidth: 32,
      displayHeight: 32,
      fallbackRadius: 14,
      body: { type: "dynamic", shape: "circle", radius: 14, collideWorldBounds: true },
      tags: ["player"],
      depth: 10
    });
    player.add(new PlayerController(220));
    this.player = player;
    this.getCamera().follow(player, 0.08, 0.08);
    this.getCamera().setZoom(1);
  }

  private createCrystals(): void {
    const group = this.group("crystals");
    CRYSTAL_POSITIONS.forEach((position, index) => {
      const crystal = this.createSprite("coin", {
        id: `crystal-${index}`,
        x: position.x,
        y: position.y,
        displayWidth: 22,
        displayHeight: 22,
        fallbackRadius: 10,
        fallbackColor: 0xe2b714,
        body: { type: "static" },
        tags: ["crystal", "collectible"],
        depth: 5
      });
      crystal.add(new Bobbing(6, 700 + index * 60));
      group.add(crystal);
      this.crystals.push(crystal);
    });
  }

  private createSpark(): void {
    const spark = this.createSprite("spark", {
      id: "spark",
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2 - 90,
      displayWidth: 40,
      displayHeight: 40,
      depth: 8,
      tags: ["fx"],
      scrollFactor: 1
    });
    this.playAnimation(spark, "spark:spin");
    this.tween(spark, { rotation: Math.PI * 2 }, { duration: 3.2, repeat: -1, easing: "linear" });
    this.tween(spark, { y: spark.y - 26 }, { duration: 1.4, yoyo: true, repeat: -1, easing: "sineInOut" });
  }

  private spawnScoreLabel(crystal: GameObject): void {
    const label = this.createText("+1", {
      x: crystal.x,
      y: crystal.y - 18,
      depth: 150,
      style: {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e2b714"
      }
    });
    this.tween(label, { y: label.y - 46, alpha: 0 }, { duration: 0.65, easing: "quadOut" });
    label.add(new TimedDestroy(0.7));
  }

  private createHud(): void {
    this.hud = this.createText("", {
      id: "hud",
      x: 16,
      y: 16,
      scrollFactor: 0,
      depth: 100,
      style: HUD_STYLE,
      tags: ["ui"]
    });
    this.createText(t("WASD / strzałki • P pauza • [ ] tempo • N dźwięk • R restart • M menu", "WASD / arrows • P pause • [ ] speed • N sound • R restart • M menu"), {
      id: "hud-hint",
      x: 16,
      y: 50,
      scrollFactor: 0,
      depth: 100,
      style: HINT_STYLE,
      tags: ["ui"]
    });
    this.updateHud();
  }

  private registerCollisions(): void {
    const player = this.player;
    if (!player) return;
    this.getPhysics().addCollider(player, this.findByTag("wall"));
    for (const crystal of this.crystals) {
      const handle = this.getPhysics().addOverlap(player, crystal, (_target, collected) => this.collect(collected));
      this.crystalColliders.set(crystal, handle);
    }
  }

  private collect(crystal: GameObject): void {
    if (crystal.destroyed || !crystal.isActiveInHierarchy) return;
    this.crystalColliders.get(crystal)?.destroy();
    this.crystalColliders.delete(crystal);
    this.getPhysics().detachBody(crystal);
    crystal.remove(Bobbing);
    crystal.removeTag("collectible").addTag("collected");
    crystal.add(new CollectEffect(0.18));
    this.crystals = this.crystals.filter((entry) => entry !== crystal);
    this.score += 1;
    this.collected.push(crystal.id);
    this.playSound("pickup", { volume: 0.6 });
    this.getCamera().flash(90, 226, 183, 20);
    this.getCamera().shake(110, 0.004);
    this.spawnScoreLabel(crystal);
    this.persistProgress(false);
    this.updateHud();
    this.getEvents().emit("game:collected", { id: crystal.id, score: this.score, total: CRYSTAL_POSITIONS.length });
    if (this.score === CRYSTAL_POSITIONS.length) {
      this.persistProgress(true);
      this.getEvents().emit("game:completed", { score: this.score });
      this.showWin();
    }
  }

  private updateHud(): void {
    this.lastTimeScale = this.getTime().timeScale;
    this.hud?.setRender({
      kind: "text",
      text: `  ${t("Kryształy", "Crystals")}: ${this.score} / ${CRYSTAL_POSITIONS.length}   ${this.lastTimeScale.toFixed(1)}x   ${this.getAudio().isMuted() ? "🔇" : "🔊"}  `,
      style: HUD_STYLE
    });
  }

  private showWin(): void {
    const center = this.getCamera().getCenter();
    this.createText(t("WYGRANA — wszystkie kryształy zebrane", "WIN — all crystals collected"), {
      id: "win",
      x: center.x,
      y: center.y - 160,
      scrollFactor: 0,
      depth: 200,
      style: {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#0b0c0e",
        backgroundColor: "#e2b714",
        padding: 8
      }
    }).add(new TimedDestroy(1.8));
  }

  private restoreProgress(): void {
    const saves = this.getSaveRepository();
    const restore = (save: PlayerSave | null): void => {
      if (!save || !this.isLive || save.playerId !== "demo") return;
      const collected = Array.isArray(save.progress.collected) ? (save.progress.collected as string[]) : [];
      if (collected.length === 0) return;
      this.collected = [];
      this.score = 0;
      for (const id of collected) {
        const crystal = this.getObject(id);
        if (!crystal) continue;
        this.crystalColliders.get(crystal)?.destroy();
        this.crystalColliders.delete(crystal);
        this.getPhysics().detachBody(crystal);
        this.crystals = this.crystals.filter((entry) => entry !== crystal);
        this.destroyObject(crystal);
        this.collected.push(id);
        this.score += 1;
      }
      this.updateHud();
      if (this.score > 0) this.getLogger().info("Restored progress", { collected: this.score });
    };
    saves.load("demo", "auto").then(restore).catch((error: Error) => this.getLogger().warn(`Could not read save: ${error.message}`));
  }

  private getSaveRepository(): PlayerSaveRepository {
    if (this.save) return this.save;
    const store = LocalStorageStore.isAvailable() ? new LocalStorageStore("b2d:") : new MemoryStore();
    this.save = new PlayerSaveRepository(store);
    return this.save;
  }

  private persistProgress(completed: boolean): void {
    this.getSaveRepository()
      .save("demo", "auto", { collected: [...this.collected], completed, crystals: this.score })
      .catch((error: Error) => this.getLogger().warn(`Could not write save: ${error.message}`));
  }

  private applyTimeScale(scale: number): void {
    this.getTime().setTimeScale(scale);
    this.updateHud();
    this.getEvents().emit("game:timeScale", { timeScale: scale });
  }

  private spawnSparkle(): void {
    const random = this.getRandom();
    const sparkle = this.createEllipse(5, {
      x: random.float(120, WORLD_WIDTH - 120),
      y: random.float(120, WORLD_HEIGHT - 120),
      color: 0x8ad7ff,
      fillAlpha: 0.9,
      depth: 6,
      tags: ["sparkle"]
    });
    sparkle.add(new Sparkle(1.1));
  }

  private spawnSparkleBurst(): void {
    for (let index = 0; index < 3; index += 1) this.spawnSparkle();
  }

  private spawnRipple(position: { x: number; y: number }): void {
    this.createEllipse(6, {
      x: position.x,
      y: position.y,
      color: 0xf2f3f5,
      fillAlpha: 0.9,
      depth: 50,
      tags: ["effect"]
    }).add(new ClickRipple(0.28));
  }
}
