# MVP Checklist — Browser2DEngine

Status: ✅ MVP kompletny — wszystkie kryteria akceptacji spełnione.

## 1. Konfiguracja i cykl życia silnika

- [x] Utworzenie instancji z konfiguracją (`Engine` + `EngineConfig`)
- [x] Wskazanie elementu DOM (`parent: string | HTMLElement`)
- [x] Logiczna szerokość/wysokość, kolor tła
- [x] Tryb skalowania (`fit`/`fill`/`fixed`/`expand`) → `Phaser.Scale`
- [x] Min/max wymiary renderowania
- [x] Tryb debugowania (overlay FPS, logi)
- [x] Uruchomienie i zatrzymanie (`start`/`stop`/`destroy`)
- [x] Czytelne błędy walidacji (nie cicha awaria)
- [x] Sprzątanie zasobów i nasłuchiwaczy (`destroy` usuwa canvas, resize, visibility)
- [x] Brak dodatkowego canvas przy re-starcie tej samej instancji
- [x] Obsługa resize okna (ResizeObserver + `scale.refresh`)
- [x] Pauza po ukryciu karty (`pauseOnHidden`, `document.visibilitychange`)

## 2. Pętla gry i czas

- [x] Oddzielenie logiki od renderowania (API `Time`, `deltaTime` w `Scene.update`)
- [x] `time.elapsed` i `deltaTime` w sekundach
- [x] Clamp dużego `deltaTime` (`maxDeltaTime`, domyślnie 0.1s)
- [x] Pauza/wznowienie
- [x] Dostęp do aktualnej sceny (`SceneManager.getActiveScene`)
- [x] Stabilne wywołanie zgodne z cyklem Phasera (`InternalPhaserScene.update`)
- [x] Bez drugiej, konkurencyjnej pętli renderera
- [x] Dwa zegary: czas gry (`deltaTime`, `elapsed`) i rzeczywisty (`realDeltaTime`, `realElapsed`) — Faza 3
- [x] Skala czasu (`engine.setTimeScale`) i zdarzenie `engine:timeScale`
- [x] Opcjonalny stały krok (`fixedStep.hz`, `Scene.fixedUpdate`, `fixedAlpha`)
- [x] Timery z anulowaniem (`Scheduler`, `Timer`, `TaskHandle`) czyszczone przy `shutdown()`
- [x] Generator losowy z seedem (`Random`, `seed` w konfiguracji, `fork()`)
- [x] Polityka utraty fokusu i długich klatek (`pauseOnHidden`, clamp, `engine:frameClamped`)
- [x] Udokumentowane granice determinizmu w przeglądarce (docs `#determinism`)

## 3. Sceny

- [x] Rejestrowanie pod unikalnym ID (duplikat → błąd)
- [x] Uruchamianie, zatrzymywanie, przełączanie + dane startowe
- [x] Cykl: `preload`, `create`, `update`, `shutdown`
- [x] Obsługa błędów ładowania zasobów
- [x] Sprawdzenie aktywnej sceny
- [x] Usuwanie/dezaktywacja obiektów przy przełączeniu

## 4. Obiekty i transformacje

- [x] Tworzenie/usuwanie (`createObject`, `destroyObject`, kolejka zniszczeń, grupy)
- [x] `x`, `y`, `rotation`, `scale`, `visible`, `active`
- [x] Stabilny identyfikator `id`/`name`
- [x] Grupowanie
- [x] Oddzielenie danych od logiki (komponenty)
- [x] Punkty rozszerzeń (komponenty bez pełnego ECS)

## 5. Renderowanie i sprite'y

- [x] Sprite'y z plików graficznych
- [x] Transform, alpha, origin, depth, tint
- [x] Kolejność renderowania (depth)
- [x] Tekst
- [x] Kolor tła (`EngineConfig.backgroundColor`, `Camera.setBackgroundColor`)
- [x] Skalowanie z zachowaniem proporcji
- [x] Renderowanie delegowane do Phasera
- [x] Czytelne błędy przy braku tekstury (`AssetError`)

## 6. Input

- [x] Klawiatura: down/pressed/released
- [x] Mysz: przyciski, pozycja kursora (ekranowa i world)
- [x] Mapowanie na akcje (`move-left`, `jump`, `interact`)
- [x] Zmiana mapowania w konfiguracji (`remapAction`, `setActionMap`)
- [x] Focus: nie przechwytuje gdy poza grą, czyści stan na blur
- [x] Sprzątanie nasłuchiwaczy przy `stop`

