# Architektura — PL / EN

## PL

```
┌───────────────┐   ┌──────────────────────────────┐   ┌──────────────────┐
│  Kod gry      │   │            Engine            │   │     Adapter      │
│  Sceny        │──▶│  Config + Time + EventBus    │──▶│ PhaserRenderLayer│──▶ Phaser.Game
│  Komponenty   │   │  SceneManager  ObjectIndex   │   │ PhaserPhysics    │──▶ Arcade
│  Obiekty      │   │  AssetManager  InputManager  │   │ PhaserCamera     │──▶ Camera
└───────────────┘   │  PhysicsManager CameraManager│   │ PhaserInput      │──▶ Keyboard
                    │  AudioManager   TweenManager │   │ PhaserAudio      │──▶ WebAudio
                    └──────────────┬───────────────┘   │ PhaserAssets     │──▶ Loader
                                   │                   └──────────────────┘
                     core/ports.ts (6 interfejsów)             │
                                                                 ▼
                                                        ┌──────────────────┐
                                                        │ WASM (opcjonalnie)│
                                                        └──────────────────┘
```

### Warstwy

| Katalog | Zna Phasera | Zawartość |
|---|---|---|
| `packages/engine/src/core` | nie | `Engine`, `Scene`, `GameObject`, `Component`, `ObjectIndex`, `Time`, porty |
| `packages/engine/src/components` | nie | `Transform` |
| `packages/engine/src/animation` | nie | `Easing` (28 krzywych), `Tween`, `TweenManager`, sekwencje |
| `packages/engine/src/audio` | nie | `AudioManager`, kanały, `SoundHandle`, kolejka autoplay |
| `packages/engine/src/systems` | nie | `EventBus`, `AssetManager`, `InputManager`, `PhysicsManager`, `CameraManager`, `Logger`, `DebugOverlay`, `Memory` |
| `packages/engine/src/debug` | nie | `LogBuffer`, `LogPanel`, `DebugViews`, `Profiler`, `Diagnostics` |
| `packages/engine/src/plugins` | nie | `PluginHost`, rejestry systemów/importerów/paneli, manifest, parser zakresów wersji |
| `packages/engine/src/adapters` | tak | `PhaserAdapter` + cztery backendy i warstwa renderu |

### Zasady

- Rdzeń nie importuje Phasera. Pilnują tego: reguła ESLint `no-restricted-imports` oraz test `tests/unit/PublicApi.test.ts`, który skanuje źródła (import Phasera i import katalogu `adapters/` w `core/`).
- `Engine` jest punktem kompozycji z wstrzykiwaną fabryką adaptera (`AdapterFactory`). `createEngine()` w `src/createEngine.ts` podaje `createPhaserAdapter`; testy podają atrapę.
- `GameObject` jest bytem domenowym: `id`, `tags`, `groups`, `transform` lokalny, `parent`, `children`, `components`, opisy `render` i `body`. Nie trzyma żadnej instancji `Phaser.GameObjects`.
- Komunikacja z runtime idzie wyłącznie przez porty: `RenderPort`, `PhysicsPort`, `CameraPort`, `InputPort`, `AudioPort`, `AssetBackend`. Nowy backend = nowa implementacja sześciu interfejsów. Porty opcjonalne (`playAnimation`, `shake`, `flash`, `fadeIn/fadeOut`, `isUnlocked`) są sprawdzane przez `supports*` i wywoływane z `?? false` / `?? null`, więc minimalny backend nie musi ich implementować.
- `AudioManager` nie zna WebAudio: mówi do `AudioPort`, a mapowanie głośności `master × kanał × volume` liczy sam. Dzięki temu testy liczą wolumeny bez przeglądarki.
- Tweeny nie znają renderu: zmieniają właściwości obiektów docelowych, a `RenderPort.sync` dowiaduje się o zmianie przez settery `GameObject` (`alpha`, `depth`, `x`, `y`).
- `Time` jest jedynym źródłem `deltaTime`. Nie ma drugiej pętli `requestAnimationFrame`.
- `EventBus` jest synchroniczny i minimalny; błąd jednego handlera nie blokuje pozostałych (`onError`).
- `AssetManager` kolejkuje dopiero w `preload()`; walidacja i duplikaty są wykrywane wcześniej.

