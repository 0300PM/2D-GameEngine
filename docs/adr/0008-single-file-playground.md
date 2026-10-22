# 0008 — Playground jako jeden klasyczny plik HTML

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** odbiorca otwiera plik w podglądzie plików w piaskownicy, bez serwera i bez sieci.

## Kontekst

Build Vite to HTML + moduły ES + katalog `assets/`. Moduły wymagają serwera (albo `file://` z flagą), a piaskownica
podglądu blokuje `blob:` i zewnętrzne żądania. Efekt: „czarny ekran” i wina po stronie silnika, choć kod jest
poprawny.

## Decyzja

`npm run build:single` produkuje `playground.html`: jeden klasyczny `<script>` (bez `type="module"`), zero importów,
zero `blob:`, tekstury jako `data:image/png;base64`, metadane builda wstrzyknięte jako `<meta>`. Plik startuje z
`file://`, offline i w sandboxowanym podglądzie.

## Konsekwencje

- Jeden plik 1,6 MB (brak cache między wersjami, brak dzielenia na chunki) — świadomy koszt przenośności.
- Klasyczny skrypt nie wymaga pozwolenia CSP na `blob:`, więc podgląd nie potrzebuje łagodniejszej polityki.
- Wersja serwerowa (`dist/`) pozostaje domyślną ścieżką produkcyjną; single-file jest dla podglądu i dystrybucji
  „jednym plikiem”.
- Test `single-check` w zestawie scenariuszy pilnuje, że plik nadal startuje bez błędów w konsoli.

## Odrzucone alternatywy

- **`type="module"` w single-file** — wymaga serwera lub `--allow-file-access-from-files`; nie działa w podglądzie.
- **Inline przez `blob:`** — blokowane przez CSP piaskownicy.
- **`importmaps` + zewnętrzne pliki** — to znowu wiele plików, czyli powrót do problemu.
