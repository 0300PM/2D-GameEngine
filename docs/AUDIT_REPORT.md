# Raport zgodności z założeniami — Browser2DEngine MVP

**Data:** 2026-10-22  |  **Wersja:** 0.1.0  |  **Status:** ✅ Zgodny w 100% z MVP + poza zakresem prawidłowo wykluczony

Poniżej weryfikacja każdego punktu specyfikacji (1–19) na podstawie kodu w `packages/engine/src`, testów i przykładu.

---

## 1. Cel i założenia — ZAŁOŻENIA SPEŁNIONE

| Założenie | Status | Gdzie |
|-----------|--------|-------|
| TypeScript jako język API | ✅ | `tsconfig.json` strict, wszystkie pliki `.ts`, `packages/engine/src/index.ts` re-eksportuje typy |
| Phaser za rendering/input/loader/sceny/animacje/audio/fizyka | ✅ | `PhaserAdapter` jedyne miejsce tworzące `Phaser.Game`; cała reszta przez wrappery |
| Adapter oddziela API od Phasera | ✅ | `packages/engine/src/adapters/PhaserAdapter.ts` + `phaser-adapter/src` |
| C++23/WASM opcjonalny, punkt integracji | ✅ | `native/core/` + `WasmBridge` (`required:false` nie wywala gry) |
| Działa w nowoczesnej przeglądarce, build statyczny | ✅ | `vite build` → `dist/` statyczny, `index.html` + `assets/` |
| Edytor wizualny poza MVP, sceny w kodzie/JSON | ✅ | Sceny w TS (`MenuScene`/`GameScene`), JSON walidowany |

---

## 2. Konfiguracja i cykl życia — ✅ PEŁNY

- Utworzenie instancji: `new Engine({parent,width,height,...})` — tak
- Wskazanie DOM: `parent: string|HTMLElement`, `resolveParent` sprawdza `getElementById` i rzuca czytelnym błędem
- Szerokość/wysokość logiczna: `EngineConfig.width/height` walidowane 1–8192
- Kolor tła: `backgroundColor` hex, konwertowany `hexToNumber`
- Skalowanie: `ScaleMode` fit/fill/fixed/expand → `Phaser.Scale.FIT/ENVELOP/NONE/RESIZE`
- Min/max wymiary: `scale.min/max` przekazywane do Phasera jeśli oba podane
- Debug: `debug:boolean` włącza `DebugOverlay` + `Logger` level debug
- Start/stop: `start()`, `stop()`, `destroy()` — `start` nie tworzy 2. canvas gdy `running`
- Błędy inicjalizacji: `validateEngineConfig` → tablica stringów, `resolveEngineConfig` rzuca `Invalid EngineConfig: ...`
- Sprzątanie: `PhaserAdapter.destroy()` usuwa `ResizeObserver`, `visibilitychange`, `game.destroy(true,false)`
- Resize: `ResizeObserver` + `window.resize` → `game.scale.refresh()` + emit `engine:resize`
- Pauza po ukryciu karty: `pauseOnHidden` + `visibilitychange` → `Time.pause()` + `game.loop.sleep/wake`

Kryteria akceptacji zweryfikowane w kodzie i manulanie w playgroundzie.

---

## 3. Pętla gry i czas — ✅

- Oddzielenie logiki od renderowania: `Time` + `Scene.update(deltaTime)` wywoływane z `InternalPhaserScene.update`
- Czas od startu: `Time.elapsed` (s)
- deltaTime w sekundach: `Time.deltaTime`, `Time.update(rawMs)` → `raw/1000` + clamp `maxDeltaTime` (domyślnie 0.1)
- Ograniczenie dużego dt po powrocie z karty: `Math.min(rawSec, maxDelta)` — przetestowane `Time.test.ts`
- Pauza/wznowienie: `Time.pause/resume` + `PhaserAdapter.pause/resume`
- Dwa zegary: czas gry (`deltaTime`, `elapsed`) vs rzeczywisty (`realDeltaTime`, `realElapsed`) — Faza 3
- Skala czasu: `Time.setTimeScale`, `Engine.setTimeScale`, zdarzenie `engine:timeScale`
- Stały krok: `Time.setFixedStep(hz, maxSteps)`, `Scene.fixedUpdate`, `fixedAlpha`
- Timery: `Scheduler` + `Timer` (delay/interval, anulowanie, właściciel, limit zaległości, izolacja błędów)
- Losowość: `Random` z seedem, `fork()`, zapis/odtworzenie stanu
- Długie klatki: `engine:frameClamped` z surową i przyciętą deltą
- Granice determinizmu w przeglądarce: docs `#determinism`
- Dostęp do aktualnej sceny: `SceneManager.getActiveScene()` / `getActiveSceneId()`
- Stabilne wywoływanie zgodnie z Phaserem: `InternalPhaserScene.update` to jedyne źródło ticka
- Brak 2. pętli poza Phaserem: nie używamy `requestAnimationFrame` poza Phaserem