### Cykl klatki

```
Time.update(deltaMs)  -> realDeltaTime = min(raw, maxDeltaTime), deltaTime = realDeltaTime * timeScale
Scheduler.update(deltaTime) -> timery scen i silnika
while (Time.consumeFixedStep()) Scene.internalFixedUpdate(fixedDelta)
Scene.internalUpdate(deltaTime)
  1. applyPhysicsPositions()  (odczyt ciał z backendu)
  2. tweenManager.update(deltaTime)  (tweeny + sekwencje, usuwanie zakończonych)
  3. faza input -> Scene.update -> behavior -> physics -> animation -> render
  4. flushDestroyQueue() -> syncRender() (tylko obiekty brudne)
  5. plugins: systemy aktywnych pluginów (po scenie, przed debugiem)
  6. debug: overlay liczb -> panel logów -> widoki -> znaczniki profilera
Camera efekty (shake/fade/flash) aktualizuje backend po swojej stronie; silnik tylko deleguje.
```

### Audio i animacje — zasady

- Kanałów jest cztery: `master`, `music`, `sfx`, `ui`. Efektywna głośność to `master × kanał × volume` uchwytu, liczona przy `play` i przy każdej zmianie.
- Bez gestu użytkownika przeglądarka blokuje dźwięk. `AudioManager` nie gubi wtedy żądań: trzyma je w kolejce `pending`, a `unlock()` (wołane przez pierwszy gest) odtwarza je po kolei i emituje `audio:unlocked`.
- Każdy dźwięk ma właściciela. Scena przekazuje swoje `id`, więc `internalShutdown()` woła `audio.stopOwner(scene.id)` — nic nie wycieka między scenami.
- `engine.pause()` woła `audio.pauseAll()` i wstrzymuje `Time`; `engine.resume()` odwraca to. Dźwięki wznawiają się na tych samych pozycjach.
- Tweeny i sekwencje są własnością sceny (`stopOwner` nie jest potrzebny — `TweenManager` sceny jest niszczony razem z nią). Sekwencja to lista kroków z opcjonalnym `delay`, `easing`, `repeat` i `yoyo`; anulowanie kroku anuluje całą sekwencję.
- Animacje klatek nie są duplikowane w rdzeniu: klipy rejestruje backend przy `reconcileAssets()`, a silnik tylko deleguje `playAnimation`/`setFrame`/`getAnimationState`.

### Cykl życia obiektu

`createObject` → `render.create` → aktywacja w drzewie (`isActiveInHierarchy`) → aktualizacje → `destroyObject` → potomkowie od liści → `onDestroy` komponentów → usunięcie z indeksów tagów i grup → `render.destroy`.

### Przepływ inicjalizacji

1. `new Engine(options)` waliduje konfigurację i tworzy managery.
2. `registerScene()` zapisuje scenę w `SceneManager`.
3. `start(id)` → `PhaserAdapter.createGame()` → `Phaser.Game` → dla każdej sceny `InternalPhaserScene`.
4. `InternalPhaserScene.init` tworzy backendy i wywołuje `scene.initInternal(ctx, { render }, data)`.
5. `InternalPhaserScene.preload` podłącza `AssetBackend`, deklaruje zasoby i kolejkuje je do loadera.
6. `InternalPhaserScene.update` → `Time.update` → `Input.update` → `Scene.internalUpdate`.
7. Zasoby: `Scene.preload` → `declareAssets` → `AssetManifest` → `AssetBackend.load` → status `ready`, uchwyt właściciela sceny zwalniany w `shutdown`.
8. Zapis: `validateProject` → `exportProject` (koperta + suma) → `ProjectRepository` (tmp → read-back → backup → commit) albo `PlayerSaveRepository` (checksum + wersja) → `SaveStore` (memory/localStorage/IndexedDB/FS/HTTP/SQL).


