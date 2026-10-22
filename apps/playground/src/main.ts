import { LocalStorageStore, MemoryStore, PlayerSaveRepository, createEngine, type Engine } from "@engine";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { defaultExampleId, findExample, type PlaygroundExample } from "./examples";
import { mountShell, type Shell } from "./ui/shell";
import { mountDebugPanel } from "./ui/debug";
import { createSessionStatsPlugin } from "../../../examples/plugins/session-stats/src";
import { onLangChange, setLang } from "./i18n";
import { readUrlState, writeUrlState } from "./url-state";

const container = document.getElementById("game-container");
if (!container) throw new Error("Missing #game-container element");

const engine = createEngine({
  parent: container,
  width: 1280,
  height: 720,
  backgroundColor: "#0b0c0e",
  scaleMode: "fit",
  debug: false,
  pauseOnHidden: true,
  maxDeltaTime: 0.1,
  seed: 1337,
  fixedStep: { hz: 60, maxSteps: 5 },
  physics: { enabled: true, gravity: { x: 0, y: 0 }, debug: false },
  plugins: [createSessionStatsPlugin()]
});

(window as unknown as { engine: Engine }).engine = engine;

const demoStore = LocalStorageStore.isAvailable() ? new LocalStorageStore("b2d:") : new MemoryStore();
const demoRepository = new PlayerSaveRepository(demoStore);

(window as unknown as { b2d: Record<string, unknown> }).b2d = {
  engine,
  assetReport: () => engine.getAssets().report(),
  assetSizes: () => engine.getAssets().formatSizes(),
  loadSave: () => demoRepository.load("demo", "auto"),
  clearSave: () => demoRepository.remove("demo", "auto")
};

let pausedByModal = false;

const setSceneStatus = (sceneId: string): void => {
  shell.setStatus(`scena: ${sceneId}`, `scene: ${sceneId}`);
};

const runScene = (sceneId: string): void => {
  try {
    engine.startScene(sceneId);
    setSceneStatus(sceneId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    shell.setStatus(`Błąd sceny: ${message}`, `Scene error: ${message}`);
  }
};

const runExample = (example: PlaygroundExample): void => {
  if (!example.scene) return;
  shell.setExample(example);
  writeUrlState({ example: example.id });
  runScene(example.scene);
};

const urlState = readUrlState();

const shell: Shell = mountShell({
  onRun: runExample,
  onOpen: () => {
    pausedByModal = !engine.getTime().isPaused;
    if (pausedByModal) engine.pause();
  },
  onClose: () => {
    if (!pausedByModal) return;
    pausedByModal = false;
    engine.resume();
  }
});

if (urlState.lang) setLang(urlState.lang);
onLangChange((lang) => writeUrlState({ lang }));

engine.registerScene(new MenuScene());
engine.registerScene(new GameScene());

engine.getEvents().on("request:scene", (payload: unknown) => {
  runScene((payload as { to: string }).to);
});

engine.getEvents().on("game:collected", (payload: unknown) => {
  const data = payload as { score: number; total: number };
  shell.setStatus(`zebrano ${data.score} / ${data.total}`, `collected ${data.score} / ${data.total}`);
});

engine.getEvents().on("game:completed", () => {
  shell.setStatus("ukończono — R restart", "completed — R to restart");
});

engine.getEvents().on("game:timeScale", (payload: unknown) => {
  const { timeScale } = payload as { timeScale: number };
  shell.setStatus(`tempo ${timeScale.toFixed(1)}x`, `speed ${timeScale.toFixed(1)}x`);
});

engine.getEvents().on("engine:pause", () => shell.setStatus("pauza", "paused"));
engine.getEvents().on("engine:resume", () => shell.setStatus("wznowiono", "resumed"));

window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyP" || shell.isModalOpen()) return;
  const paused = engine.getTime().isPaused;
  if (paused) engine.resume();
  else engine.pause();
  shell.setStatus(paused ? "wznowiono" : "pauza", paused ? "resumed" : "paused");
});

const reportBootFailure = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const fail = (window as unknown as { __b2dBootFail?: (text: string, hint?: string, stack?: string) => void })
    .__b2dBootFail;
  if (typeof fail === "function") fail(message, undefined, stack);
};

mountDebugPanel(engine, { isBlocked: () => shell.isModalOpen() });

window.addEventListener("beforeunload", () => engine.destroy());

const initial = findExample(urlState.example ?? defaultExampleId);

try {
  engine.start(initial?.scene ?? "game");
  if (initial) shell.setExample(initial);
  writeUrlState({ example: initial?.id ?? defaultExampleId });
  setSceneStatus(initial?.scene ?? "game");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  shell.setStatus(`Błąd startu: ${message}`, `Start error: ${message}`);
  reportBootFailure(error);
}
