# Browser2DEngine

Silnik 2D dla przeglądarki: rdzeń w C++23 kompilowany do WebAssembly, publiczne API w
TypeScripcie, render i fizyka przez adapter Phasera. Dokumentacja:
<https://docs.krecik.tech/game-engine>

## Szybki start

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/
npm test               # Vitest (unit + integracyjne)
npm run examples:check # testy przykładów
npm run native:test    # CMake + ctest (wymaga cmake i kompilatora C++23)
npm run native:bench   # benchmark C++ → benchmarks/native-latest.json
npm run native:example # host C++ z raportem JSON
npm run verify         # pełna brama jakości (bez natywnej i e2e)
npm run verify:all     # wszystko: natywne, examples, e2e
```

## Struktura

```
native/core/             rdzeń C++23: world, scene, harmonogram komponentów, time, random, hash
packages/engine/         publiczne API TypeScript nad rdzeniem
packages/phaser-adapter/ adapter izolujący Phasera
packages/project-format/ walidacja JSON projektów
packages/wasm-bridge/    most TS↔WASM
apps/playground/         aplikacja deweloperska (Vite)
examples/                top-down, plugins/*, determinism, native-core
tests/                   unit + integracyjne (Vitest)
benchmarks/              progi regresji TS i C++ (baseline + latest)
config/                  wspólna konfiguracja Vite, aliasów i wywołań CMake
scripts/                 bramki CI: wersje, wydanie, budżety, WASM, docs-check
```

## Rdzeń w C++

Logika decydująca o wyniku gry żyje w `native/core` i jest kompilowana do WebAssembly.

| Moduł              | Nagłówek                 | Odpowiada za                                                                  |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------- |
| World              | `b2d/core/world.hpp`     | hierarchia obiektów, transformacje światowe, aktywacja, tagi, lifecycle       |
| Scene              | `b2d/core/scene.hpp`     | obiekty sceny, kolejka niszczenia, harmonogram komponentów, statystyki klatki |
| SceneManager       | `b2d/core/scene.hpp`     | rejestracja, start/stop, czyszczenie poprzedniej sceny                        |
| Component schedule | `b2d/core/component.hpp` | fazy `input → behavior → physics → animation → render`, stabilne sortowanie   |
| Time               | `b2d/core/time.hpp`      | zegar gry i rzeczywisty, clamp, fixed step, pauza                             |
| Random             | `b2d/core/random.hpp`    | deterministyczny PRNG: seed, fork, save/load stanu                            |
| Hash               | `b2d/core/hash.hpp`      | FNV-1a 32/64 do sum kontrolnych i digestów                                    |

Granica JS↔C++ to płaskie funkcje `b2d_*` z ABI 1 (`native/core/src/bindings.cpp`).
`NativeCore` wykrywa brak modułu i raportuje `impl: "typescript"` — gra działa dalej,
a liczniki mówią prawdę.

```ts
import { benchmarkNativeCore, createEngine, nativeCore } from "@engine";

const engine = createEngine({
  parent: "app",
  width: 800,
  height: 600,
  wasm: { wasmUrl: "/core.wasm", required: false }
});

engine.getWasm().getImpl();
nativeCore.stats();
benchmarkNativeCore({ frames: 600 });
```

### Harmonogram komponentów

`SceneSchedule` trzyma komponenty w jednym buforze i sortuje indeksy, nie same wpisy:

- kolejność: faza → `order` → `sequence` (kolejność dodania), więc sortowanie jest deterministyczne,
- `ordered()` przelicza kolejność tylko po zmianie (`dirty()`), a `revision()` licznik zmian pozwala
  wykryć modyfikację bez porównywania tablic,
- `remove()` zwija bufor w O(1) bez przesuwania reszty, `add()` na istniejącym id aktualizuje wpis
  zamiast dublować,
- `phase(phase)` przechodzi raz po posortowanej tablicy (wcześniej O(n²)).

### Build natywny

```bash
cmake -S native/core -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native --config Release
ctest --test-dir build-native --output-on-failure -C Release
```

Wymagania: CMake ≥ 3.20 i kompilator z C++23 (MSVC 19.3x, GCC 13+, Clang 17+). Windows:
generator Visual Studio wymaga `-A x64`; skrypty npm dopasowują ścieżkę binarki
(`build-native/Release/*.exe` na Windows, `build-native/*` na Linuksie/macOS) przez
`config/native.ts`.

### WebAssembly

```bash
npm run build:wasm
```

`scripts/build-wasm.mjs` konfiguruje `native/core` przez `emcmake` z
`-DB2D_CORE_BUILD_TESTS=OFF -DB2D_CORE_BUILD_BENCH=OFF -DB2D_CORE_BUILD_EXAMPLES=OFF`,
buduje target `core_wasm`, kopiuje `core.wasm` do `dist/assets/` i robi smoke-test modułu
(ABI = 1, `b2d_bench_scene`). Wynik zapisuje w `dist/wasm.json`.

## Użycie silnika

```ts
import { Component, Scene, createEngine, type SystemPhase } from "@engine";

class PlayerController extends Component {
  phase: SystemPhase = "physics";

  onUpdate(): void {
    const owner = this.owner;
    const scene = this.scene;
    if (!owner || !scene) return;
    const input = scene.getInput();
    const vx = Number(input.isActionDown("move-right")) - Number(input.isActionDown("move-left"));
    scene.getPhysics().setVelocity(owner, vx * 220, 0);
  }
}

class MyScene extends Scene {
  constructor() {
    super("my-scene");
  }

  create(): void {
    const player = this.createSprite("hero", {
      id: "player",
      x: 400,
      y: 300,
      body: { type: "dynamic" }
    });
    player.add(new PlayerController());
    this.getCamera().follow(player);
  }
}

const engine = createEngine({ parent: "game-container", width: 1280, height: 720 });
engine.registerScene(new MyScene());
engine.start("my-scene");
```

## Konfiguracja

| Pole               | Typ                              | Opis                       |
| ------------------ | -------------------------------- | -------------------------- |
| `parent`           | `string \| HTMLElement`          | kontener DOM               |
| `width` / `height` | `number`                         | logiczny rozmiar gry       |
| `backgroundColor`  | `string`                         | hex, np. `#151515`         |
| `scaleMode`        | `fit \| fill \| fixed \| expand` | tryb skalowania            |
| `debug`            | `boolean`                        | overlay FPS + panel logów  |
| `pauseOnHidden`    | `boolean`                        | pauza przy ukryciu karty   |
| `maxDeltaTime`     | `number`                         | clamp dt po powrocie z tła |
| `seed`             | `number`                         | ziarno `Random`            |
| `fixedStep`        | `{ hz, maxSteps? }`              | stały krok aktualizacji    |
| `physics.gravity`  | `{ x, y }`                       | grawitacja Arcade          |
| `inputMap`         | `Record<akcja, kod[]>`           | mapowanie klawiszy         |
| `wasm`             | `{ wasmUrl?, required }`         | moduł rdzenia C++          |

## Podsystemy

- Czas: dwa zegary, `timeScale`, `pause()/resume()`, `Scheduler` z `delay`/`interval`
- Fizyka: wyłącznie Phaser Arcade — `addCollider`, `addOverlap`, `setWorldBounds`
- Kamera: `follow`, `setZoom`, `setBounds`, `shake`, `fadeIn/Out`, `flash`
- Audio: kanały `master`, `music`, `sfx`, `ui`, kolejka przed gestem, `audio:unlocked`
- Animacje: tweeny (28 krzywych), sekwencje, animacje klatek, efekty kamery
- Assety: manifest, `declareAssets`, `hold`/`gc`, raport rozmiarów, import Tiled
- Zapis: `ProjectRepository` (atomowo + backup), `PlayerSaveRepository`
  (localStorage, IndexedDB, HTTP, SQL)
- Pluginy: manifest, systemy, panele, importery, izolacja błędów

## Przykłady

| Katalog                            | Co pokazuje                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| `examples/top-down`                | gra referencyjna: sceny, input, kolizje, kamera, HUD                |
| `examples/plugins/session-stats`   | plugin: system + panel + storage                                    |
| `examples/plugins/telemetry-panel` | plugin raportujący rdzeń (`core:ready`), ABI i przepustowość        |
| `examples/determinism`             | deterministyczne ramki sceny i digest FNV-1a, golden values         |
| `examples/native-core`             | dwa hosty C++ (sync i async) z raportem JSON porównywanym z fixture |

Każdy przykład ma własne testy w `examples/**/tests/**/*.test.ts`, uruchamiane przez
`npm run examples:check`. Natywne przykłady buduje `npm run examples:native`, a wartości
odniesienia zapisuje `npm run examples:baseline` (`examples/determinism/expected.json`,
`examples/native-core/expected.json`).

## Skrypty

| Skrypt                                  | Opis                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                           | Vite dev (playground)                                     |
| `npm run build`                         | typecheck + build do `dist/`                              |
| `npm run build:single`                  | build + pojedynczy `playground.html`                      |
| `npm run build:wasm`                    | rdzeń C++ → `core.wasm` + smoke-test ABI                  |
| `npm test`                              | Vitest                                                    |
| `npm run native:build`                  | CMake build rdzenia                                       |
| `npm run native:test`                   | CMake + ctest                                             |
| `npm run native:bench`                  | benchmark C++ → `benchmarks/native-latest.json`           |
| `npm run bench:native:check`            | porównanie z `benchmarks/native-baseline.json`            |
| `npm run native:example`                | oba hosty C++ z weryfikacją fixture                       |
| `npm run examples:check`                | testy przykładów (TS + kontrakty natywne)                 |
| `npm run examples:native`               | build i uruchomienie natywnych przykładów w CI            |
| `npm run examples:baseline`             | zapis wartości odniesienia dla przykładów                 |
| `npm run bench` / `npm run bench:check` | benchmarki TS i progi regresji                            |
| `npm run bundle:check`                  | budżet rozmiaru bundla względem `bundle-baseline.json`    |
| `npm run audit:licenses:check`          | audyt licencji i zasobów                                  |
| `npm run docs:check`                    | brak `docs/` i brak starych odnośników lokalnych          |
| `npm run verify`                        | pełna brama jakości (bez natywnej i e2e)                  |
| `npm run verify:all`                    | `verify` + `native:test` + `examples:native` + `test:e2e` |

## CI

`.github/workflows/ci.yml` ma pięć jobów:

| Job       | Kiedy                     | Co robi                                                                                |
| --------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `changes` | zawsze                    | fingerprint zmienionych obszarów (native / wasm / docs)                                |
| `native`  | zmiany w `native/`        | macierz ubuntu/macOS/Windows: build, `ctest`, `bench_core`, `npm run examples:native`  |
| `wasm`    | zmiany w rdzeniu          | Emscripten 3.1.61, `node scripts/build-wasm.mjs`, artefakt `core-wasm`                 |
| `verify`  | zawsze                    | typecheck, lint, format, unit, examples, benchmarki, build, budżety, licencje, release |
| `e2e`     | po `verify`               | Playwright: scenariusze, matryca, zgodność, hosting                                    |
| `docs`    | zmiany w `*.md` / `docs/` | `node scripts/docs-check.mjs` — pilnuje, żeby dokumentacja nie wróciła do repo         |

Natywny job nie zależy od `docs/`: dokumentacja żyje wyłącznie pod adresem docs site.

## Dokumentacja

Pełna dokumentacja (API, przewodniki, ADR, zgodność przeglądarek):
<https://docs.krecik.tech/game-engine>

W repozytorium nie ma katalogu `docs/` — pilnuje tego `npm run docs:check` oraz test
`tests/unit/WorkspaceVersions.test.ts`.

## Licencja

MIT. Phaser ma własną licencję (MIT).