### Build i publikacja

1. `vite.config.ts` obsługuje development (HMR, `allowedHosts`, serwowanie `/docs`), a `vite.prod.config.ts` produkcję (`base` z `B2D_BASE`, domyślnie `./`, minify, target `es2020`, jeden chunk, kopiowanie dokumentacji).
2. `config/build-meta.ts` wstrzykuje do `index.html` metadane `b2d-build`, `b2d-built-at`, `b2d-base`, `b2d-mode`; ekran błędu startowego czyta z nich build i ścieżkę bazową, nie zgadując ich z adresu.
3. `scripts/release-manifest.mjs` liczy dla każdego pliku w `dist/` rozmiar, gzip, brotli i SHA-256 i zapisuje `dist/release.json`; `scripts/bundle-report.mjs` porównuje to z `benchmarks/bundle-baseline.json` i egzekwuje progi (suma gzip +10%, plik +35%, single-file +5%).
4. `scripts/export-game.mjs` kopiuje build do `release/game`, dopisuje `hosting/` (nginx, Apache, Netlify, Cloudflare, Vercel, Firebase) i wylicza hash CSP z faktycznej treści inline skryptu startowego — polityka nie może rozjechać się z buildem.
5. `scripts/hosting-server.mjs` to serwer statyczny z profilami nagłówków (CSP, cache, mount), używany przez `scripts/e2e-hosting.mjs` w ośmiu scenariuszach: HTTP w korzeniu, podkatalog, ścisły CSP, HTTPS z certyfikatem self-signed, cache immutable, odświeżenie stanu, zablokowany bundle i nieznana ścieżka.
6. Zasada: względne `base` i brak SPA fallback. Gra ma stały adres katalogu, a stan trzyma w query stringu; przepisywanie głębokich ścieżek na `index.html` psułoby względne `./assets/…`.

### Granice modułów

- `assets/`, `project/`, `save/`, `core/`, `systems/`, `animation/`, `audio/`, `debug/` i `plugins/` nie znają Phasera — pilnuje tego ESLint (`no-restricted-imports`) i test `PublicApi.test.ts`.
- `SaveStore` to pięć metod (`read`, `write`, `remove`, `keys`, `clear`); `HttpStore` realizuje kontrakt `/v1/entries`, a `SqlSaveStore` przyjmuje dowolny obiekt z `query(sql, params)` — dzięki temu w bundlu gry nie ma `pg` ani `mysql2`.

### Wydajność

- Brak alokacji w gorącej pętli poza jedną kopią listy subskrybentów w `EventBus.emit` i przebudową listy komponentów po zmianie struktury.
- Render dostaje tylko obiekty brudne — scena z 79 obiektami wysyła w klatce zwykle 1–3.
- Odczyt `world` jest O(1) po przeliczeniu; zmiana transformacji unieważnia tylko poddrzewo.
- Aktualizacja komponentów: 0,72 ms na klatkę dla 20 000 obiektów (`scripts/bench-ecs.mjs`), czyli ok. 0,07 ms dla 2 000.
- Profiler jest wyłączony domyślnie i wtedy `begin`/`end` zwracają się natychmiast; po włączeniu dokłada dwa odczyty `performance.now()` na znacznik.
- `benchmarks/` mierzy kod silnika w Node (bez przeglądarki i bez Phasera), a `npm run bench:check` porównuje wynik z zapisaną bazą na tej samej maszynie. Progi są względne właśnie dlatego, że liczby bezwzględne zależą od sprzętu — silnik nie publikuje limitów sprzętowych, bo ich nie zmierzył.

### Pluginy — przepływ

