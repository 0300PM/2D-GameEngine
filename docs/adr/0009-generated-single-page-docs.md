# 0009 — Dokumentacja jako generowana jedna strona

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** dokumentacja ma działać z `file://`, mieć wyszukiwarkę, PL/EN i kopiowanie kodu — bez sieci.

## Kontekst

Klasyczny generator (Docusaurus, VitePress) daje routing i wyszukiwarkę, ale wymaga serwera albo JavaScriptu
ładowanego modułami, a przy podglądzie plików kończy się pustą stroną. Dokumentacja ma też być dostarczalna jako
jeden załącznik.

## Decyzja

`scripts/build_docs.py` generuje `docs/index.html`: 45 sekcji w jednym dokumencie, przełączanie przez `#hash`,
wyszukiwarka po indeksie osadzonym w pliku (bez żądań sieciowych), PL/EN przez atrybuty `data-pl`/`data-en`, a
przyciski kopiowania doklejane do każdego bloku kodu w generatorze.

## Konsekwencje

- Cała dokumentacja to jeden plik (~713 kB, 203 kB gzip) — działa bez serwera, offline i w podglądzie.
- Wyszukiwarka jest lokalna i natychmiastowa; normalizacja diakrytyków sprawia, że `kompatybilnosc` znajduje
  `kompatybilność`.
- Koszt: PL i EN są pisane równolegle w tym samym pliku źródłowym; przy 45 stronach to realny koszt autorstwa
  (pozycja D-009 w rejestrze długu).
- Koszt: brak routingu per strona i brak generowanego spisu treści z front-matter; nawigacja jest liczona z listy
  stron w generatorze.
- Test spójności: liczba bloków kodu równa liczbie przycisków kopiowania (164/164) jest sprawdzana przed
  publikacją.

## Odrzucone alternatywy

- **VitePress/Docusaurus** — wymaga serwera i sieci; nie przechodzi wymagania „otwórz plik”.
- **Markdown bez generowania** — brak i18n, wyszukiwarki i kopiowania bez dodatkowego JavaScriptu.
