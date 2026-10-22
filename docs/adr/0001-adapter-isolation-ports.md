# 0001 — Izolacja adaptera przez porty

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** publiczne API silnika nie może przeciekać typów Phasera, a testy nie mogą wymagać przeglądarki.

## Kontekst

Rdzeń silnika potrzebuje renderowania, fizyki, kamery, wejścia, audio i backendu zasobów. Naturalna pokusa to
wywoływanie Phasera bezpośrednio w scenach i obiektach — mniej kodu, mniej warstw. Koszt: każdy test wymaga DOM-u
i canvasu (albo mocka, który kłamie), a wymiana lub aktualizacja Phasera dotyka całego repozytorium.

## Decyzja

Wszystko, co dotyka Phasera, przechodzi przez sześć interfejsów z `core/ports.ts` (`RenderPort`, `PhysicsPort`,
`CameraPort`, `InputPort`, `AudioPort`, `AssetBackend`). Rdzeń zna wyłącznie te interfejsy. Konkretny adapter
(`PhaserAdapter`) implementuje je i jest tworzony przez `AdapterFactory` z zależnościami wstrzykiwanymi z `Engine`.
Pakiety w `packages/*` nie re-eksportują typów Phasera poza `@browser2d/phaser-adapter`.

## Konsekwencje

- Testy jednostkowe działają na atrapach portów (`tests/helpers/harness.ts`) w jsdom, bez Phasera i bez canvasu —
  508 testów w ~22 s.
- `tests/unit/RenderPort.test.ts` i `PublicApi.test.ts` pilnują kompletności delegacji i braku przecieków typów.
- Koszt: każda nowa funkcja wymaga wpisu w porcie **i** w adapterze; zdarzają się metody delegujące 1:1.
- Koszt: debugowanie idzie przez dwie warstwy — dlatego `getSupport()` w `DebugViews` mówi wprost, czego adapter
  nie obsługuje, zamiast udawać, że obsługuje.

## Odrzucone alternatywy

- **Bezpośrednie użycie Phasera w scenach** — szybsze na start, ale wiąże API publiczne z wersją Phasera i zabija
  testy bez przeglądarki.
- **Fork Phasera** — pełna kontrola, ale utrzymywanie silnika renderującego to osobny projekt; Phaser 3.80 pokrywa
  wymagania MVP.
- **Własny renderer na WebGL** — poza zakresem; patrz rekord 0003 o dyscyplinie zakresu.
