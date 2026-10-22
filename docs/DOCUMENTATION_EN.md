# Documentation — English

Full docs: `docs/index.html` (47 pages, PL/EN, search), `README.md`, `docs/api/README.md` (API reference), `docs/guides/*`.

This file is EN index.

## Install

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck
npm run bench        # Node benchmarks → benchmarks/latest.json
npm run bench:check
```

## Modules

- **Engine / createEngine** — lifecycle, DOM, resize, `pauseOnHidden`, `pause`/`resume`, `setTimeScale`, `destroy`
- **EngineConfig** — validation, `defaultInputMap`, `hexToNumber`
- **Time** — `elapsed`, `deltaTime` (s), `maxDeltaTime` clamp, `timeScale`, fixed step (`fixedDelta`, `isClamped`)
- **Scheduler / Timer / Random** — tasks with handles, isolated errors, seeded randomness, `fork`
- **Scene / SceneManager** — `preload`/`create`/`update`/`fixedUpdate`/`shutdown`, unique ids, start data
- **GameObject / Component** — transforms, tags, groups, hierarchy, system phases
- **AssetManager** — manifest, statuses, `cancel`/`retry`, owner handles, `report`/`sizeReport`
- **InputManager** — actions → key codes, `isActionDown/Pressed/Released`, pointer, `remapAction`
- **PhysicsManager** — collider/overlap, bounds, immovable, velocity
- **CameraManager** — follow, zoom, bounds, `shake`, `fadeIn/fadeOut`, `flash`, `resetEffects`
- **AudioManager / SoundHandle** — channels, volumes, mute, autoplay queue, `getState`
- **Tweens / Easing** — `to`/`from`/`delay`/sequences, 28 curves, cancellation, owners
- **EventBus** — `on`/`emit`/`clearScene`, per-scene subscriptions
- **Logger / DebugOverlay** — levels, context, sinks; overlay with fps, frame time, objects, bodies, memory and audio
- **Debug (LogBuffer, LogPanel, DebugViews, Profiler, Diagnostics)** — filterable log panel, collider/grid/axes/bounds views, profiler markers, JSON diagnostic report
- **Build and deployment** — two Vite configs, base paths, a size report with thresholds, the `release/game` export, the startup error screen with diagnostics, CSP and hosting tests
- **Plugins** — manifest, extension points, lifecycle, permissions and trust boundaries, example plugin and package template
- **Benchmarks** — 17 Node cases (`objects`, `queries`, `collisions`, `tilemap`, `assets`), baseline comparison with a 40% regression threshold and no hardware claims
- **ProjectFormat** — `validateProject`, `migrateProject`, `importProject`, `exportProject`, version 2
- **Saves** — `ProjectRepository`, `PlayerSaveRepository`, memory/localStorage/IndexedDB/FS/HTTP/SQL stores
- **WasmBridge** — optional, graceful fallback

## Example

See `docs/guides/getting-started.md` and `apps/playground/src/scenes/GameScene.ts`.

## C++/WASM

See `native/core/README.md` and `docs/guides/wasm.md`.

## MVP Checklist

See `docs/MVP_CHECKLIST.md`.

## Performance & clean code

- No comments in code; docs in `docs/`
- Small SRP functions, DI via ctors
- Adapter isolates Phaser
- Efficient loops, minimal allocations
