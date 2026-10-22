# 0002 — Wersjonowany format JSON z łańcuchem migracji

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** projekt gry jest danymi użytkownika — musi przetrwać aktualizację silnika.

## Kontekst

Format projektu ewoluuje razem z silnikiem. Bez wersji każda zmiana schematu to cicha migracja „w locie”, która
psuje starsze pliki albo — gorzej — wczytuje je częściowo. Użytkownik traci pracę i nie wie dlaczego.

## Decyzja

Każdy projekt ma pole `formatVersion` (obecnie `2`). Odczyt idzie przez `importProject()`, które:

1. odrzuca wersję nowszą niż wspierana, z numerem wersji w komunikacie;
2. dla starszych wersji uruchamia łańcuch migracji krok po kroku (`v1 → v2`), a wynik waliduje ponownie;
3. brak ścieżki migracji to błąd `formatVersion`, nie próba „odczytu na siłę”;
4. zachowuje nieznane pola i zgłasza je jako `unknown-field`, zamiast je wycinać;
5. liczy sumę kontrolną FNV-1a po kanonicznym JSON-ie (klucze sortowane) i wykrywa uszkodzenie koperty.

`importProject()` nigdy nie rzuca wyjątkiem i nigdy nie zwraca częściowo zbudowanego projektu — wynik ma zawsze
kształt `{ ok, errors, warnings }`.

## Konsekwencje

- Dane użytkownika albo się wczytują w całości, albo dostają czytelny błąd ze ścieżką pola.
- Migracje są czystymi funkcjami na obiekcie — testowalne bez DOM-u (`ProjectMigration.test.ts`).
- Narzędzie `node scripts/migrate.mjs` pozwala zmigrować pliki poza aplikacją.
- Koszt: każda zmiana schematu wymaga nowego kroku migracji i testu; nie ma skrótu „to tylko nowe pole opcjonalne”
  bez aktualizacji `formatVersion`, jeśli zmiana wpływa na interpretację danych.
- Suma kontrolna nie jest podpisem — kto chce oszukać, przeliczy ją. Ochrona przed celową edycją wymaga serwera.

## Odrzucone alternatywy

- **Schemat bez wersji, migracja po heurystykach** — działa do pierwszej sprzeczności i nie da się przetestować.
- **Migracja po stronie serwera** — odbiera możliwość pracy offline i lokalnego edytora.
- **Protobuf / MessagePack** — mniejszy plik, ale traci czytelność i „otwórz w edytorze”, które dla danych projektu
  są ważniejsze niż kilobajty.