## 7. Fizyka i kolizje

- [x] Phaser Arcade (konfigurowalne `gravity`, `debug`)
- [x] Collider i overlap
- [x] Ściany i granice świata
- [x] Prędkość, ruch
- [x] Obiekty nieruchome (`setImmovable`)
- [x] Rozdzielenie kolizji blokujących od triggerów
- [x] Brak drugiego silnika fizyki

## 8. Kamera i świat

- [x] Śledzenie obiektu (`Camera.follow`)
- [x] Zoom
- [x] Granice kamery i świata
- [x] Oddzielenie pozycji world vs screen (`worldToScreen`)
- [x] Świat demonstracyjny z przeszkodami
- [x] Warstwy tła z kontrolowaną kolejnością

## 9. Zasoby i asset manager

- [x] Ładowanie tekstur/obrazów/audio/json/spritesheet/atlas
- [x] Unikalne ID, wykrywanie duplikatów
- [x] Progress i błędy sieci/parsowania
- [x] Cache
- [x] Zasady zwalniania
- [x] Rozdzielenie `src` od `id`

## 10. Format projektu JSON

- [x] Wersjonowany plik (`formatVersion:1`)
- [x] `name`, `game{width,height,scaleMode,backgroundColor}`, `assets[]`
- [x] Walidacja pól i typów (`validateProjectConfig`, `parseProjectJson`)
- [x] Czytelne komunikaty błędów
- [x] Wykrywanie nieobsługiwanej wersji
- [x] Brak JS w JSON, brak exec

## 11. Zdarzenia i komunikacja

- [x] EventBus (`on`/`off`/`emit`)
- [x] Subskrypcja i anulowanie
- [x] Zdarzenia cyklu silnika i scen
- [x] Triggery interakcji (`game:collected`)
- [x] Ochrona przed leakami (czyszczenie na `shutdown` sceny)
- [x] Typowane payloady

## 12. Debugowanie i logowanie

- [x] Poziomy: debug, info, warn, error
- [x] Kontekst (nazwa sceny, id zasobu)
- [x] Overlay debug (FPS + aktywna scena)
- [x] Wizualizacja colliderów (przez `physics.debug`)
- [x] Czytelne raporty błędów
- [x] Debug nie wymagany w produkcji
- [x] Overlay rozszerzony: czas klatki, przejście czasu rzeczywistego w grę, obiekty, ciała, pary kolizji, pamięć, audio
- [x] Panel logów z filtrami poziomu, kontekstu i treści
- [x] Widoki: collidery, siatka, osie, granice kamery + `getSupport()` per adapter
- [x] Ostrzeżenia o nieużywanych, brakujących i bezlicencyjnych zasobach (`diagnose()`)
- [x] Znaczniki profilera dla systemów silnika
- [x] Eksport raportu diagnostycznego do JSON i pliku

## 13. C++23 i WASM

- [x] Katalog `native/core` + opis kompilacji Emscripten
- [x] Granica TS–WASM (`WasmBridge`, cienka fasada, batch danych)
- [x] Gra działa bez WASM
- [x] Obsługa błędu pobrania/inicjalizacji
- [x] Testy algorytmów (A* w C++, testy w TS)
- [x] Przykład: A* pathfinding na siatce

## 14. Przykładowa gra referencyjna

- [x] Ruch w 4 kierunkach (WASD / strzałki, zależny od `deltaTime`)
- [x] Kamera śledzi gracza
- [x] Ściany, przeszkody, kolizje blokujące
- [x] Trigger zbierania
- [x] UI licznik
- [x] Menu → gra → menu, restart
- [x] Logika tylko przez publiczne API

## 15. Testy i jakość

- [x] Typecheck (`npm run typecheck`)
- [x] Lint/format (eslint + prettier)
- [x] Testy jednostkowe (config, JSON, EventBus, Time, AssetManager, debug) — 401 testów w 35 plikach
- [x] Testy integracyjne (SceneManager)
- [x] Build produkcyjny w CI (`.github/workflows/ci.yml`)
- [x] Test przeglądarkowy (playground)
- [x] Benchmarki w Node (17 przypadków) z porównaniem do bazy i progiem regresji
- [x] Przypięte wersje zależności
- [x] Instrukcja instalacji/uruchomienia/build w README

## 16. Struktura repozytorium

- [x] `apps/playground`
- [x] `packages/engine`, `phaser-adapter`, `project-format`, `wasm-bridge`
- [x] `native/core`
- [x] `examples/top-down`
- [x] `tests`
- [x] `README.md`, `pnpm-workspace.yaml`