Ruch w `GameScene.update` zależy od `deltaTime` ( `player.body.setVelocity(vx*speed)` gdzie `speed` stałe, ale pozycja skalowana przez fizykę zależną od dt; demonstracja clamp po powrocie z karty nie skacze ).

---

## 4. Sceny — ✅

- Rejestrowanie: `SceneManager.register(scene)` — duplikat → `throw Scene "x" already registered` (test `Engine lifecycle`)
- Start/stop/przełączanie + dane: `start(id,data)`, `stop(id)`, `switch(from,to,data)` + `Scene.initInternal` przekazuje `data`
- Cykl: `preload`, `create`, `update`, `shutdown` — `InternalPhaserScene.preload→create→update→shutdown` wywołuje `scene.internalCreate/internalUpdate/internalShutdown`
- Błędy ładowania: `load.on(FILE_LOAD_ERROR)` → `AssetManager.handlePhaserError` → `AssetError`, `create` w try/catch w `InternalPhaserScene.create`
- Sprawdzenie aktywnej sceny: `getActiveSceneId()`, `getActiveScene()`
- Blokada duplikatu: tak
- Utrzymanie w pamięci tylko gdy model Phasera wspiera: Phaser `scene.add/remove/stop` — my usuwamy starą scenę przed startem nowej

Przykład: `MenuScene` → `GameScene` → `MenuScene` działa w playgroundzie, obiekty czyszczone w `Scene.clearObjects()` + `events.clearScene(id)`.

---

## 5. Obiekty i transformacje — ✅

- Tworzenie/aktywacja/dezaktywacja/usuwanie: `scene.createObject/createSprite/createText/createRect/createEllipse`, `activateObject/deactivateObject/destroyObject`, kolejka `pendingDestroy` dla wywołań w `update`
- x,y,rotacja,skala: `Transform` + gettery/settery w `GameObject` z `syncToPhaser`
- Widoczność/aktywność: `visible/active` + `setVisible/setActive` → `setVisible/setActive` Phasera
- Nazwa/ID: `id` readonly + `name` (domyślnie id)
- Dodawanie/usuwanie ze sceny: `scene.objects` Map + `bindPhaserObject`
- Grupowanie: `Group` (id→GameObject Map)
- Oddzielenie danych od logiki: `Transform` data, `GameObject` czyste, logika w `Scene.update`
- Punkty rozszerzeń: `addComponent/getComponent/removeComponent` (bez pełnego ECS)

Kryteria: można stworzyć/przesunąć/ukryć/usunąć w trakcie gry; usunięty nie aktualizowany; API nie wymaga zarządzania strukturami Phasera.

---

## 6. Renderowanie i sprite'y — ✅

- Sprite z plików: `scene.createSprite("player", { id, x, y })` + `AssetBackend.queue` → `loader.image`, brak tekstury → fallback z opisu
- Poz/rot/skala/alpha/visible: `Transform` lokalny + `world` (hierarchia) + `RenderPort.sync` dla obiektów brudnych
- Origin: `originX/Y` + `setOrigin` → `phaserSprite.setOrigin`
- Kolejność: `depth` → `setDepth`
- Tekst: `createText` → `phaserScene.add.text` + `TextObject.setText/setStyle/setOrigin`
- Kolor tła: `EngineConfig.backgroundColor` → `Phaser.GameConfig.backgroundColor` + `Camera.setBackgroundColor`
- Skalowanie do kontenera: `Phaser.Scale` z `autoCenter: CENTER_BOTH`, `FIT` zachowuje proporcje
- Przekazywanie do Phasera: brak własnego renderera, `Phaser.AUTO` (WebGL/Canvas auto)
- Błędy tekstury: `AssetManager.requireTexture` → `throw AssetError Texture "id" not found. Did you preload it?` + `src`

Zweryfikowane: wiele sprite'ów, zmiana transformacji, resize nie rozciąga, brakująca tekstura daje diagnostykę.

---

## 7. Input — ✅

- Stan klawiszy: `InputManager.keyDown/Pressed/Released` + `keyboard.addKey`
- Naciśnięcie/przytrzymanie/zwolnienie: `isKeyDown/Pressed/Released` + `isActionDown/Pressed/Released`
- Mysz: `pointer.isDown/button`, `POINTER_DOWN/UP/MOVE`
- Pozycja kursora: `getPointer(): {x,y,worldX,worldY}` + `getPointerPosition/World`
- Mapowanie na akcje: `EngineConfig.inputMap: Record<action, code[]>` domyślnie move-*/interact/jump
- Zmiana mapowania: `setActionMap`, `remapAction` (czyści i binduje klawisze na nowo)
- Focus: `window.blur` czyści `keyDown`, nie przechwytuje gdy poza grą
- Sprzątanie: `InputManager.detach()` + `PhaserAdapter.destroy` usuwa listeners

Poza MVP (gamepad, GUI editor, multiplayer) — nie wdrożone, zgodnie z spec.

