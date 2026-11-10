# Browser2DEngine

Silnik 2D dla przeglądarki: rdzeń w C++23 kompilowany do WebAssembly, publiczne API w
TypeScripcie, render i fizyka przez adapter Phasera. Dokumentacja:
<https://docs.krecik.tech/game-engine>

## Szybki start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm test           # Vitest
npm run native:test
npm run native:bench
npm run native:example
```

## Struktura

```
native/core/             rdzeń C++23: world, scene, harmonogram komponentów, time, random, hash
packages/engine/         publiczne API TypeScript nad rdzeniem
packages/phaser-adapter/ adapter izolujący Phasera
packages/project-format/ walidacja JSON projektów
packages/wasm-bridge/    most TS↔WASM
apps/playground/         aplikacja deweloperska (Vite)
examples/                top-down, session-stats, telemetry-panel, native-core
tests/                   unit + integracyjne (Vitest)
benchmarks/              progi regresji TS i C++
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

| Katalog                            | Co pokazuje                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| `examples/top-down`                | gra referencyjna: sceny, input, kolizje, kamera, HUD         |
| `examples/plugins/session-stats`   | plugin: system + panel + storage                             |
| `examples/plugins/telemetry-panel` | plugin raportujący rdzeń (`core:ready`), ABI i przepustowość |
| `examples/native-core`             | samodzielny host C++: fixed step, RNG, hierarchia, digest    |

## Skrypty

| Skrypt                                  | Opis                                            |
| --------------------------------------- | ----------------------------------------------- |
| `npm run dev`                           | Vite dev (playground)                           |
| `npm run build`                         | typecheck + build do `dist/`                    |
| `npm test`                              | Vitest                                          |
| `npm run native:build`                  | CMake build rdzenia                             |
| `npm run native:test`                   | CMake + ctest                                   |
| `npm run native:bench`                  | benchmark C++ → `benchmarks/native-latest.json` |
| `npm run native:example`                | przykład hosta C++                              |
| `npm run examples:check`                | testy przykładów                                |
| `npm run bench` / `npm run bench:check` | benchmarki TS i progi regresji                  |
| `npm run verify`                        | pełna brama jakości                             |

## Dokumentacja

Pełna dokumentacja (API, przewodniki, ADR, zgodność przeglądarek):
<https://docs.krecik.tech/game-engine>

## Licencja

MIT. Phaser ma własną licencję (MIT).
