export type LocalizedText = {
  pl: string;
  en: string;
};

export type ExampleStatus = "ready" | "planned";

export type PlaygroundExample = {
  id: string;
  index: string;
  title: LocalizedText;
  description: LocalizedText;
  tags: string[];
  status: ExampleStatus;
  scene?: string;
};

export const examples: PlaygroundExample[] = [
  {
    id: "top-down",
    index: "01",
    title: { pl: "Top-Down Demo", en: "Top-Down Demo" },
    description: {
      pl: "Ruch w czterech kierunkach, kolizje ze ścianami, trigger zbierania, kamera śledząca, HUD i restart.",
      en: "Four-direction movement, wall collisions, collect triggers, a following camera, HUD and restart."
    },
    tags: ["input", "physics", "camera", "events"],
    status: "ready",
    scene: "game"
  },
  {
    id: "menu",
    index: "02",
    title: { pl: "Ekran startowy", en: "Start screen" },
    description: {
      pl: "Minimalna scena menu: teksty, prymitywy, obsługa klawiatury i przejście do gry przez zdarzenie.",
      en: "A minimal menu scene: text, primitives, keyboard handling and a scene switch driven by an event."
    },
    tags: ["scenes", "text", "events"],
    status: "ready",
    scene: "menu"
  },
  {
    id: "platformer",
    index: "03",
    title: { pl: "Platformówka", en: "Platformer" },
    description: {
      pl: "Grawitacja, skok na akcję, kolizje z platformami statycznymi i ograniczenie do granic świata.",
      en: "Gravity, action-based jump, collisions with static platforms and world-bound collision."
    },
    tags: ["physics", "gravity", "collider"],
    status: "planned"
  },
  {
    id: "camera-parallax",
    index: "04",
    title: { pl: "Kamera i paralaksa", en: "Camera and parallax" },
    description: {
      pl: "Śledzenie gracza z wygładzeniem, granice kamery, zoom i warstwy tła poruszające się z różną prędkością.",
      en: "Smoothed follow, camera bounds, zoom and background layers moving at different rates."
    },
    tags: ["camera", "depth", "render"],
    status: "planned"
  },
  {
    id: "level-json",
    index: "05",
    title: { pl: "Poziom z JSON", en: "Level from JSON" },
    description: {
      pl: "Wczytanie projektu przez formatVersion, walidacja błędów i budowa świata z deklaracji zasobów.",
      en: "Loading a project through formatVersion, validation errors and building the world from asset declarations."
    },
    tags: ["project-format", "assets", "validation"],
    status: "planned"
  },
  {
    id: "wasm-pathfinding",
    index: "06",
    title: { pl: "A* w WebAssembly", en: "A* in WebAssembly" },
    description: {
      pl: "Ścieżka liczona w C++23 i wołana przez WasmBridge z bezpiecznym fallbackiem do TypeScriptu.",
      en: "A path computed in C++23 and called through WasmBridge with a safe TypeScript fallback."
    },
    tags: ["wasm", "c++", "pathfinding"],
    status: "planned"
  }
];

export const defaultExampleId = "top-down";

export const findExample = (id: string): PlaygroundExample | undefined =>
  examples.find((example) => example.id === id);

export const runnableExamples = (): PlaygroundExample[] =>
  examples.filter((example) => example.status === "ready" && Boolean(example.scene));