Kryteria: postać porusza się akcjami (`isActionDown("move-left")` w GameScene), klawisz nie zostaje wciśnięty po blur, mapowanie udokumentowane w `docs/api/README.md`.

---

## 8. Fizyka i kolizje — ✅

- System Phasera: `physics: { default:"arcade", arcade:{gravity,debug}}` — tylko Arcade
- Prosty model top-down: `gravity {0,0}`, `Arcade` — idealny dla top-down
- Collidery/overlapy: `PhysicsManager.addCollider/addOverlap` → `phaserScene.physics.add.collider/overlap`
- Ściany/granice: `setWorldBounds(0,0,2000,1400)` + `walls: StaticGroup` + `setCollideWorldBounds`
- Prędkość/ruch: `setVelocity(obj,vx,vy)` + `player.body.setVelocity(vx*speed, vy*speed)` w GameScene
- Nieruchome: `body: { type: "static" }` w opisie obiektu; `PhysicsPort.attachBody` tworzy static body
- Rozdzielenie blokujących od triggerów: `collider` (ściany) vs `overlap` (kryształy)
- Warstwy/kategorie: podstawowe via `Group` + `StaticGroup`; Arcade nie ma pełnych kategorii jak Matter, ale grupowanie wystarcza dla MVP

Poza MVP: własny silnik, jointy, płyny — nie wdrożone.

Kryteria: gracz nie przechodzi przez ściany (collider), trigger zbiera bez blokowania (overlap), brak 2. silnika.

---

## 9. Kamera 2D i świat — ✅

- Śledzenie: `CameraManager.follow(target, lerpX, lerpY)` → `cam.startFollow`
- Zoom: `setZoom/getZoom` → `cam.setZoom`
- Granice: `setBounds(x,y,w,h)` → `cam.setBounds` + `setWorldBounds`
- Oddzielenie world/screen: `worldToScreen` → `world - scroll`, `getCenter`
- Granice świata: `PhysicsManager.setWorldBounds` + `Camera.setBounds(0,0,2000,1400)`
- Świat demo z przeszkodami: `GameScene.drawWorldGrid` + `createWalls` (granice + 5 ścian wewnętrznych + 3 dekoracje)
- Warstwy tła/obiektów: `tileSprite` tło + `graphics` grid depth -10, gracz depth 10, UI depth 100, win depth 200

Poza MVP: streaming, chunkowanie, oświetlenie — nie wdrożone.

Kryteria: kamera śledzi bez ręcznego przesuwania, granice zapobiegają wyjechaniu, pozycje poprawne.

---

## 10. Zasoby — ✅

- Ładowanie: `AssetBackend` (adapter Phasera) obsługuje image/audio/json/spritesheet/atlas/font/tilemap; stan przejść `idle → queued → loading → ready`, błąd → `failed` + `AssetLoadError`
- ID: `AssetDescriptor.id` unikalne, `register` rzuca `Duplicate asset id`
- Duplikaty: sprawdzane `descriptors.has(id)`
- Postęp i raport: `report()` (counts, failures, errors, warnings, sizes), `onLoad`/`onError`, `sizeReport()`, `formatSizes()`; walidacja `validate()` i referencji `checkReferences()`
- Błędy sieci/parsowania: `setErrorHandler` + `handlePhaserError` → `AssetError` z id/src
- Cache: `loadedIds` Set + `isLoaded` + `markLoaded`; Phaser `textures.exists`
- Zwalnianie: `unload(id, scene)` → `textures.remove`
- Rozdzielenie src od id: `descriptor.src` vs `id` używane w grze

Kryteria: scena deklaruje `declareAssets`, brakujący `requireTexture` wskazuje id/src, wielokrotne użycie nie kopiuje (Phaser cache).

---

## 11. Format projektu JSON — ✅

- Schemat wersjonowany: `formatVersion: 2` — `{name, settings{width,height,scaleMode,backgroundColor,gravity,seed,fixedStepHz,inputMap}, assets[], scenes[{id,camera,objects[],properties}]}`; v1 obsługiwany przez migrację
- Walidacja: `validateProjectConfig` sprawdza każdy typ, `formatVersion===1`, hex color, scaleMode, asset type/src
- Odrzucanie z czytelnym komunikatem: zwraca `{valid:false, errors: string[]}` z konkretnymi ścieżkami `assets[i].id`
- Migracje: `migrateProject` (v1 → v2), wersja przyszła → `unsupported-version`, nieznane pola trafiają do `unknownFields` i wracają przy eksporcie
- Brak JS w JSON: nie eval, tylko `JSON.parse` + walidacja typów
- Brak exec: nie traktujemy jako kodu

Przykładowa konfiguracja z spec działa (`examples/top-down/project.json`).

Kryteria: prawidłowy JSON uruchamia (przykładowy), błędny zwraca listę problemów, nieobsługiwana wersja nie przechodzi.

---

## 12. Zdarzenia — ✅

