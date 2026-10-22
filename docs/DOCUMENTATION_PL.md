# Dokumentacja — Język polski

Pełna dokumentacja: `docs/index.html` (47 stron, PL/EN, wyszukiwarka), `README.md`, `docs/api/README.md` (referencja API), `docs/guides/*`.

Ten plik jest indeksem PL.

## Instalacja

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # do dist/
npm test
npm run typecheck
npm run bench     # benchmarki w Node → benchmarks/latest.json
npm run bench:check
```

## Moduły silnika

- **Engine / createEngine** — cykl życia, DOM, resize, `pauseOnHidden`, `pause`/`resume`, `setTimeScale`, `destroy`
- **EngineConfig** — walidacja, `defaultInputMap`, `hexToNumber`
- **Time** — `elapsed`, `deltaTime` (s), clamp `maxDeltaTime`, `timeScale`, krok stały (`fixedDelta`, `isClamped`)
- **Scheduler / Timer / Random** — zadania z uchwytami, izolacja błędów, seeded losowość, `fork`
- **Scene / SceneManager** — `preload`/`create`/`update`/`fixedUpdate`/`shutdown`, unikalne ID, dane startowe
- **GameObject / Component** — transformacje, tagi, grupy, hierarchia, fazy systemów
- **AssetManager** — manifest, statusy, `cancel`/`retry`, uchwyty właścicieli, `report`/`sizeReport`
- **InputManager** — akcje → kody klawiszy, `isActionDown/Pressed/Released`, pointer, `remapAction`
- **PhysicsManager** — collider/overlap, bounds, immovable, velocity
- **CameraManager** — follow, zoom, bounds, `shake`, `fadeIn/fadeOut`, `flash`, `resetEffects`
- **AudioManager / SoundHandle** — kanały, głośności, wyciszenie, kolejka autoplay, `getState`
- **Tweeny / Easing** — `to`/`from`/`delay`/sekwencje, 28 krzywych, anulowanie, właściciele
- **EventBus** — `on`/`emit`/`clearScene`, scenowe subskrypcje
- **Logger / DebugOverlay** — poziomy, kontekst, sinki; overlay z fps, czasem klatki, obiektami, ciałami, pamięcią i audio
- **Debug (LogBuffer, LogPanel, DebugViews, Profiler, Diagnostics)** — panel logów z filtrami, widoki colliderów/siatki/osi/granic, znaczniki profilera, raport diagnostyczny JSON
- **Benchmarki** — 17 przypadków w Node (`objects`, `queries`, `collisions`, `tilemap`, `assets`), porównanie z bazą i próg regresji 40% bez deklaracji sprzętowych
- **Build i publikacja** — dwie konfiguracje Vite, ścieżki bazowe, raport rozmiaru z progami, eksport `release/game`, ekran błędu startowego z diagnostyką, CSP i testy hostingów
- **Pluginy** — `PluginHost` z manifestem (`id`, `version`, zakres `engine`, `dependencies`, `permissions`), punkty rozszerzeń: systemy, importery, panele, zdarzenia; kolejność zależności z detekcją cykli, budżet błędów systemu i auto-wyłączanie, sekcja `plugins` w raporcie diagnostycznym; uprawnienia ograniczają API kontekstu, a manifest **nie** jest piaskownicą
- **ProjectFormat** — `validateProject`, `migrateProject`, `importProject`, `exportProject`, wersja 2
- **Zapisy** — `ProjectRepository`, `PlayerSaveRepository`, magazyny w pamięci/localStorage/IndexedDB/FS/HTTP/SQL
- **WasmBridge** — opcjonalny, bezpieczny fallback

## Przykład

Zobacz `docs/guides/getting-started.md` i `apps/playground/src/scenes/GameScene.ts`.

## C++ / WASM

Zobacz `native/core/README.md` i `docs/guides/wasm.md`.

## Checklist MVP

Zobacz `docs/MVP_CHECKLIST.md`.

## Wydajność i clean code

- Brak komentarzy w kodzie; dokumentacja w `docs/`
- Małe funkcje, SRP, DI przez konstruktory
- Brak duplikacji; adapter izoluje Phasera
- Efektywne pętle, minimalne alokacje