1. `install()` waliduje manifest i unikalność `id`; nic więcej — dzięki temu katalog może zainstalować cały zestaw przed aktywacją.
2. `activate()` sprawdza zakres `engine`, aktywuje zależności (DFS z detekcją cykli), buduje kontekst z capability-gatingiem i woła `activate(context)`.
3. Rejestracje trafiają do rejestrów z właścicielem (`owner = id`), więc dezaktywacja usuwa je jednym przebiegiem.
4. `adapter.update` woła `plugins.update(deltaTime)` po scenie; wyjątek systemu jest liczony i po `maxFailures` system zostaje wyłączony.
5. `deactivate()` idzie od zależnych do zależności: hook pluginu, disposery LIFO, wyczyszczenie rejestrów.
6. Granica zaufania: kontekst jest bramką API, ale kod pluginu działa w tym samym realmie co gra — manifest nie jest piaskownicą i jest to udokumentowane wprost.

### Debugowanie — przepływ

1. `new Engine({ debug: true })` tworzy `DebugOverlay`, `LogBuffer` (400 wpisów), `LogPanel`, `DebugViews`, `Profiler` i `Diagnostics`.
2. `Logger.addSink(logs.push)` jest podpięty zawsze, więc bufor zbiera wpisy niezależnie od poziomu; `setDebug(false)` obniża próg do `info` i gasi warstwy widoczne.
3. Semantyczne zdarzenia debugowe idą przez porty: `RenderPort.setDebugLayer` (collidery, siatka, osie, granice) i `PhysicsPort.setDebugDraw`/`getStats`. Brak metody w porcie = `getSupport()` zwraca `false` i widok nie jest oferowany.
4. `PhaserAdapter` publikuje statystyki i aktualizuje overlay oraz panel po klatce renderu; `Diagnostics` czyta stan przez źródło (`DiagnosticsSource`), więc nie zna managera scen.

## EN

Build and deployment: `vite.config.ts` serves development (HMR, `allowedHosts`, `/docs`), while `vite.prod.config.ts` owns production (a `base` from `B2D_BASE`, `./` by default, minification, `es2020`, a single chunk, copying the docs). `config/build-meta.ts` injects `b2d-build`, `b2d-built-at`, `b2d-base` and `b2d-mode` into `index.html`, so the startup error screen reads the build and base path instead of guessing them from the URL. `scripts/release-manifest.mjs` records size, gzip, brotli and SHA-256 for every file into `dist/release.json`, and `scripts/bundle-report.mjs` compares that against `benchmarks/bundle-baseline.json`, enforcing a 10% total gzip threshold, 35% per file and 5% for the single-file build. `scripts/export-game.mjs` copies the build into `release/game`, emits ready hosting configs (nginx, Apache, Netlify, Cloudflare, Vercel, Firebase) and derives the CSP hash from the real content of the inline boot script, so the policy cannot drift from the build. `scripts/hosting-server.mjs` is a static server with header profiles used by `scripts/e2e-hosting.mjs` across eight scenarios: HTTP at the root, a subpath mount, strict CSP, HTTPS with a self-signed certificate, immutable caching, refresh state, a blocked bundle and an unknown path. The governing rule is a relative `base` with no SPA fallback: the game lives at a fixed directory root and keeps state in the query string, and rewriting deep paths to `index.html` would break relative `./assets/…` URLs.

Same diagram and layers.

Rules: the core never imports Phaser — enforced by an ESLint rule and a source-scanning test. `GameObject` is a domain entity (tags, groups, local transform, parent/children, components, `render` and `body` descriptors) and holds no Phaser instance. All runtime access goes through six interfaces (`RenderPort`, `PhysicsPort`, `CameraPort`, `InputPort`, `AudioPort`, `AssetBackend`); a new backend means six new implementations. `Time` is the only source of `deltaTime`. `EventBus` is synchronous and isolates handler errors. `AssetManager` queues at `preload` only.