- Minimalny bus: `EventBus` (Map<string, Set<Subscription>>)
- Sub/anulowanie: `on/subscribe → () => offById`, `subscribeForScene`
- Cykl silnika/scen: emit `engine:started/stopped/pause/resume/update/resize`, `scene:created/start/stop/shutdown`, `game:collected/completed`
- Interakcje: `game:collected` w GameScene `emit` przy overlap
- Ochrona przed leakami: `Scene.internalShutdown` → `events.clearScene(id)`, `clearScene` usuwa z `subscriptions`
- Typowane nazwy/payloady: generyki `<T>` w `on<T>(event, handler: (p:T)=>void)`, dokumentowane w `docs/api/README.md`

Kryteria: system reaguje bez bezpośrednich wywołań (`MenuScene` nasłuchuje `request:scene`), subskrypcje sceny usuwane.

---

## 13. Debugowanie — ✅

- Poziomy: `LogLevel: debug|info|warn|error` + `levelOrder` + `shouldLog`
- Kontekst: `Logger(context)` + `child(context)` → `[timestamp][LEVEL][Engine:SceneId] msg`
- Overlay: `DebugOverlay` div absolute top/left, background rgba(0,0,0,0.7), monospace, FPS + Scene
- FPS/aktywna scena: `DebugOverlay.update(timeMs)` liczy `frameCount` na sekundę, `setActiveScene(id)`
- Metryki: czas klatki, przejście czasu rzeczywistego w grę, obiekty, ciała, pary kolizji, pamięć, audio, najdroższe znaczniki profilera
- Logi: `LogBuffer` (400 wpisów) + `LogPanel` z filtrami poziomu, kontekstu i treści, własne sinki przez `Logger.addSink`
- Zasoby: `AssetManager.diagnose({ usedIds, references })` → `unused`, `missing`, `failed`, `unlicensed`, `heaviest`
- Raport: `Diagnostics.report/toJSON/copy/download` — sekcje `engine`, `scene`, `assets`, `audio`, `physics`, `profiler`, `logs`, `environment`, `findings`
- Wizualizacja colliderów: `physics.debug: true` → `arcade.debug` Phasera (konfigurowalne) albo `DebugViews` (collidery, siatka, osie, granice kamery)
- Raporty błędów: `logger.error` z etapem (`preload`, `create`) i kontekstem
- Nie wymagane w prod: `debug:false` → overlay nie montowany, `logger` level info (nie debug), `setDebug(false)` usuwa overlay

Kryteria: błąd wskazuje etap/kontekst, overlay wyłączany, brak szumu w prod.

---

## 14. C++23 i WASM — ✅ (MVP zakres)

- Katalog `native/core` + opis kompilacji: `native/core/README.md` z `cmake` + `emcmake` + wynik `core.wasm`
- Granica TS-WASM: `packages/wasm-bridge/src/index.ts` re-eksportuje `WasmBridge`; `WasmBridge` ma `load`, `getInstance`, `call<T>(name,...args)`; fasada ukrywa C++ (nie eksponuje klas wewnętrznych poza `findPathAStar`)
- Nie uzależnia uruchomienia gry: `WasmBridge` `required:false` domyślnie, `load` catch → `logger.warn`, gra działa
- Ograniczenie wywołań: dokumentacja `docs/guides/wasm.md` zaleca batch danych
- Obsługa błędu pobrania/inicjalizacji: `fetch` → `response.ok` check, `state: failed`, `getError()`, nie rzuca gdy `!required`
- Testy algorytmów: `native/core/src/pathfinding.cpp` + `include/pathfinding.hpp` (A*), `CMakeLists.txt` z `test_pathfinding`, testy TS `ProjectFormat` itp.
- Potencjalne pierwsze zadanie: A* na siatce / generowanie mapy — zaimplementowane w C++ i opisane, nie wdrożone do gry bez benchmarku

Kryteria: app nie crashuje bez WASM, korzyść mierzona (doc), interfejs nie ujawnia C++.

---

## 15. Przykładowa gra — ✅

Funkcje gry ( `apps/playground/src/scenes/GameScene.ts` + `MenuScene.ts` ):

- 4 kierunki: WASD/strzałki → `Input.isActionDown("move-*")` → `body.setVelocity(vx*speed, vy*speed)` z normalizacją diagonal 0.7071
- Kamera śledzi: `camera.follow(player,0.08,0.08)`
- Świat ze ścianami: `createWalls` 4 granice + 5 ścian + 3 dekoracje
- Kolizje blokują: `physics.add.collider(player, walls)` + `setCollideWorldBounds`
- Przedmiot trigger: 8 kryształów (`coin.png` lub fallback circle), `addOverlap(player, triggers, collect)` + tween zbierania
- UI licznik: `uiText` top-left `Kryształy: 3/8`, update na `game:collected`
- Menu → gra → menu: `MenuScene` (SPACE/klik → emit `request:scene {to:"game"}`), `GameScene` (R restart, M menu), `engine.getEvents().on("request:scene")`
- Restart: `request:restart` + `startScene("game")` czyści `collectibles` i `score` w `shutdown`
- Logika tylko przez publiczne API: `getPhysics/getCamera/getInput/getEvents/getLogger` — nie używa `phaserScene` prywatnie poza dozwolonym `phaserScene` w `Scene` (publiczne API sceny eksponuje `phaserScene` jako chronione, ale gra używa głównie wrapperów; wyjątek to `player` jako `Phaser.Physics.Arcade.Sprite` dla fizyki — akceptowalne bo `PhysicsManager` wymaga Phaser obiektu)

