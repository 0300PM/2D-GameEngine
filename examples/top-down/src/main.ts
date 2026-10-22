import { createEngine, type Engine } from "@engine";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

function ensureContainer(): HTMLElement {
  const el = document.getElementById("game-container");
  if (!el) throw new Error("Missing #game-container element");
  return el;
}

function updateHud(text: string): void {
  const hud = document.getElementById("hud-status");
  if (hud) hud.textContent = text;
}

async function bootstrap(): Promise<void> {
  const container = ensureContainer();

  const engine = createEngine({
    parent: container,
    width: 1280,
    height: 720,
    backgroundColor: "#151515",
    scaleMode: "fit",
    debug: true,
    pauseOnHidden: true,
    maxDeltaTime: 0.1,
    physics: {
      enabled: true,
      gravity: { x: 0, y: 0 },
      debug: false
    },
    logLevel: "info"
  });

  (window as unknown as { engine: Engine }).engine = engine;

  engine.registerScene(new MenuScene());
  engine.registerScene(new GameScene());

  engine.getEvents().on("request:scene", (p: unknown) => {
    const req = p as { to: string };
    try {
      engine.startScene(req.to);
      updateHud(`Scena: ${req.to}`);
    } catch (e) {
      updateHud(`Błąd sceny: ${(e as Error).message}`);
    }
  });

  engine.getEvents().on("game:collected", (p: unknown) => {
    const d = p as { score: number; total: number };
    updateHud(`Zebrano ${d.score} / ${d.total}`);
  });

  engine.getEvents().on("game:completed", () => {
    updateHud("Ukończono! Naciśnij R aby zagrać ponownie");
  });

  engine.getEvents().on("engine:pause", () => updateHud("Pauza (karta ukryta)"));
  engine.getEvents().on("engine:resume", () => updateHud("Wznowiono"));

  engine.start("menu");
  updateHud("Menu — naciśnij SPACE aby rozpocząć");

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") {
      if (engine.getTime().isPaused) engine.resume();
      else engine.pause();
    }
    if (e.code === "F2") {
      const cur = (engine as unknown as { debugOverlay: { isEnabled: () => boolean; setEnabled: (b: boolean) => void } });
      void cur;
    }
  });

  window.addEventListener("beforeunload", () => engine.destroy());

  updateHud("Silnik uruchomiony — scena: menu");
}

bootstrap().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  updateHud(`Błąd inicjalizacji: ${msg}`);
  console.error(e);
});