Frame: physics readback → `input` components → `Scene.update` → `behavior`/`physics`/`animation`/`render` components → destroy queue flush → sync of dirty objects only → debug (overlay, log panel, views, profiler).

Assets: `declareAssets` → `AssetManifest` (ids, duplicates, references, size budget) → `AssetBackend.load` → statuses `idle/queued/loading/ready/failed` → owner refcount released in `shutdown`. Saves: `validateProject` → `exportProject` (envelope + checksum) → `ProjectRepository` (tmp → read-back → backup → commit) or `PlayerSaveRepository` → `SaveStore` (memory/localStorage/IndexedDB/FS/HTTP/SQL). `assets/`, `project/`, `save/`, `core/`, `systems/`, `animation/`, `audio/` and `debug/` never import Phaser (ESLint + `PublicApi.test.ts`); the engine ships no database drivers because `SqlClient` is injected.

Object lifecycle: `createObject` → `render.create` → tree activation → updates → `destroyObject` → descendants leaf-first → component `onDestroy` → index removal → `render.destroy`.

Audio and tweens: `AudioManager` speaks only to `AudioPort` and computes the effective volume as `master × channel × volume`; without a user gesture playback requests are queued in `pending` and replayed by `unlock()` (which emits `audio:unlocked`), and every sound is owned by the scene that started it, so `internalShutdown()` can call `audio.stopOwner(id)`. `engine.pause()` pauses `Time` and calls `audio.pauseAll()`; `resume()` reverses both. Tweens live in the scene's `TweenManager`, mutate plain target properties and never touch the renderer directly; sequences are step lists with optional `delay`/`easing`/`repeat`/`yoyo`, and cancelling a step cancels the sequence. Frame animations are registered by the backend during `reconcileAssets()`; the core only delegates `playAnimation`/`stopAnimation`/`pauseAnimation`/`setFrame`/`getAnimationState`. Optional port methods are feature-detected, so a minimal backend may return `false`/`null`.

Performance: no hot-path allocations except one subscriber copy in `emit` and a component list rebuild after structural changes; only dirty objects reach the renderer; `world` reads are O(1) after recomputation; component updates cost 0.72 ms/frame at 20 000 objects (`scripts/bench-ecs.mjs`). The profiler is disabled by default and its markers then return immediately; when enabled each marker adds two `performance.now()` reads. `benchmarks/` measures engine code in Node, and `npm run bench:check` compares the result against a recorded baseline on the same machine — the thresholds are relative because absolute numbers depend on the hardware, and the engine publishes no hardware limits it has not measured.

Plugin flow: `install()` validates the manifest and `id` uniqueness only, so a catalogue can install a whole set before activation; `activate()` checks the `engine` range, activates dependencies depth-first with cycle detection, builds a capability-gated context and calls `activate(context)`. Registrations land in registries keyed by owner, so deactivation purges them in one pass; `adapter.update` calls `plugins.update(deltaTime)` after the scene, and a throwing system is counted and disabled after `maxFailures`. The trust boundary is explicit: the context is an API gate, but plugin code runs in the same realm as the game, so the manifest is not a sandbox.

Debug flow: `debug: true` builds `DebugOverlay`, `LogBuffer` (400 entries), `LogPanel`, `DebugViews`, `Profiler` and `Diagnostics`. `Logger.addSink(logs.push)` is always attached, so the buffer collects entries regardless of level, while `setDebug(false)` lowers the threshold to `info` and hides the visible layers. Debug semantics go through ports — `RenderPort.setDebugLayer` (colliders, grid, axes, bounds) and `PhysicsPort.setDebugDraw`/`getStats` — so a port without the method makes `getSupport()` return `false` instead of failing at runtime. `PhaserAdapter` publishes the stats and refreshes the overlay and panel after the render phase, and `Diagnostics` reads state through `DiagnosticsSource`, which keeps it independent of the scene manager.