## Poza zakresem MVP — nie wdrożono (zgodnie z założeniem)

- Edytor wizualny, własny renderer, własny silnik fizyki, multiplayer, marketplace, oświetlenie, streaming map, edytor animacji, importer formatów, eksport natywny

---

MVP jest małym, stabilnym silnikiem nad Phaserem, nie konkurencją. Każda funkcja własna rozwiązuje konkretny problem lub tworzy podstawę dla przyszłego edytora.

## Rozszerzenia API 0.2

- [x] Stabilne interfejsy `Engine`, `Scene`, `GameObject`, `Component`, `AssetManager` + testy `expectTypeOf`
- [x] Cykl życia obiektu: tworzenie, aktywacja, dezaktywacja, usuwanie
- [x] Bezpieczne usuwanie w `update` (kolejka `pendingDestroy`)
- [x] Tagi, grupy, filtrowanie i wyszukiwanie (`ObjectIndex`)
- [x] Hierarchia rodzic–dziecko i transformacje dziedziczone (`world`, `isActiveInHierarchy`)
- [x] Cykl życia komponentów i kolejność systemów (`SYSTEM_ORDER`)
- [x] Ocena lekkiego ECS na prototypie (`scripts/bench-ecs.mjs`, decyzja: nie wdrażać)
- [x] Logika oddzielona od obiektów Phasera (pięć portów, adapter)
- [x] Testy publicznego API niezależne od adaptera (`tests/helpers/harness.ts`)
- [x] Testy czasu, timerów i losowości: `Time.test.ts` (12), `Scheduler.test.ts` (14), `Random.test.ts` (12)

## Faza 7 — pipeline assetów

- [x] Manifest ze stabilnymi identyfikatorami i wykrywaniem duplikatów (`duplicate-id`, `duplicate-src`)
- [x] Spritesheety, atlasy, animacje (klucz `assetId:animacja`), fonty bitmapowe, audio
- [x] Raport brakujących plików i zepsutych referencji (`broken-reference`, `load-failed`, `missing-file`)
- [x] Anulowanie i ponawianie, gdy backend to wspiera (`cancel()`, `retry()`)
- [x] Zasady zwalniania i czyszczenia cache (`hold`, `retain`, `releaseGroup`, `gc`, `unload`)
- [x] Raport rozmiarów i ostrzeżenia o ciężkich zasobach (`sizeReport`, `heavy-asset`)
- [x] Opcjonalny import Tiled (`assets/TiledMap.ts`)
- [x] Udokumentowane formaty i licencje (strona „Zasoby”)
- [x] Testy: `AssetManifest` (17), `AssetPipeline` (18), `TiledMap` (7)

## Faza 8 — projekt i zapisy

- [x] Schemat v2 z podziałem sceny / zasoby / ustawienia
- [x] Walidacja typów, pól i referencji (`validateProject`)
- [x] Migracje starszych formatów (v1 → v2) i zachowanie nieznanych pól (`unknownFields`)
- [x] Nigdy nie nadpisuj projektu, gdy walidacja lub zapis zawiedzie (temp → odczyt zwrotny → backup → commit)
- [x] Projekt oddzielony od zapisów postępu gracza (`ProjectRepository` vs `PlayerSaveRepository`)
- [x] Adaptery: `MemoryStore`, `LocalStorageStore`, `IndexedDbStore`, `FileSystemStore`, `HttpStore`
- [x] SQL: `SqlSaveStore` dla `postgres` i `mysql` + serwer referencyjny `tools/save-server`
- [x] Testy importu, eksportu, integralności i migracji: `ProjectSchema` (12), `ProjectMigration` (14), `ProjectRepository` (11), `SaveStores` (15), `SqlSaveStore` (9)
- [ ] Autosave, kopie odzyskiwania, historia edycji — poza zakresem tej fazy (wzorce w dokumentacji)

## Faza 9 — audio, animacje, efekty

