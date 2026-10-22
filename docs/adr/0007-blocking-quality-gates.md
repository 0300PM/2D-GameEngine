# 0007 — Bramy jakości jako blokujące komendy

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** dokumentacja i testy mają tendencję do rozjeżdżania się z kodem.

## Kontekst

Raport „do przeczytania kiedyś” nie zatrzymuje regresji. Liczby w dokumentacji starzeją się w tygodniach, a progi
rozmiaru i licencji działają tylko wtedy, gdy ktoś je uruchomi.

## Decyzja

Każde twierdzenie ma za sobą komendę, która kończy się kodem wyjścia różnym od zera:

| Twierdzenie | Komenda |
|-------------|---------|
| Typy i styl są poprawne | `npm run typecheck`, `npm run lint` |
| Kod działa i nie regresuje | `npm run test:unit` |
| Wydajność nie spadła | `npm run bench:check` |
| Rozmiar się nie rozjechał | `npm run bundle:check` |
| Licencje są czyste | `npm run audit:licenses:check` |
| Gra startuje i działa | `npm run test:scenarios`, `npm run test:matrix`, `npm run test:compat` |
| Hosting i CSP są poprawne | `npm run test:hosting` |
| Wersje, changelog i ADR są spójne | `node scripts/release.mjs --check` |
| Publiczne API się nie zmieniło | `npm run test:unit` (`ApiSnapshot`) |

`npm run verify` uruchamia wszystko lokalnie; CI ma te same komendy w dwóch jobach.

## Konsekwencje

- Regresja blokuje merge, zamiast czekać na czyjś przegląd.
- Liczby w dokumentacji są przepisywane z wyników tych komend, nie z pamięci.
- Koszt: pełna brama trwa kilka minut i wymaga przeglądarek w CI; `--json=1` pozwala wciągnąć wyniki do artefaktów
  wydania.
- Koszt: próg tolerancji (np. 40% w benchmarkach) trzeba czasem podnieść — wtedy zmienia się **jeden** plik
  (`benchmarks/baseline.json`), a nie rozsiane asercje.

## Odrzucone alternatywy

- **Tylko przegląd kodu** — nie wychwytuje regresji wydajności ani rozmiaru.
- **Bramy wyłącznie w CI** — deweloper dowiaduje się o problemie po pushu; `verify` daje ten sam wynik lokalnie.