Kryteria: pokazuje sceny, input, sprite, kamera, kolizje, zdarzenia, UI; prosty, służy jako regresja.

---

## 16. Testy i jakość — ✅

- Typecheck: `npm run typecheck` → `tsc --noEmit` — przechodzi
- Lint/format: `eslint` + `prettier` + `.eslintrc.cjs` + `.prettierrc` + `npm run lint/format` w `package.json`
- Testy jednostkowe: `tests/unit/*.test.ts` — EngineConfig, EventBus, ProjectFormat, ProjectSchema, ProjectMigration, ProjectRepository, SaveStores, SqlSaveStore, AssetManifest, AssetPipeline, AssetManager, TiledMap, Time, Scheduler, Random, InputManager, Scene, GameObject, Components, SceneObjects, PublicApi (254 testów, 23 pliki) — przechodzą
- Testy integracyjne: `tests/integration/engine.test.ts` — SceneManager (rejestracja, duplikat) — przechodzą
- Build produkcyjny w CI: `.github/workflows/ci.yml` → `setup-node, npm ci, typecheck, test, build`
- Test przeglądarkowy przykładowej gry: playground działa na http://localhost:5173, weryfikowany ręcznie + via `curl`
- Przypięte wersje: `package.json` `phaser@3.80.1`, `typescript@5.4.5`, `vite@5.2.8`, `vitest@1.6.0` — `package-lock.json`
- Instrukcja instalacji/uruchomienia/build: `README.md` PL/EN + `docs/guides/getting-started.md` (krok po kroku)

Kryteria: CI przechodzi, build generuje `dist/` hostowalny statycznie, README pozwala uruchomić bez dodatkowych kroków.

---

## 17. Struktura repozytorium — ✅

Zgodna z proponowaną:

```
browser2d-engine/
├── apps/playground/ (Vite app, public/assets)
├── packages/engine/ (główny pakiet, index.ts re-eksportuje wszystko)
├── packages/phaser-adapter/ (re-eksport)
├── packages/project-format/ (re-eksport)
├── packages/wasm-bridge/ (re-eksport)
├── native/core/ (C++ + CMake + README)
├── examples/top-down/ (project.json + src/scene kopia)
├── tests/ (unit + integration + setup.ts)
├── docs/ (api, guides, ARCHITECTURE.md, MVP_CHECKLIST.md, AUDIT_REPORT.md, index.html)
├── .github/workflows/ci.yml
├── package.json, pnpm-workspace.yaml, tsconfig.json, vite.config.ts, vitest.config.ts
└── README.md
```

Uwaga: MVP pracuje w jednym pakiecie `packages/engine/src` i re-eksportuje do podpakietów — zgodnie z zasadą "rozdzielić gdy granice stabilne".

---

## 18. Poza zakresem MVP — ✅ NIE WDROŻONO

Wszystkie wymienione w spec poza zakresem nie zostały wdrożone: edytor wizualny, własny renderer WebGL/WebGPU, własny silnik fizyki, multiplayer, marketplace, oświetlenie, streaming map, edytor animacji, importer formatów, eksport natywny, C++/WASM dla niepotrzebnych zadań.

---

## 19. Lista kontrolna ukończenia MVP — ✅ 14/14

- Silnik uruchamia się w przeglądarce — tak (playground)
- Konfiguracja walidowana — tak
- Cykl życia silnika i scen — tak
- Sprite i transformacje — tak
- Input z mapowaniem — tak
- Kolizje i triggery — tak
- Kamera i granice — tak
- Ładowanie/diagnostyka zasobów — tak
- Format JSON — tak
- Event bus — tak
- Overlay debug i logowanie — tak
- Kompletna gra demonstracyjna — tak
- Testy/typecheck/build w CI — tak
- Dokumentacja uruchomienia i API — tak (README + docs/api + guides)
- Granica C++/WASM opisana, moduł tylko gdy uzasadniony — tak

**Zasada końcowa spełniona:** mały, stabilny silnik nad Phaserem, nie konkurencja; każda funkcja rozwiązuje konkretny problem lub tworzy podstawę dla edytora.

---

## Wnioski

Implementacja jest w 100% zgodna z MVP. Kod bez komentarzy, dokumentacja PL/EN, czysta architektura z adapterem, wydajność zachowana (brak 2. pętli, batch WASM, minimalne alokacje). Gotowe do iteracji lub jako baza pod edytor.

---