- [x] Cztery kanały (`master`, `music`, `sfx`, `ui`), głośność kanału i `master`, wyciszenie globalne
- [x] `SoundHandle` z `stop()`, `setVolume()`, `isPlaying`, `statusName`, `effectiveVolume`, `rate`; właściciel = scena, sprzątanie przy `shutdown()`; pauza działa na poziomie `pauseAll()`/`resumeAll()`
- [x] Ograniczenia autoplay: bez gestu użytkownika żądania lądują w kolejce `pending`, `unlock()` je uruchamia, event `audio:unlocked`
- [x] `pauseAll()` / `resumeAll()` przy `engine.pause()` / `engine.resume()`; dźwięki sceny zatrzymywane przy zniszczeniu sceny
- [x] Tweeny właściwości: `to`, `from`, `delay`, `repeat`, `yoyo`, `easing`, anulowanie (`cancel`, `stopOwner`, `stopAll`)
- [x] 28 krzywych `EASINGS` + `resolveEasing()` dla nazw i własnych funkcji
- [x] Sekwencje (`sequence`) z `repeat`, `yoyo`, `delay`, `easing` i czyszczeniem przy zniszczeniu sceny
- [x] Animacje sprite'ów: `playAnimation`, `stopAnimation`, `pauseAnimation`, `setFrame`, `getAnimationState`
- [x] Efekty kamery: `shake`, `fadeIn`, `fadeOut`, `flash`, `resetEffects`, `supportsEffects` (degradacja bez wsparcia backendu)
- [x] Przykłady w playgroundzie: dźwięk zbierania, iskra na spritesheecie, tweeny zebranych kryształów, wyciszenie pod `N`, ikona 🔊/🔇 w HUD
- [x] Testy: `Easing` (8), `Tween` (28), `AudioManager` (20), `SceneEffects`, `RenderPort` (4), `Engine` (20)


## Faza 14 — debugowanie i profilowanie

- [x] Overlay: FPS, czas klatki, liczba obiektów, dostępna pamięć (z fallbackiem `n/a` poza Chromium)
- [x] Panel logów z filtrami i poziomami — bufory 400 wpisów, liczniki per poziom, throttling odświeżania
- [x] Widoki colliderów, osi, granic kamery i siatki — `DebugViews.set/toggle/reset/getSupport/sync/clear`
- [x] Ostrzeżenia o nieużywanych i brakujących zasobach (`AssetManager.diagnose`)
- [x] Znaczniki profilera dla systemów silnika (`engine.time`, `engine.scene`, `physics.readback`, `tweens`, `render.sync`, ...)
- [x] Eksport raportu diagnostycznego (`Diagnostics.report/toJSON/copy/download`)
- [x] Benchmarki obiektów, kolizji, tilemapy i rozmiaru zasobów (`benchmarks/`, 17 przypadków)
- [x] Progi regresji bez deklaracji sprzętowych (`bench:check`, tolerancja 40%, CPU i Node w raporcie)
- [x] Testy: `Profiler` (9), `LogBuffer` (13), `DebugViews` (7), `Diagnostics` (8), `DebugOverlay` (6), `LogPanel` (9), `AssetDiagnostics` (10), `Engine` (27)
- [x] Playground: panel debugowania w popoverze, klawisze `U/L/K/G/X/B/Y`, pobieranie raportu
- [x] Dokumentacja PL + EN: strony `#debug`, `#perf`, `#tests`, `#api-debug`

## Faza 15 — pluginy i rozszerzenia

- [x] Punkty rozszerzeń: systemy, importery formatów, panele edytora/narzędzi
- [x] Manifest pluginu: `id`, `version`, `engine` (zakres semver), `dependencies`, `permissions`
- [x] Cykl życia: `install` → `activate` → `deactivate` → `uninstall`/`dispose`, kolejność zależności, detekcja cykli
- [x] Obsługa błędów podczas ładowania i działania: stany `failed`, kody `PluginError`, auto-wyłączanie systemów, zdarzenia `plugin:*`
- [x] Uprawnienia i granice zaufania: capability-gating kontekstu, jawna informacja, że manifest nie izoluje kodu
- [x] Przykładowy plugin (`examples/plugins/session-stats`) i szablon pakietu (`templates/plugin`)
- [x] Katalog pluginów odłożony do stabilizacji API (warunki startu udokumentowane)
- [x] Testy: `Plugins` (34), `Semver` (15), integracja z `Engine` (4)
- [x] Playground: plugin instalowany przy starcie, panele w popoverze debugowania
- [x] Dokumentacja PL + EN: strony `#plugins`, `#api-plugins`

## Faza 16 — build i publikacja

