# API Reference — Browser2DEngine

Referencja publicznego API w wersji skondensowanej (PL + EN). Kanoniczna, pełna wersja z opisami i przykładami: `docs/index.html` (strony `#api-engine`, `#api-scene`, `#api-object`, `#api-managers`, `#api-bus`, `#api-types`).

Wszystko poniżej eksportuje `@engine` (`packages/engine/src/index.ts`). Rdzeń nie zna Phasera — za runtime odpowiada adapter (`RuntimeAdapter`, domyślnie `PhaserAdapter`).

## Spis

- [Engine](#engine)
- [EngineConfig](#engineconfig)
- [Time](#time)
- [Scheduler, Timer, Random](#scheduler-timer-random)
- [Scene](#scene)
- [SceneManager](#scenemanager)
- [GameObject i Component](#gameobject-i-component)
- [AssetManager](#assetmanager)
- [InputManager](#inputmanager)
- [PhysicsManager](#physicsmanager)
- [CameraManager](#cameramanager)
- [AudioManager i SoundHandle](#audiomanager-i-soundhandle)
- [Tweeny, sekwencje, easing](#tweeny-sekwencje-easing)
- [EventBus](#eventbus)
- [Logger, DebugOverlay i diagnostyka](#logger-debugoverlay-i-diagnostyka)
- [Format projektu i zapisy](#format-projektu-i-zapisy)
- [WasmBridge](#wasmbridge)
- [Pluginy](#pluginy)
- [Porty adaptera](#porty-adaptera)

---

## Engine

`createEngine(options: EngineOptions): Engine` — `EngineOptions` = `EngineConfig` + `logLevel?: LogLevel` + `wasm?: WasmBridgeOptions`.

```ts
getConfig(): EngineConfig
getTime(): Time
getTimer(): Timer
getScheduler(): Scheduler
getRandom(): Random
getEvents(): EventBus
getLogger(): Logger
getAssets(): AssetManager
getAudio(): AudioManager
getInput(): InputManager
getPhysics(): PhysicsManager
getCamera(): CameraManager
getScenes(): SceneManager
getWasm(): WasmBridge
getAdapter(): RuntimeAdapter
isRunning(): boolean
isDestroyed(): boolean

registerScene(scene: Scene): this
start(initialSceneId?: string, data?: unknown): this
startScene(id: string, data?: unknown): void
stopScene(id: string): void
pause(): void
resume(): void
setTimeScale(scale: number): this
setDebug(enabled: boolean): void
on<T>(event: string, handler: (p: T) => void): () => void
stop(): void
destroy(): void
```

Nieprawidłowa konfiguracja rzuca `Error` z czytelnym komunikatem. `stop()` zwalnia runtime i listenery; `destroy()` jest idempotentny.

## EngineConfig

| Pole | Typ | Domyślnie | Opis |
|---|---|---|---|
| `parent` | `string \| HTMLElement` | wymagane | Kontener gry |
| `width`, `height` | `number` | `1280`, `720` | Rozmiar logiczny |
| `backgroundColor` | `string \| number` | `"#151515"` | Tło planszy |
| `scaleMode` | `"fit" \| "fill" \| "fixed" \| "expand"` | `"fit"` | Skalowanie |
| `debug` | `boolean` | `false` | Nakładka debug + poziom `debug` |
| `pauseOnHidden` | `boolean` | `true` | Pauza przy ukryciu karty |
| `maxDeltaTime` | `number` | `0.1` | Górny clamp `deltaTime` (s) |
| `seed` | `number` | `1337` | Seed `Random` |
| `fixedStep` | `{ hz: number; maxSteps?: number }` | brak | Krok stały → `Scene.fixedUpdate(dt)` |
| `input` | `InputActionMap` | `defaultInputMap` | Mapowanie akcji |
| `physics` | `{ enabled, gravity, debug }` | `enabled: true` | Arcade |
| `wasm` | `{ wasmUrl, required? }` | brak | Opcjonalny moduł WASM |

`defaultInputMap`: `move-up/down/left/right`, `interact`, `jump`, `restart`, `menu`, `pause`, `time-slow`, `time-fast`, `time-normal`, `mute`.

## Time

Jedyne źródło `deltaTime`. Nie ma drugiej pętli `requestAnimationFrame`.

```ts
get elapsed();          // sekundy gry (skalowane)
get gameTime();         // alias elapsed
get realElapsed();      // sekundy rzeczywiste
get deltaTime();        // klatka gry po clampie i timeScale
get realDeltaTime();    // klatka po clampie, bez timeScale
get rawDeltaTime();     // surowa klatka
get frame();
get isPaused(); get timeScale(); get maxDeltaTime();
get fixedDelta(); get fixedAlpha(); get isClamped();
get pendingFixedSteps();

update(rawDeltaMs: number): void
setTimeScale(value: number): this
setFixedStep(hz: number, maxSteps = 5): this
consumeFixedStep(): boolean
pause(): void
resume(): void
reset(): void
toState(): TimeState
```

`deltaTime = min(rawDeltaMs / 1000, maxDeltaTime) * timeScale`. `isClamped` mówi, że klatka została obcięta (np. po powrocie z innej karty).

## Scheduler, Timer, Random

```ts
scheduler.delay(seconds, callback, options?): TaskHandle
scheduler.interval(seconds, callback, options?): TaskHandle
scheduler.cancel(handle); scheduler.cancelOwner(owner): number; scheduler.clear();
scheduler.has(id); scheduler.count(owner?); scheduler.errorCount;

timer.delay(seconds, cb, options?): TaskHandle
timer.interval(seconds, cb, options?): TaskHandle
timer.cancel(handle); timer.clear(): number; timer.pending;

random.next(): number          // [0, 1)
random.float(min?, max?); random.int(min, max); random.bool(p?);
random.sign(); random.pick(items); random.fork(salt: string | number);
```

`TaskOptions = { owner?: string; repeat?: number; onError?: (e) => void }`. Wyjątek w zadaniu nie zatrzymuje innych zadań; trafia do `errorCount` i do `onError`. Timery sceny są anulowane przy `shutdown()`.

## Scene

```ts
abstract class Scene {
  readonly id: string;

  declareAssets(assets: AssetDescriptor[]): void;
  preload?(): void | Promise<void>;
  abstract create(): void | Promise<void>;
  update?(deltaTime: number): void;
  fixedUpdate?(fixedDelta: number): void;
  shutdown?(): void;

  getData<T>(): T;
  get width(): number; get height(): number;

  getInput(): InputManager;
  getPhysics(): PhysicsManager;
  getCamera(): CameraManager;
  getAssets(): AssetManager;
  getAudio(): AudioManager;
  getTweens(): TweenManager;
  getEvents(): EventBus;
  getTime(): Time;
  getTimer(): Timer;
  getRandom(): Random;
  getLogger(): Logger;

  createObject(options?): GameObject;
  createSprite(textureId: string, options?): GameObject;
  createText(text: string, options?): GameObject;
  createRect(width, height, options): GameObject;
  createEllipse(radius, options): GameObject;

  destroyObject(target: GameObject | string): boolean;
  destroyAllObjects(): void;
  activateObject(target): void;
  deactivateObject(target): void;

  getObject<T>(id: string): T | undefined;
  getObjects(): GameObject[];
  objectCount(): number;
  find(predicate); findAll(predicate);
  findByName(name); findByTag(tag); findByTags(tags, mode?);
  group(name: string): Group;
  getGroup(name); getGroupMembers(name); getGroups();
  each(fn: (object: GameObject) => void): void;
  getSystemOrder(): readonly string[];

  tween(target, props, options?): Tween;
  tweenFrom(target, props, options?): Tween;
  tweenSequence(steps, options?): TweenSequence;
  delay(seconds, onComplete?, options?): Tween;

  playSound(assetId, options?): SoundHandle | null;
  playMusic(assetId, options?): SoundHandle | null;
  stopMusic(): void;
  stopSounds(owner?): number;
  setChannelVolume(channel, value): void;

  playAnimation(target, key, options?): boolean;
  stopAnimation(target, key?): void;
  pauseAnimation(target, paused?): void;
  setFrame(target, frame): boolean;
  getAnimationState(target): AnimationState | null;
}
```

Kolejność fazy `internalUpdate`: `applyPhysicsPositions` → `tweenManager.update` → komponenty `input` → `update()` → `behavior` → `physics` → `animation` → `render` → kolejka `pendingDestroy` → `syncRender` (tylko obiekty brudne).

`shutdown()` sceny czyści rejestr obiektów, indeks tagów, grupy, subskrypcje, tweeny (`stopAll`), dźwięki właściciela (`stopOwner`) i uchwyty assetów (`releaseOwner`).

## SceneManager

```ts
register(scene): void            // duplikat id → throw
has(id); get(id);
getActiveSceneId(): string | null
getActiveScene(): Scene | null
start(id, data?): void
stop(id): void
switch(fromId, toId, data?): void
list(): string[]
clear(): void
```

## GameObject i Component

```ts
get destroyed(); get x(); get y(); get alpha(); get depth();
get rotation(); get scaleX(); get scaleY(); get world(): Transform;

setPosition(x, y); translate(dx, dy); setRotation(rad);
setScale(x, y?); setVisible(bool); setActive(bool);
setAlpha(a); setDepth(d); setScrollFactor(f); setTint(color | null);
setRender(render | null); setBody(body | null);

addTag(tag); removeTag(tag); hasTag(tag); hasAnyTag(tags); hasAllTags(tags);
addChild(child); removeChild(child);
add<T>(component): T; get<T>(ctor); has(ctor); remove(ctor); getComponents();
destroy(): void
markWorldDirty(); markRenderDirty();
```

`Component` ma `phase: SystemPhase` (`input | behavior | physics | animation | render`), `onAttach`, `onDetach`, `onUpdate(deltaTime)`, `onDestroy`, `enabled`, `owner`.

## AssetManager

```ts
register(descriptor); registerMany(list); setManifest(m); getManifest();
has(id); isLoaded(id); hasTexture(id); get(id); getAll(); pending(); count();
status(id): "idle" | "queued" | "loading" | "ready" | "failed";
animations(); attachBackend(backend); detachBackend();
queue(); load(ids?); cancel(): boolean; retry(ids?): number;
failuresList(); report(); sizeReport(limits?); formatSizes(limits?);

hold(owner, ids); releaseOwner(owner): number;
retain(id); release(id); releaseGroup(group); isRetained(id); gc();
unload(id);
onProgress(h); onError(h); onLoaded(h);
```

Typy: `image | spritesheet | atlas | audio | bitmapFont | json | tilemap`. Klucz animacji to `<assetId>:<key>`.

## InputManager

```ts
attach(port); detach(); isAttached(); update();
isKeyDown(code); isKeyPressed(code); isKeyReleased(code);
isActionDown(action); isActionPressed(action); isActionReleased(action);
getPointer(): PointerState;
getPointerPosition(); getPointerWorldPosition();
setActionMap(map); getActionMap(); remapAction(action, codes);
```

Logika gry czyta akcje, nie kody klawiszy. Adapter blokuje domyślne zachowanie przeglądarki tylko w obszarze gry.

## PhysicsManager

Phaser Arcade, bez własnego silnika fizyki.

```ts
attach(port); detach(); isAttached();
setWorldBounds(x, y, w, h);
attachBody(object); detachBody(object); readPosition(object);
setVelocity(object, vx, vy); getVelocity(object);
setImmovable(object, bool); setCollideWorldBounds(object, bool);
addCollider(a, b, handler?): ColliderHandle;
addOverlap(a, b, handler): ColliderHandle;
clear(): void
```

`ColliderPair` = jeden obiekt albo tablica obiektów (np. `findByTag("wall")`).

## CameraManager

```ts
follow(target, lerpX = 0.1, lerpY = 0.1); stopFollow();
setZoom(z); getZoom(); setBounds(x, y, w, h);
setBackgroundColor(color); getCenter(); worldToScreen(x, y);
shake(duration = 100, intensity = 0.01);
fadeIn(duration = 300, r = 0, g = 0, b = 0);
fadeOut(duration = 300, r = 0, g = 0, b = 0);
flash(duration = 150, r = 255, g = 255, b = 255);
resetEffects(); supportsEffects(): boolean
```

`supportsEffects()` zwraca `false`, gdy backend nie realizuje efektów — wywołania nie rzucają.

## AudioManager i SoundHandle

```ts
audio.play(assetId, options?): SoundHandle | null
audio.playMusic(assetId, options?): SoundHandle | null
audio.stopMusic(); audio.getMusic();
audio.stop(handle): boolean; audio.stopAsset(assetId): number;
audio.stopOwner(owner): number; audio.stopAll();
audio.pauseAll(); audio.resumeAll(); audio.isPaused();

audio.setVolume(channel, value); audio.setMasterVolume(value);
audio.getVolume(channel?); audio.getVolumes();
audio.setMuted(bool); audio.mute(); audio.unmute(); audio.toggleMute(); audio.isMuted();

audio.isUnlocked(); audio.unlock(): boolean; audio.onUnlock(listener);
audio.getHandleCount(); audio.getPendingCount(); audio.getState(): AudioState
```

`AudioChannel = "master" | "music" | "sfx" | "ui"`, domyślne głośności `{ master: 1, music: 0.7, sfx: 1, ui: 0.9 }`. `PlaySoundOptions = { channel?, volume?, loop?, rate?, owner? }`.

`SoundHandle`: `id`, `assetId`, `channel`, `owner`, `loop`, `rate`, `volume`, `effectiveVolume` (= `master × kanał × volume`), `isPlaying`, `statusName`, `setVolume(v)`, `stop()`.

Bez gestu użytkownika żądania trafiają do kolejki `pending`; `unlock()` odtwarza je po kolei i emituje `audio:unlocked`.

## Tweeny, sekwencje, easing

```ts
tweenManager.to(target, props, options?): Tween
tweenManager.from(target, props, options?): Tween
tweenManager.delay(seconds, onComplete?, options?): Tween
tweenManager.sequence(steps, options?): TweenSequence
tweenManager.add(tween); update(dt); pause(); resume();
tweenManager.cancel(tween): boolean;
tweenManager.stopOwner(owner): number; stopAll();
tweenManager.size; activeCount; sequenceCount; isPaused;

tween.play(); pause(); resume(); restart(); cancel(); complete();
tween.progress; totalProgress; values; isPlaying; isPaused; isFinished; isCancelled; stateName;
```

`TweenOptions = { duration?, delay?, easing?, repeat?, yoyo?, owner?, onStart?, onUpdate?, onRepeat?, onComplete?, onCancel? }`.
`TweenStep = { target, props, duration?, delay?, easing?, mode?, onStart?, onUpdate?, onComplete? }`.
`SequenceOptions = { owner?, repeat?, onStart?, onComplete?, onCancel? }`.
`EASINGS` ma 28 krzywych; `resolveEasing(name | fn)` zwraca funkcję. `repeat: -1` = nieskończona pętla.

## EventBus

```ts
on(event, handler): () => off
subscribe(event, handler): () => off
subscribeForScene(sceneId, event, handler): () => off
off(event, handler); offById(event, id)
emit(event, payload)
clearScene(sceneId); clearAll(); listenerCount(event)
```

Emisja synchroniczna, po kopii listy subskrybentów; wyjątek jednego handlera nie blokuje pozostałych. Zdarzenia silnika: `engine:start`, `engine:stop`, `engine:pause`, `engine:resume`, `engine:update`, `scene:start`, `scene:stop`, `assets:*`, `audio:unlocked`.

## Logger, DebugOverlay i diagnostyka

```ts
new Logger(context?, minLevel?)
setLevel(level); getLevel(); setContext(context); child(context); addSink(fn); sinkCount();
debug/info/warn/error(message, data?);

overlay.mount(parent); unmount(); setEnabled(bool); isEnabled(); setStats(stats);
setActiveScene(name); setExtra(lines); setLabels(labels); update(timeMs);
getFps(); getMemory(); getLines();

logs.push(entry); all(); last(n); filter({ minLevel, levels, context, text });
counts(); summary(); clear(); toJSON(); setCapacity(n); getVersion();

panel.mount(parent); setVisible(bool); toggle(); setFilter(filter); toggleLevel(level);
setLabels(labels); refresh(force?); destroy();

views.get(); set(patch); toggle(key); reset(); isActive(); getSupport(); sync(); clear();

profiler.begin(name); end(name); record(name, ms); snapshot(); getStats(); getAverage(name);
getLastFrame(); getFrameTime(); getFps(); setEnabled(bool); reset();

diagnostics.report(); toJSON(); copy(); download(fileName?);
engine.getDiagnosticsReport(); // skrót do diagnostics.report()
```

Overlay pokazuje fps, czas klatki, przejście czasu rzeczywistego w grę, scenę, obiekty, ciała, pary kolizji, pamięć, audio i najdroższe znaczniki. Panel logów filtruje bufor 400 wpisów po poziomie, kontekście i treści. Widoki rysują obrysy colliderów, siatkę, osie i granice kamery, a `getSupport()` mówi, co potrafi adapter. Raport diagnostyczny (`format: "b2d-diagnostics"`, `version: 1`) ma sekcje `engine`, `config`, `time`, `scene`, `assets`, `audio`, `physics`, `profiler`, `wasm`, `logs`, `memory`, `environment` i `findings`.

Zasoby: `engine.getAssets().diagnose({ usedIds, references })` zwraca `registered`, `unused`, `missing`, `failed`, `unlicensed` i `heaviest`.

## Format projektu i zapisy

```ts
validateProject(input): ValidationResult
migrateProject(input): { project, migrated, fromVersion }
importProject(text, options?): ImportResult
exportProject(project): string

new ProjectRepository(store).save(project) / load() / restoreBackup()
new PlayerSaveRepository(store).save(playerId, slot, data) / load(playerId, slot) / remove(...)

new MemoryStore();
new LocalStorageStore(prefix = "b2d:");
new IndexedDbStore({ database?, store? });
new FileSystemStore(baseDir);
new HttpStore({ endpoint, headers? });
new SqlSaveStore(client, { dialect: "postgres" | "mysql", table? });
sqlSchema({ dialect, table? })   // tablica instrukcji DDL
```

`formatVersion` = 2. Koperta eksportu zawiera sumę FNV-1a; `importProject` weryfikuje ją opcjonalnie (`verifyChecksum`). Zapis projektu jest atomowy: temp → odczyt zwrotny → backup → commit.

## WasmBridge

```ts
engine.getWasm().isReady();
engine.getWasm().getState();
engine.getWasm().getError();
engine.getWasm().getInstance();
engine.getWasm().call<T>(name, ...args): T | null;
engine.getWasm().reset();
```

Brak pliku nie psuje gry, gdy `required: false`. WASM zostaje w silniku tylko wtedy, gdy pomiar wykaże korzyść.

## Pluginy

```ts
new PluginHost({ engineVersion, logger, events, services, maxFailures? })
install(plugin); activate(id); activateAll(); deactivate(id); uninstall(id); dispose();
update(deltaTime); get(id); has(id); list(); summary();
getSystems(); enableSystem(owner, name); getImporters(); getPanels();

type PluginManifest = { id, version, engine, name?, description?, author?, dependencies?, permissions? };
type PluginDefinition = { manifest, activate(context): void | Promise<void>, deactivate?(): void | Promise<void> };
type PluginPermission = "systems" | "importers" | "panels" | "events" | "scenes" | "assets" | "storage";

parseVersion(input); compareVersions(a, b); isValidRange(range); satisfiesRange(version, range);
```

Rejestry: `SystemRegistry` (kolejność, `maxFailures`, auto-wyłączanie), `ImporterRegistry` (rozszerzenia plików, wbudowany `tiled`), `PanelRegistry` (`mount`/`unmount`). Uprawnienia ograniczają API kontekstu — manifest **nie** jest piaskownicą, kod pluginu działa w tym samym realmie. Szczegóły: `docs/index.html#plugins`.

## Porty adaptera

`core/ports.ts`: `RenderPort`, `PhysicsPort`, `CameraPort`, `InputPort`, `AudioPort`, `AssetBackend`, `RuntimeAdapter`, `AdapterFactory`. Nowy backend = nowa implementacja tych interfejsów; metody opcjonalne są wykrywane przez `supports*` i wołane z `?? false` / `?? null`.

---

# English

Condensed reference of the public API. The canonical, fully described version lives in `docs/index.html`.

- **Engine** — composition root: `createEngine(config)`, `registerScene`, `start`, `startScene`, `pause`/`resume`, `setTimeScale`, `setDebug`, `stop`/`destroy`, manager getters (`getTime`, `getTimer`, `getScheduler`, `getRandom`, `getAssets`, `getAudio`, `getInput`, `getPhysics`, `getCamera`, `getScenes`, `getEvents`, `getLogger`, `getWasm`).
- **Time** — the only `deltaTime` source: clamped `realDeltaTime`, scaled `deltaTime`, `timeScale`, `isPaused`, optional fixed step (`fixedDelta`, `fixedAlpha`, `pendingFixedSteps`, `consumeFixedStep`), `isClamped`.
- **Scheduler / Timer / Random** — owned tasks with handles, bounded catch-up, isolated errors (`errorCount`, `onError`), scene timers cleared on shutdown; seeded `Random` with `fork`.
- **Scene** — `preload`/`create`/`update`/`fixedUpdate`/`shutdown`, object factories and finders, `tween*`/`delay`, `playSound`/`playMusic`/`stopSounds`, frame animations and manager getters. Update phases: physics readback → tweens → `input` → `update` → `behavior` → `physics` → `animation` → `render` → destroy flush → dirty sync.
- **GameObject** — transform accessors (`x`, `y`, `alpha`, `depth`, `rotation`, `scaleX/Y`, `world`), chainable setters, tags, hierarchy, components; `render`/`body` are descriptors, never Phaser instances.
- **AssetManager** — manifest, statuses `idle/queued/loading/ready/failed`, `cancel`/`retry`, owner handles (`hold`, `releaseOwner`, `retain`, `gc`), `report`, `sizeReport`.
- **InputManager** — actions not key codes, `isActionDown/Pressed/Released`, pointer state and `getPointerWorldPosition`, `remapAction`.
- **PhysicsManager** — Phaser Arcade only: world bounds, bodies, velocity, colliders, overlaps, `clear`.
- **CameraManager** — follow, zoom, bounds, background, `worldToScreen`, `shake`/`fadeIn`/`fadeOut`/`flash`/`resetEffects`, `supportsEffects`.
- **AudioManager** — four channels, effective volume `master × channel × volume`, `SoundHandle` (`setVolume`, `stop`, `isPlaying`), global mute, autoplay queue flushed by `unlock()`, `getState()`.
- **Tweens** — `to`/`from`/`delay`/`sequence`, `TweenOptions` callbacks, step lists, `repeat`/`yoyo`, `cancel`/`stopOwner`/`stopAll`, 28 easings.
- **EventBus / Logger** — synchronous bus with per-scene subscriptions and isolated handler errors; levelled logger with sinks (`addSink`) and child contexts.
- **Debug** — `DebugOverlay` (fps, frame time, scene, objects, bodies, pairs, memory, audio, slowest markers), `LogBuffer` + `LogPanel` (filters by level/context/text), `DebugViews` (colliders, grid, axes, camera bounds with `getSupport()`), `Profiler` (engine markers plus your own), `Diagnostics` (`report`/`toJSON`/`copy`/`download`, format `b2d-diagnostics` v1 with `findings`), and `AssetManager.diagnose` for unused/missing/unlicensed assets.
- **Benchmarks** — `npm run bench` (17 Node cases) and `npm run bench:check` against a recorded baseline with a 40% threshold; CPU and Node version are stored, so numbers are compared per machine.
- **Plugins** — `PluginHost` with manifest validation (`id`, `version`, `engine` range, `dependencies`, `permissions`), four extension points (systems, importers, panels, events), dependency ordering with cycle detection, per-system failure budget with automatic disabling, namespaced events and storage, and a `plugins` section (counts + permission audit) in the diagnostic report. Permissions gate the context API only; the manifest is not a sandbox.
- **Project and saves** — `validateProject`, `migrateProject`, `importProject`, `exportProject`, `ProjectRepository` (atomic write), `PlayerSaveRepository`, stores: memory, localStorage, IndexedDB, File System, HTTP, SQL (`postgres`, `mysql`).
- **WasmBridge** — optional; absence of the module never breaks the game.
- **Ports** — `RenderPort`, `PhysicsPort`, `CameraPort`, `InputPort`, `AudioPort`, `AssetBackend`; a new backend implements these six interfaces, optional methods are feature-detected.