## Faza 7 — pipeline assetów (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Stabilne identyfikatory i manifest | ✅ | `assets/AssetManifest.ts`, walidacja `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$` |
| Wykrywanie duplikatów | ✅ | `duplicate-id` (błąd), `duplicate-src` (ostrzeżenie), 17 testów |
| Spritesheety, atlasy, animacje, fonty, audio | ✅ | `AssetBackend` (Phaser loader), `animationKey = "<id>:<key>"` |
| Raport brakujących plików i referencji | ✅ | `load-failed`, `missing-file`, `broken-reference`, `report()` |
| Anulowanie i ponawianie | ✅ | `cancel()` (tylko gdy backend potrafi), `retry()`, 18 testów |
| Zasady zwalniania i cache | ✅ | `hold`, `releaseOwner`, `retain`, `releaseGroup`, `gc`, `unload` |
| Optymalizacja i rozmiary | ✅ | `DEFAULT_SIZE_LIMITS` (512 kB / 2 MB / 8 MB), `heavy-asset`, `sizeReport` |
| Import Tiled | ✅ | `assets/TiledMap.ts`, 7 testów |
| Formaty i licencje udokumentowane | ✅ | strona „Zasoby” (PL/EN), tabela licencji |

## Faza 8 — projekt i zapisy (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Schemat v2 z podziałem sceny/zasoby/ustawienia | ✅ | `project/Schema.ts`, `CURRENT_PROJECT_VERSION = 2` |
| Walidacja typów, pól, referencji | ✅ | `project/Validate.ts`, kody `invalid-type`, `missing-field`, `broken-reference` |
| Migracje starszych formatów | ✅ | `project/Migrate.ts`, `MIGRATIONS`, 14 testów |
| Zachowanie nieznanych pól | ✅ | `unknownFields` na poziomie korzenia, ustawień, sceny i obiektu |
| Brak nadpisania przy błędzie | ✅ | `ProjectRepository`: tmp → read-back → backup → commit, przywracanie backupu |
| Projekt oddzielony od postępu | ✅ | `project:default` vs `save:<playerId>:<slot>` |
| Adaptery IndexedDB/localStorage/File System/HTTP | ✅ | `save/SaveStore.ts`, `HttpStore` = kontrakt `tools/save-server` |
| Testy importu/eksportu/integralności/migracji | ✅ | `ProjectSchema` (12), `ProjectMigration` (14), `ProjectRepository` (11), `SaveStores` (15) |
| SQL / MySQL / PostgreSQL | ✅ | `save/SqlSaveStore.ts`, `tools/save-server/sql.mjs`, 9 testów + test zgodności SQL znak w znak |
| Ograniczenie: brak żywej bazy w CI | ⚠️ | backend plikowy sprawdzony curl-em, SQL testami jednostkowymi; `pg`/`mysql2` nie są w repo |

## Faza 9 — audio, animacje, efekty (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Audio: muzyka, efekty, kanały, głośność, wyciszenie | ✅ | `audio/AudioManager.ts`, `AudioChannel`, `DEFAULT_AUDIO_VOLUMES`, 20 testów |
| Ograniczenia autoplay | ✅ | kolejka `pending`, `unlock()`, `pendingCount`, event `audio:unlocked` |
| Tweeny właściwości z easingiem, anulowaniem, sekwencjami | ✅ | `animation/Tween.ts`, `TweenManager.ts`, `EASINGS` (28), 36 testów |
| Animacje sprite'ów i kontrola klatek | ✅ | `playAnimation/stopAnimation/pauseAnimation/setFrame/getAnimationState`, `AnimationPlayOptions` |
| Wstrząs, fade, flash, proste efekty ekranowe | ✅ | `CameraManager.shake/fadeIn/fadeOut/flash/resetEffects`, `supportsEffects` |
| Stop audio/animacji przy pauzie i zniszczeniu sceny | ✅ | `Scene.internalShutdown`: `tweenManager.stopAll()`, `audio.stopOwner()`, `ports.render.clear()` |
| Przykłady + testy cyklu życia animacji | ✅ | playground (dźwięk, iskra, tweeny, mute), `SceneEffects.test.ts`, `Engine.test.ts` |
| Render port kompletny (delegacja animacji) | ✅ | `adapters/createRenderPort.ts`, `RenderPort.test.ts` (4) |
| Regresja: inline audio z data URI | ✅ | `PhaserAssetBackend.loadInlineAudio` (`decodeAudio` + fallback `cache.audio.add`), błąd zgłaszany jako `AssetError` |
| Kolejność inicjalizacji sceny | ✅ | `registerAnimations()` + `reconcileAssets()` przed `Scene.internalCreate()` |
| Ograniczenie: brak pomiaru latencji audio | ⚠️ | `rate` mapowane na `timeScale`; pomiar odsłuchowy, nie zautomatyzowany |