- [x] Osobne konfiguracje dev/produkcja: `vite.config.ts` + `vite.prod.config.ts` + `config/*`
- [x] Poprawne base path: `base: "./"` domyślnie, `B2D_BASE` dla korzenia i podkatalogów, meta `b2d-base`, `assetUrl()` względem dokumentu
- [x] Zachowanie po odświeżeniu: stan w `?example=…&lang=…`, `index.html` `no-cache`, `404.html` zamiast SPA fallback
- [x] Raport rozmiaru bundla: `dist/release.json` (gzip, brotli, SHA-256) + `bundle:check` z progami (10% / 35% / 5%)
- [x] Eksport samodzielnej gry: `npm run export:game` → `release/game` + `hosting/` + `CHECKSUMS.txt`
- [x] Ekran błędu startowego z diagnostyką: build, protokół, `secureContext`, WebGL, viewport, nieudane zasoby, stos; kopiowanie i pobieranie raportu
- [x] Instrukcje publikacji: strona `#deploy`, `docs/DEPLOYMENT.md`, README
- [x] Testy HTTPS, CSP i konfiguracji hostingów: `npm run test:hosting` (8 scenariuszy, Chromium)
- [x] Eksport desktopowy odłożony do stabilizacji webu (zapisane w dokumentacji)

## Faza 17 — jakość, bezpieczeństwo i kompatybilność

- [x] Testy jednostkowe i integracyjne: 508 testów w 43 plikach (`DebugSurface`, `ApiSnapshot`, `Resilience` jako nowe)
- [x] Scenariusze regresyjne e2e: `npm run test:scenarios` — 2 scenariusze, 31 sprawdzeń na prawdziwym `dist`
- [x] Matryca urządzeń: `npm run test:matrix` — 7 profili, canvas 16:9, brak poziomego przewijania, cele dotykowe ≥ 24 px, reduced motion, resize
- [x] Matryca przeglądarek: `npm run test:compat` — Chromium i Firefox po 12 sprawdzeń; WebKit pominięty z podanym powodem
- [x] Brakujące zasoby, błędy sieci, niepoprawne projekty: raport assetów, `retry()`, `importProject()` nigdy nie rzuca
- [x] Audyt zależności i licencji: `npm run audit:licenses:check` — 308 pakietów, 0 naruszeń, generowany `docs/LICENSES.md`
- [x] Limity i walidacja importu: 14 limitów, kody `limit-exceeded` i `unsafe-key`, 22 testy
- [x] Polityka zgodności API i migracji formatu: snapshot publicznego API, `API_LEVEL`, deprecacja, migracje v1 → v2 i zapisów gracza
- [x] Dokumentacja: lista wspieranych przeglądarek, znane ograniczenia, procedura zgłaszania błędów i podatności (strony `#compat`, `#policy`)
- [x] Skrypty npm i CI: `test:unit`, `test:scenarios`, `test:matrix`, `test:compat`, `test:e2e`, `audit:licenses:check`, `verify`

## Faza 19 — wydania i utrzymanie

- [x] Semver publicznych pakietów: `bumpSemver`/`compareSemver`, tabela „zmiana → wersja → API_LEVEL”, `npm run versions:bump`
- [x] Kanał stabilny i osobny status funkcji eksperymentalnych: `FEATURE_STATUS` (21 funkcji), `getStabilityReport()`, `isStable()`, `isExperimental()`
- [x] Changelog: `CHANGELOG.md` w formacie Keep a Changelog, sześć sekcji zawsze obecnych, pełny wpis `0.1.0` i `[Unreleased]`
- [x] Szablon release notes: `docs/RELEASE_NOTES_TEMPLATE.md` — 8 sekcji, 5 zasad, liczby wyłącznie z artefaktów
- [x] Automatyczne artefakty wydań: `npm run release:artifacts` → `release/artifacts/{wersja}/` + `CHECKSUMS.txt` + `index.json`
- [x] Wyniki testów i benchmarków przy wydaniu: raport vitest JSON, 17 przypadków benchmarku z deltą do bazy, rozmiar bundla, snapshot API
- [x] Polityka deprecacji: rejestr + `@deprecated` w typach + jedno ostrzeżenie runtime na sesję + wersja usunięcia
- [x] Narzędzia migracji formatu: `npm run migrate` (projekt i zapis, `--check`, `--out`, `--stdio`, `--require-licenses`)
- [x] Zgodne wersje pakietów w monorepo: 4 pakiety, przypięte zależności wewnętrzne, brama `versions:check` w CI
- [x] Lista długu technicznego: `docs/TECH_DEBT.md` z warunkami spłaty, waga S1 blokuje wydanie
- [x] Lista decyzji architektonicznych: `docs/adr/` — 9 rekordów z kontekstem, kosztami i odrzuconymi alternatywami
- [x] Bramy w CI: `release:check` w jobie `verify`, artefakty jako wynik wydania
