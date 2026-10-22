# Browser2DEngine — MVP

Mały, stabilny silnik 2D dla przeglądarki oparty na Phaser 3. Publiczne API odseparowane od Phasera przez Adapter. TypeScript, Vite, opcjonalny moduł C++23/WASM.

[English version below](#english)

---

## Polski

### Szybki start

```bash
npm install
npm run dev
# otwórz http://localhost:5173
```

Build produkcyjny (statyczne pliki w `dist/`):

```bash
npm run build
npm run preview
```

Testy, typecheck:

```bash
npm test
npm run typecheck
```

### Struktura

```
browser2d-engine/
├── apps/playground/        # aplikacja deweloperska (Vite)
├── packages/engine/        # serce silnika — publiczne API
├── packages/phaser-adapter/# adapter izolujący Phasera
├── packages/project-format/# walidacja JSON projektów
├── packages/wasm-bridge/   # most TS↔WASM (opcjonalny)
├── native/core/            # C++23 — przykład A* + Emscripten
├── examples/top-down/       # gra referencyjna (kopiuje playground)
├── tests/                  # unit + integracyjne (Vitest)
└── docs/                   # dokumentacja PL/EN
```

W fazie MVP cała implementacja jest w `packages/engine/src`. Rozdzielenie na pakiety gdy granice się ustabilizują.

### Użycie silnika

```ts
import { Engine } from "@engine";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

const engine = createEngine({
  parent: "game-container", // id elementu DOM lub HTMLElement
  width: 1280,
  height: 720,
  backgroundColor: "#151515",
  scaleMode: "fit",
  debug: true,
  pauseOnHidden: true,
  physics: { enabled: true, gravity: { x: 0, y: 0 }, debug: false }
});

engine.registerScene(new MenuScene());
engine.registerScene(new GameScene());

engine.start("menu");

// przełączenie sceny
engine.startScene("game");

// nasłuchiwanie zdarzeń
engine.getEvents().on("game:collected", (p) => console.log(p));

engine.pause();
engine.resume();
engine.stop();
engine.destroy();
```

### Tworzenie sceny

```ts
import { Scene, createEngine } from "@engine";

export class MyScene extends Scene {
  constructor() { super("my-scene"); }

  preload() {
    this.declareAssets([
      { id: "hero", type: "image", src: "/assets/hero.png" }
    ]);
  }

  create() {
    const player = this.createSprite("hero", {
      id: "player",
      x: 400,
      y: 300,
      body: { type: "dynamic", shape: "circle", radius: 14, collideWorldBounds: true },
      tags: ["player"],
    });

    this.createRect(300, 20, { x: 400, y: 500, color: 0x2a2f3a, body: { type: "static" } });
    this.getCamera().follow(player);
    this.getCamera().setBounds(0, 0, 2000, 1400);
  }

  update() {
    const input = this.getInput();
    const player = this.getObject("player");
    if (!player) return;
    const vx = Number(input.isActionDown("move-right")) - Number(input.isActionDown("move-left"));
    this.getPhysics().setVelocity(player, vx * 220, 0);
  }

  shutdown() {
    // sprzątanie sceny
  }
}
```

### Konfiguracja silnika

| Pole | Typ | Opis |
|------|-----|------|
| `parent` | `string \| HTMLElement` | kontener DOM |
| `width` / `height` | `number` | logiczny rozmiar gry |
| `backgroundColor` | `string` | hex np. `#151515` |
| `scaleMode` | `fit \| fill \| fixed \| expand` | tryb skalowania |
| `debug` | `boolean` | overlay FPS + logi debug |
| `pauseOnHidden` | `boolean` | pauza przy ukryciu karty |
| `maxDeltaTime` | `number` | clamp dt po powrocie z tła |
| `seed` | `number` | ziarno `Random` (domyślnie `1337`) |
| `fixedStep` | `{ hz, maxSteps? }` | stały krok aktualizacji, włącza `Scene.fixedUpdate` |
| `physics.gravity` | `{x,y}` | grawitacja Arcade |
| `inputMap` | `Record<akcja, kod[]>` | mapowanie klawiszy |

Błędna konfiguracja rzuca `Error` z czytelną listą problemów — nie cicha awaria.

### Czas, timery i determinizm

Dwa zegary: rzeczywisty (`realDeltaTime`, `realElapsed`) i gry (`deltaTime`, `elapsed` = rzeczywisty × `timeScale`).
Pauza zeruje czas gry, ale licznik klatek (`frame`) rośnie dalej, więc HUD-y i nakładki debug pozostają responsywne.

```ts
engine.setTimeScale(0.5);          // slow motion, emituje engine:timeScale
engine.pause();                    // engine:pause, zegar gry stoi
this.getTimer().delay(0.5, () => this.openDoor());
this.getTimer().interval(2, () => this.spawnWave(), { repeat: 5 });
const x = this.getRandom().float(0, 1280);
```

- Timery żyją w jednej kolejce `Scheduler`, są przypisane do sceny (`getTimer()`) i czyszczone w `shutdown()`
- Wyjątek w callbacku jest logowany i nie zatrzymuje pozostałych zadań; zaległości po długiej klatce są ograniczone
- `fixedStep: { hz: 60 }` włącza `Scene.fixedUpdate(dt)` z zawsze takim samym krokiem oraz `fixedAlpha` do interpolacji
- `engine:frameClamped` informuje, kiedy klatka została przycięta przez `maxDeltaTime`
- `Random` daje identyczną sekwencję dla tego samego seeda; `fork()` tworzy niezależny strumień
- Granice determinizmu w przeglądarce opisuje strona docs `#determinism`

### Input — mapowanie akcji

Domyślnie:

```ts
{
  "move-up": ["ArrowUp", "KeyW"],
  "move-down": ["ArrowDown", "KeyS"],
  "move-left": ["ArrowLeft", "KeyA"],
  "move-right": ["ArrowRight", "KeyD"],
  "interact": ["Space", "KeyE"]
}
```

```ts
engine.getInput().isActionDown("move-left");
engine.getInput().isActionPressed("interact");
engine.getInput().remapAction("jump", ["Space", "KeyJ"]);
engine.getInput().getPointerWorldPosition();
```

### Fizyka

Opiera się wyłącznie na Phaser Arcade. Nie ma drugiego silnika.

```ts
this.getPhysics().addCollider(player, walls);
this.getPhysics().addOverlap(player, trigger, () => collect());
this.getPhysics().setWorldBounds(0, 0, 2000, 1400);
```

### Kamera

```ts
this.getCamera().follow(player);
this.getCamera().setZoom(1.2);
this.getCamera().setBounds(0, 0, worldW, worldH);
this.getCamera().shake(100, 0.01);
```

### Audio

```ts
const audio = this.getAudio();

const music = this.playMusic("theme", { volume: 0.6, loop: true });
const sfx = this.playSound("pickup", { volume: 0.9, rate: 1.1 });

audio.setVolume("sfx", 0.8);   // master | music | sfx | ui
audio.setMuted(true);
audio.toggleMute();
sfx?.stop();
sfx?.volume;          // ustawiona głośność uchwytu
sfx?.effectiveVolume; // master × kanał × volume
sfx?.isPlaying;
audio.getState();     // { attached, unlocked, muted, paused, volumes, handles, pending }
```

- Cztery kanały: `master`, `music`, `sfx`, `ui`. Głośność efektywna to `master × kanał × volume`.
- Autoplay: bez gestu użytkownika żądania czekają w kolejce `pending`; pierwszy gest woła `unlock()`, dźwięki startują po kolei i leci event `audio:unlocked`.
- Każdy dźwięk ma właściciela (scena). `shutdown()` sceny woła `stopOwner()` — nic nie gra po wyjściu ze sceny.
- `engine.pause()` → `audio.pauseAll()`, `engine.resume()` → `audio.resumeAll()`.
- `SoundHandle`: `stop()`, `setVolume()`, `volume`, `effectiveVolume`, `isPlaying`, `statusName`. Pauza jest globalna (`audio.pauseAll()` / `resumeAll()`), nie na pojedynczym uchwycie.

### Animacje i efekty

```ts
this.tween(player, { x: 520, y: 300 }, {
  duration: 0.6,
  easing: "cubicOut",
  onComplete: () => this.tween(player, { alpha: 0.4 }, { duration: 0.2, yoyo: true, repeat: 3 }),
});

this.tweenFrom(hud, { alpha: 0 }, { duration: 0.3 });
this.delay(0.5, () => this.getCamera().flash(120, 255, 255, 255));

this.tweenSequence([
  { target: coin, props: { y: coin.y - 24 }, duration: 0.18, easing: "quadOut" },
  { target: coin, props: { alpha: 0 }, duration: 0.12, delay: 0.06 },
]);

this.playAnimation(spark, "spark:spin", { restart: true });
this.getAnimationState(spark);   // { key, frame, isPlaying, isPaused }
this.setFrame(spark, 3);

this.getCamera().shake(120, 0.008);
this.getCamera().fadeOut(300, 0, 0, 0);
this.getCamera().resetEffects();
```

- 28 krzywych w `EASINGS`; `resolveEasing()` przyjmuje nazwę (np. `"cubicOut"`), funkcję albo `Easing` prosto z tabeli.
- Anulowanie: `tween.cancel()`, `getTweens().stopOwner(id)`, `getTweens().stopAll()`; `shutdown()` sceny zatrzymuje wszystkie jej tweeny i sekwencje.
- `repeat`/`yoyo` kończą dokładnie na wartości docelowej (bez dryfu zmiennoprzecinkowego).
- Animacje klatek rejestruje backend przy `reconcileAssets()`, więc `playAnimation` w `create()` już działa.
- Efekty kamery są opcjonalne w porcie: `supportsEffects()` mówi, czy backend je realizuje.

### Zasoby i pipeline assetów

```ts
declareAssets([
  { id: "player", type: "image", src: "/assets/player.png", bytes: 18432 },
  {
    id: "hero", type: "spritesheet", src: "/assets/hero.png",
    frameWidth: 32, frameHeight: 32, frameCount: 12,
    animations: [{ key: "walk", frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 }],
  },
]);

const assets = this.getAssets();
assets.status("player");            // idle | queued | loading | ready | failed
assets.onError((e) => console.error(e.assetId, e.src, e.message));
assets.report();                    // counts, failures, errors, warnings, sizes
assets.sizeReport();                // budżet bajtów + heavy-asset
assets.hold("ui", ["player"]);      // refcount właściciela
assets.gc();                        // zwolnij to, czego nikt nie trzyma
```

- Manifest: stabilne `id`, wykrywanie `duplicate-id` / `duplicate-src` / `broken-reference`.
- `cancel()` działa tylko, gdy backend potrafi opróżnić kolejkę; `retry()` ponawia wyłącznie nieudane pozycje.
- Raport rozmiarów: domyślnie 512 kB na obraz, 2 MB na audio, 8 MB łącznie.
- Opcjonalny import Tiled: `importTiledMap(json, { tileWidth, tileHeight })`.

### Format projektu (v2)

```json
{
  "formatVersion": 2,
  "name": "TopDownDemo",
  "settings": { "width": 1280, "height": 720, "scaleMode": "fit", "backgroundColor": "#151515", "seed": 1337, "fixedStepHz": 60 },
  "assets": [{ "id": "player", "type": "image", "src": "/assets/player.png" }],
  "scenes": [{ "id": "game", "objects": [{ "id": "player", "kind": "sprite", "asset": "player", "x": 200, "y": 200 }] }]
}
```

Walidacja, migracja, import i eksport:

```ts
import { exportProject, importProject, migrateProject, validateProject } from "@engine";

const result = importProject(text, { requireLicenses: true, verifyChecksum: true });
result.valid;      // false → result.errors: invalid-json | checksum-mismatch | broken-reference | ...
result.migrated;   // true dla plików v1
const file = exportProject(result.project);   // koperta + suma FNV-1a
```

Nieznane pola są zachowywane (`unknownFields`), wersja przyszła → błąd `unsupported-version`, nie cicha interpretacja.

### Zapis projektu i zapisy gracza

```ts
import { LocalStorageStore, PlayerSaveRepository, ProjectRepository } from "@engine";

const store = new LocalStorageStore("b2d:");
const repository = new ProjectRepository(store);
await repository.save(project);      // walidacja → tmp → odczyt zwrotny → backup → commit
await repository.restoreBackup();    // cofnij ostatni zapis

const saves = new PlayerSaveRepository(store);
await saves.save("player-1", "slot-1", { level: 3, coins: 120 });
const { save, migrated } = await saves.load("player-1", "slot-1");
```

- Magazyny: `MemoryStore`, `LocalStorageStore`, `IndexedDbStore`, `FileSystemStore`, `HttpStore`.
- `HttpStore` + `tools/save-server/server.mjs`: `GET /v1/health`, `GET /v1/entries[/{key}]`, `PUT`, `DELETE`.
- SQL: `SqlSaveStore` z dialektami `postgres` i `mysql`, DDL z `sqlSchema()` lub `--print-schema`.

```bash
node tools/save-server/server.mjs --port=8788 --backend=file --dir=./saves
node tools/save-server/server.mjs --print-schema=postgres
```

### Zdarzenia

```ts
const off = engine.getEvents().on("game:collected", (p) => {});
off();

engine.getEvents().emit("my:event", { foo: 1 });

scene.getEvents().subscribeForScene(scene.id, "evt", handler);
// automatycznie usuwane przy shutdown sceny
```

### WASM (opcjonalny)

```ts
const engine = createEngine({
  parent: "app",
  width: 800, height: 600,
  wasm: { wasmUrl: "/wasm/core.wasm", required: false }
});
engine.getWasm().isReady();
engine.getWasm().call("findPathAStar", ...);
```

Brak pliku WASM nie psuje gry. Korzyść mierzona przed wdrożeniem.

### Debugowanie i profilowanie

```ts
const engine = createEngine({ parent: "app", debug: true });

const overlay = engine.getDebugOverlay();
overlay.getLines();      // ["62 fps · 16.67 ms", "scene game · 81 objects · 22 bodies · 9 pairs", ...]

const panel = engine.getLogPanel();
panel.setFilter({ levels: ["warn", "error"], context: "game" });

const views = engine.getDebugViews();
views.set({ colliders: true, grid: true, gridSize: 32 });
views.getSupport();      // { colliders: true, grid: true, axes: true, cameraBounds: true }

const report = engine.getDiagnosticsReport();
report.findings;         // [{ code: "assets-unused", severity: "warn", message: "..." }]

engine.getDiagnostics().download();   // b2d-diagnostics-<czas>.json
engine.setDebug(false);               // wszystko gaśnie jednym wywołaniem
```

- Overlay: fps, czas klatki i przejście czasu rzeczywistego w grę, aktywna scena, obiekty, ciała, pary kolizji, pamięć (`n/a` poza Chromium), audio, najdroższe znaczniki
- Panel logów: bufor 400 wpisów, filtry po poziomie, kontekście i treści, dane wpisu dostępne dla własnych sinków
- Widoki: obrysy colliderów, siatka, osie, granice kamery — `getSupport()` mówi, co potrafi adapter
- Ostrzeżenia o zasobach: `engine.getAssets().diagnose({ usedIds, references })` → `unused`, `missing`, `failed`, `unlicensed`, `heaviest`
- Profiler: 10 znaczników systemów silnika (m.in. `engine.scene`, `physics.readback`, `tweens`, `render.sync`) plus własne
- Raport diagnostyczny: jeden JSON z sekcjami `engine`, `scene`, `assets`, `audio`, `physics`, `profiler`, `logs`, `environment`, `findings`

### Benchmarki i progi regresji

```bash
npm run bench            # 17 przypadków → benchmarks/latest.json
npm run bench:check      # porównanie z benchmarks/baseline.json (tolerancja 40%)
npm run bench:baseline   # zapis aktualnego wyniku jako bazy
```

Benchmarki działają w Node, bez przeglądarki i bez Phasera, więc mierzą kod silnika: obiekty, zapytania, kolizje, tilemapy i raporty zasobów. Wynik zapisuje model procesora i wersję Node — porównania mają sens tylko na tej samej maszynie, więc silnik nie ogłasza limitów sprzętowych.

### Pluginy i rozszerzenia

```ts
import { createEngine, PluginError } from "@engine";
import { createSessionStatsPlugin } from "../examples/plugins/session-stats/src";

const engine = createEngine({
  parent: "app",
  plugins: [createSessionStatsPlugin()]
});

const plugins = engine.getPlugins();
plugins.get("session-stats")?.state;   // "installed" | "active" | "inactive" | "failed"
plugins.summary();                     // liczniki + audyt uprawnień
plugins.getPanels().list();            // panele zgłoszone przez pluginy
engine.getDiagnosticsReport().plugins.audit;

engine.installPlugin({ manifest, activate });   // instalacja w czasie działania
```

- Manifest: `id`, `version`, `engine` (zakres semver), `dependencies`, `permissions`
- Cztery punkty rozszerzeń: systemy (kolejność, budżet błędów), importery formatów, panele DOM, zdarzenia; sceny, zasoby i pamięć tylko do odczytu/z własnym prefiksem
- Cykl życia: `installed → active → inactive`, błąd aktywacji daje `failed` z kodem, gra działa dalej; zależności aktywują się pierwsze, cykle są wykrywane
- Izolacja błędów: wyjątek systemu jest liczony, po trzech kolejnych system zostaje wyłączony (`plugin:system-disabled`), reszta działa
- Uprawnienia ograniczają API kontekstu, **nie są piaskownicą** — kod pluginu działa w tym samym realmie; dla obcego kodu trzeba `iframe`/`Worker`

### Jakość, bezpieczeństwo i kompatybilność

- 508 testów jednostkowych i integracyjnych w 43 plikach (`npm run test:unit`) plus trzy zestawy e2e na prawdziwym `dist`
- `npm run test:scenarios` — 31 sprawdzeń: rozgrywka, pauza, wyciszenie, modal przykładów, panel debugowania, zapis po odświeżeniu, restart, brakujący asset
- `npm run test:matrix` — 7 profili urządzeń: desktop, laptop, tablet, dwa telefony, `prefers-reduced-motion`, zmiana rozmiaru
- `npm run test:compat` — Chromium (WebGL) i Firefox (fallback canvas 2D), po 12 sprawdzeń, strict CSP bez naruszeń; WebKit raportowany jako pominięty z powodem
- `npm run audit:licenses:check` — brama licencji zależności i zasobów (308 pakietów, 0 naruszeń), generuje `docs/LICENSES.md`
- `ApiSnapshot` pilnuje 296 symboli publicznego API; `API_LEVEL` rośnie tylko przy zmianie łamiącej
- Wspierane przeglądarki, znane ograniczenia i procedura zgłaszania błędów: strony `#compat` i `#policy` w dokumentacji
- `npm run verify` uruchamia całą bramę lokalnie: typecheck, lint, testy, benchmarki, build, budżet rozmiaru, licencje i e2e
- Przykład: `examples/plugins/session-stats`; szablon pakietu: `templates/plugin`
- Katalog pluginów świadomie odłożony do stabilizacji API

### Publikacja

```bash
npm run build          # dist/ + dist/release.json (rozmiary, gzip, brotli, SHA-256)
npm run bundle:check   # progi: suma gzip +10%, plik +35%, single-file +5%
npm run export:game    # release/game + release/game/hosting/{nginx,apache,netlify,vercel,firebase}
npm run test:hosting   # prawdziwa przeglądarka: HTTP, podkatalog, CSP, HTTPS, cache, 404, brak modułu
```

- Build produkcyjny używa `base: "./"`, więc katalog gry działa w korzeniu domeny i w dowolnym podkatalogu (`B2D_BASE=/` dla korzenia)
- `index.html` jest `no-cache`, pliki `assets/*` mają hash i roczny cache; stan gry żyje w `?example=…&lang=…`, więc odświeżenie nic nie gubi
- Nieznane adresy zwracają `404.html` — bez SPA fallback, bo przepisanie na `index.html` psuje względne `assets/`
- CSP z hashem inline skryptu startowego (`script-src 'self' 'sha256-…'`, bez `'unsafe-inline'`); generowana razem z eksportem
- Ekran błędu startowego pokazuje build, protokół, `secureContext`, WebGL, viewport, nieudane zasoby i stos wyjątku, z kopiowaniem i pobraniem raportu
- Eksport desktopowy świadomie odłożony do stabilizacji webu

### Skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Vite dev (playground) |
| `npm run build` | typecheck + build do `dist/` |
| `npm test` | Vitest (401 testów, 35 plików) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run bench` | benchmarki w Node → `benchmarks/latest.json` |
| `npm run bench:check` | porównanie z bazą i próg regresji |
| `npm run docs:build` | regeneracja `docs/index.html` |
| `npm run build:site` | build z `B2D_BASE=/` (korzeń domeny) |
| `npm run bundle:report` / `bundle:check` / `bundle:baseline` | raport rozmiaru i progi regresji |
| `npm run export:game` | `release/game` + konfiguracje hostingów + sumy kontrolne |
| `npm run test:hosting` | 8 scenariuszy hostingu w Chromium (HTTP, HTTPS, CSP, cache, 404, błąd startu) |
| `npm run build:single` | jeden plik HTML z osadzonymi zasobami |

---

## English

### Quick start

```bash
npm install
npm run dev
# open http://localhost:5173
```

Production build:

```bash
npm run build
```

### Engine usage

Same API as above — see Polish section for full table. Key points:

- `parent` — DOM container
- `scaleMode: "fit" | "fill" | "fixed" | "expand"`
- Invalid config throws with readable errors
- `stop()` frees resources and listeners; no extra canvas on re-start
- Physics is Phaser Arcade only; no second engine
- Camera follows target, respects world bounds
- Input uses action mapping, not raw key codes in game logic
- `deltaTime` in seconds, clamped via `maxDeltaTime`
- `pauseOnHidden` pauses logic when tab is hidden
- Game time vs real time: `deltaTime`/`elapsed` are scaled by `timeScale`, `realDeltaTime`/`realElapsed` are not
- Timers: `Scheduler` queue, per-scene `Timer`, cancellable handles, bounded catch-up, exceptions isolated
- Optional fixed step: `fixedStep: { hz, maxSteps }` drives `Scene.fixedUpdate(dt)` plus `fixedAlpha`
- Seeded `Random` (`seed` in config, `fork()` for independent streams); no `Math.random()` in game logic
- Determinism limits in browsers documented on the `#determinism` docs page
- Audio: four channels (`master`, `music`, `sfx`, `ui`), effective volume is `master × channel × volume`, playback requested before a user gesture is queued and flushed by `unlock()` (event `audio:unlocked`), sounds are owned by the scene and stopped in `shutdown()`; `pause()`/`resume()` pause and resume everything
- Animation: property tweens (`to`, `from`, `delay`, `sequence`, `repeat`, `yoyo`, 28 easings), cancellation (`cancel`, `stopOwner`, `stopAll`), frame animations (`playAnimation`, `stopAnimation`, `pauseAnimation`, `setFrame`, `getAnimationState`) and camera effects (`shake`, `fadeIn`, `fadeOut`, `flash`, `resetEffects`)
- Debugging: `debug: true` mounts the overlay (fps, frame time, scene, objects, bodies, pairs, memory, audio, slowest markers), the log panel (level/context/text filters over a 400-entry buffer) and the debug views (colliders, grid, axes, camera bounds, with `getSupport()` per adapter); `engine.setDebug(false)` turns all of it off
- Diagnostics: `engine.getDiagnosticsReport()` returns one JSON with sections `engine`, `scene`, `assets`, `audio`, `physics`, `profiler`, `logs`, `environment` and `findings` (`assets-unused`, `assets-unlicensed`, `assets-missing`, `audio-locked`, `frame-rate-low`, `logs-error`, `insecure-context`, ...); `download()` saves it as a file
- Benchmarks: 17 Node cases (`npm run bench`), compared against a recorded baseline with a 40% tolerance (`npm run bench:check`); the report stores CPU and Node version, so numbers are only comparable on the same machine
- Build and deployment: separate dev/prod Vite configs (`vite.config.ts`, `vite.prod.config.ts`), relative `base` (works at any subdirectory), a `release.json` manifest with gzip/brotli/SHA-256 per file, a size report with CI-enforced thresholds, a self-contained `release/game` export with ready nginx/Apache/Netlify/Vercel/Firebase/Cloudflare configs and a CSP hash computed from the inline boot script, a startup error screen with full environment diagnostics, and `npm run test:hosting` — eight Playwright scenarios covering HTTP, a subpath mount, strict CSP, HTTPS, cache headers, refresh state, a missing bundle and a 404 page. Desktop export stays deferred until the web target is stable.
- Quality and compatibility: 508 unit/integration tests in 43 files plus three end-to-end suites — `npm run test:scenarios` (31 checks: gameplay, pause, mute, examples, debug panel, save after refresh, restart, a missing asset), `npm run test:matrix` (7 device profiles: desktop, laptop, tablet, two phones, reduced motion, resize) and `npm run test:compat` (Chromium over WebGL and Firefox over the canvas 2D fallback, 12 checks each, strict CSP with zero violations). `npm run audit:licenses:check` gates every dependency and asset licence (308 packages, 0 violations), `ApiSnapshot` pins 296 public symbols, and the docs pages `#compat` and `#policy` list supported browsers, known limitations, severity levels and the bug-reporting template
- Plugins: manifest (`id`, `version`, `engine` range, `dependencies`, `permissions`), four extension points (systems, importers, panels, events), lifecycle `installed → active → inactive/failed` with dependency ordering and cycle detection, per-system error budget with automatic disabling, namespaced events and storage, and a `plugins` section in the diagnostic report. Permissions gate the context API only — the manifest is **not** a sandbox, so install only trusted plugins; untrusted code needs an iframe or worker.

### Versioning, releases and migrations

- One version for the whole monorepo: `packages/*` carry the root version and pin internal `@browser2d/*` dependencies exactly. `npm run versions:check` fails on any skew, `node scripts/versions.mjs --bump=minor|major|patch` updates the root manifest, every package manifest, the internal ranges and `ENGINE_VERSION` in one go (`--bump=major` also raises `API_LEVEL`)
- Stability channels as data, not labels: `FEATURE_STATUS` lists 21 features with `stable`, `experimental` or `internal`, plus `since` and a scope note. `engine.getStabilityReport()` returns the counts, `isStable("physics")` / `isExperimental("wasm")` answer in code
- Deprecation: `registerDeprecation()` records the replacement and the removal version, `engine.warnDeprecated(id)` emits exactly one log entry per id per session, `engine.getDeprecations()` lists everything
- `CHANGELOG.md` follows Keep a Changelog with all six sections always present; `docs/RELEASE_NOTES_TEMPLATE.md` defines the eight release-note sections and the rules behind them
- `npm run release:check` gates versions, changelog entry, release-notes template, ADR index, open S1 debt and the build id; `npm run release:artifacts` runs the tests and writes `release/artifacts/{version}/` with `test-results.json`, `benchmarks.json` (mean, median, delta to baseline), `bundle-manifest.json`, `api-snapshot.json`, `changelog-entry.md`, `release-notes.md`, `CHECKSUMS.txt` and an `index.json` across releases
- `npm run migrate -- --kind=project|save --in=… --out=… [--check]` migrates project files and player saves outside the app; a future version or a missing migration path is an error with a code, never a partial read
- `docs/TECH_DEBT.md` (14 open, 4 repaid entries with repayment conditions) and `docs/adr/` (9 decision records) are part of the documentation site as `#debt`; `release:check` reports an ADR file without an index entry

### Project JSON and saves

Validated, versioned (`formatVersion: 2`) with v1 migration. Duplicate ids, broken references, unsupported version → explicit errors; unknown fields are preserved. Project data is stored separately from player progress: `ProjectRepository` writes atomically (temp → read-back → backup → commit), `PlayerSaveRepository` keeps checksummed progress in memory, localStorage, IndexedDB, the file system, HTTP or SQL (PostgreSQL / MySQL).

### Docs

- `docs/index.html` — full documentation site (PL/EN, search, 47 pages)
- `docs/api/README.md` — full API reference PL/EN
- `docs/guides/getting-started.md` — step-by-step
- `docs/guides/wasm.md` — WASM integration

### License

MIT. Phaser is licensed separately (MIT).