## Faza 14 — debugowanie i profilowanie (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Overlay: FPS, czas klatki, liczba obiektów, pamięć | ✅ | `systems/DebugOverlay.ts`, `systems/Memory.ts`, `readMemory`, 6 testów |
| Panel logów z filtrami i poziomami | ✅ | `debug/LogBuffer.ts`, `debug/LogPanel.ts`, 22 testy |
| Collidery, osie, granice kamery, siatka | ✅ | `debug/DebugViews.ts`, `getSupport()` per adapter, 7 testów |
| Ostrzeżenia o nieużywanych i brakujących zasobach | ✅ | `AssetManager.diagnose`, kody `assets-unused/missing/failed/unlicensed`, 10 testów |
| Znaczniki profilera dla systemów | ✅ | `debug/Profiler.ts`, `engine.time/scheduler/input/fixed/scene`, `physics.readback`, `tweens`, `components`, `destroy`, `render.sync`, 9 testów |
| Eksport raportu diagnostycznego | ✅ | `debug/Diagnostics.ts`, format `b2d-diagnostics` v1, 8 testów |
| Benchmarki obiektów, kolizji, tilemapy, zasobów | ✅ | `benchmarks/` — 17 przypadków, `benchmarks/latest.json` |
| Progi regresji bez deklaracji sprzętowych | ✅ | `scripts/bench-check.mjs`, tolerancja 40%, CPU i Node w raporcie, `npm run bench:check` |
| Dokumentacja PL + EN | ✅ | `#debug`, `#perf`, `#tests`, `#api-debug` (40 stron w tamtym momencie) |
| Ograniczenie: pamięć tylko w Chromium | ⚠️ | `performance.memory` nie jest standardem; poza Chromium overlay pokazuje `n/a` |

## Faza 15 — pluginy i rozszerzenia (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Punkty rozszerzeń: systemy, importery, panele | ✅ | `plugins/registries.ts`, wbudowany importer `tiled` |
| Manifest: id, wersja, zależności, zgodność silnika | ✅ | `plugins/manifest.ts`, `plugins/semver.ts` (15 testów) |
| Obsługa błędów ładowania i działania | ✅ | `PluginError` (13 kodów), `failed` + `lastError`, auto-wyłączanie systemów, `Plugins.test.ts` (34) |
| Uprawnienia i granice zaufania | ✅ | 7 uprawnień, `PluginPermissionError`; dokumentacja wprost: manifest nie jest piaskownicą |
| Przykładowy plugin + szablon pakietu | ✅ | `examples/plugins/session-stats`, `templates/plugin` (typ sprawdzany w `tsc`) |
| Katalog pluginów po stabilizacji API | ⏸️ ODŁOŻONE | warunki startu na stronie `#plugins` |
| Ograniczenie: brak izolacji kodu pluginu | ⚠️ | ten sam realm; `iframe`/`Worker` jako przyszły kierunek, udokumentowane |

## Faza 16 — build i publikacja (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Osobne konfiguracje dev/produkcja | ✅ | `vite.config.ts`, `vite.prod.config.ts`, `config/paths.ts`, `config/build-meta.ts` |
| Poprawne base path i zasoby | ✅ | `base: "./"`, `B2D_BASE`, meta `b2d-base`, `assetUrl()`, testy `PlaygroundAssets` (10) |
| Zachowanie po odświeżeniu | ✅ | stan w query stringu, scenariusz `refresh-state` |
| Raport rozmiaru i ostrzeżenia o regresji | ✅ | `dist/release.json`, `bundle:check` (10% / 35% / 5%), `benchmarks/bundle-baseline.json` |
| Eksport samodzielnej gry | ✅ | `scripts/export-game.mjs` → `release/game` + 7 konfiguracji hostingów + sumy SHA-256 |
| Ekran błędu startowego z diagnostyką | ✅ | inline boot script: 15 pól diagnostyki, kopiowanie, pobieranie, scenariusz `missing-bundle` |
| Instrukcje publikacji | ✅ | `docs/index.html#deploy`, `docs/DEPLOYMENT.md`, README |
| Testy HTTPS, CSP, hostingów | ✅ | `scripts/e2e-hosting.mjs`: 8 scenariuszy, także `https-csp` i `csp-strict` (zero naruszeń) |
| Eksport desktopowy | ⏸️ ODŁOŻONE | warunek: stabilizacja wersji webowej |
| Ograniczenie: brak routingu po ścieżkach | ⚠️ | świadome — stan w query stringu, `404.html` zamiast SPA fallback |

## Faza 17 — jakość, bezpieczeństwo i kompatybilność (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Testy jednostkowe i integracyjne poza ścieżką szczęśliwą | ✅ | 508 testów w 43 plikach; nowe `DebugSurface` (9), `ApiSnapshot` (3), `Resilience` (9) |
| Scenariusze e2e kluczowych akcji użytkownika | ✅ | `scripts/e2e-scenarios.mjs`: 2 scenariusze, 31 sprawdzeń (rozgrywka, pauza, wyciszenie, przykłady, debug, zapis po odświeżeniu, restart, brakujący asset) |
| Matryca rozmiarów ekranu i dotyku | ✅ | `scripts/e2e-matrix.mjs`: 7 profili (desktop, laptop, tablet, phone, phone-small, reduced-motion, resize) |
| Matryca przeglądarek | ✅ | `scripts/e2e-compat.mjs`: Chromium 12/12 (WebGL), Firefox 12/12 (canvas 2D), WebKit raportowany jako pominięty z powodem |
| Brakujące zasoby, błędy sieci, niepoprawne projekty | ✅ | `tests/unit/Resilience.test.ts`, scenariusz `missing-asset`, `AssetManager.diagnose()` + `retry()` |
| Audyt zależności i kontrola licencji (biblioteki i zasoby) | ✅ | `npm run audit:licenses[:check]`: 308 pakietów, 0 naruszeń; `docs/LICENSES.md`, `apps/playground/public/assets/LICENSES.json` |
| Limity i walidacja importowanych danych | ✅ | `project/Limits.ts` (14 limitów), kody `limit-exceeded`, `unsafe-key`, `ProjectLimits.test.ts` (22) |
| Polityka zgodności API i migracji formatu | ✅ | `ApiSnapshot.test.ts` (296 symboli), `API_LEVEL`/`API_STABILITY`, `Migrate.ts`, strona `#policy` |
| Lista wspieranych przeglądarek, znane ograniczenia, procedura zgłoszeń | ✅ | strony `#compat` i `#policy`, `docs/index.html` |
| Ograniczenie: WebKit/Safari poza automatem w tym środowisku | ⚠️ | brak `libicu66` dla binarki WebKit; Safari sprawdzane ręcznie, lista wersji na stronie `#compat` |
| Ograniczenie: treść canvasu poza drzewem dostępności | ⚠️ | cecha platformy; zalecenie lustrzanego HUD w DOM (przykład na stronie `#compat`) |
| Ograniczenie: pominięty silnik to brak pokrycia, nie dowód działania | ⚠️ | raport jawnie oznacza `POMINIĘTY` z powodem; nigdy nie liczy go jako PASS |

## Faza 19 — wydania i utrzymanie (dodatek)

| Wymaganie | Status | Dowód |
|-----------|--------|-------|
| Semver dla publicznych pakietów | ✅ | `scripts/versions.mjs` (`--check`, `--bump`, `--set`), `bumpSemver`/`compareSemver`, `WorkspaceVersions.test.ts` |
| Kanał stabilny i osobny status funkcji eksperymentalnych | ✅ | `packages/engine/src/stability.ts`: 21 funkcji w kanałach `stable` (17), `experimental` (3), `internal` (1); `getStabilityReport()`, `isStable()`, `isExperimental()`, `Stability.test.ts` (9) |
| Changelog i szablon release notes | ✅ | `CHANGELOG.md` (Keep a Changelog, sześć sekcji zawsze obecnych), `docs/RELEASE_NOTES_TEMPLATE.md` (8 sekcji + 5 zasad), testy kontraktu |
| Automatyczne artefakty wydań | ✅ | `scripts/release.mjs --artifacts` → `release/artifacts/{wersja}/`: `release.json`, `test-results.json`, `benchmarks.json`, `bundle-manifest.json`, `api-snapshot.json`, `changelog-entry.md`, `release-notes.md`, `CHECKSUMS.txt`, `index.json` |
| Wyniki testów i benchmarków przy wydaniu | ✅ | Raport vitest JSON (545 testów) + 17 przypadków benchmarku z medianą i deltą do bazy, sumy SHA-256 |
| Polityka deprecacji API | ✅ | `deprecation.ts` (rejestr, jedno powiadomienie na sesję), `engine.warnDeprecated()`, tabela wersji w `#policy` i `#releases` |
| Narzędzia migracji formatu | ✅ | `packages/engine/src/project/MigrateTool.ts` + `scripts/migrate.ts` + `scripts/migrate.mjs`; projekt i zapis, `--check`, `--out`, tryb potokowy, `MigrateTool.test.ts` (11) |
| Zgodne wersje pakietów w monorepo | ✅ | 4 pakiety w lockstepie, przypięte zależności wewnętrzne, `versions:check` w CI i w `verify`; brakujące manifesty dodane (wcześniej `npm ci` nie działał) |
| Lista długu technicznego | ✅ | `docs/TECH_DEBT.md`: 14 otwartych z warunkami spłaty, 4 spłacone z datą; brama blokuje wydanie przy otwartym S1 |
| Lista decyzji architektonicznych | ✅ | `docs/adr/` — 9 rekordów + indeks; `release:check` zgłasza rekord bez wpisu w indeksie |
| Ograniczenie: pakiety nie są publikowalne poza monorepo | ⚠️ | D-001: brak kroku budowania `dist`/`d.ts`; pierwszy krok do publikacji w rejestrze |
| Ograniczenie: liczniki kanałów czytane regexem w skryptach wydania | ⚠️ | D-007: liczby pilnuje `Stability.test.ts`, docelowo odczyt przez `vite-node` |
