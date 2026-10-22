# 0005 — Brak SPA fallback: stan w query stringu

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** gra jest jednym dokumentem, wdrażanym także w podkatalogu i z `file://`.

## Kontekst

Najczęstszy przepis na „działa po odświeżeniu” to reguła `try_files … /index.html`. Przy `base: "./"` każdy adres
poza katalogiem głównym serwuje ten sam HTML, którego względne `./assets/…` wskazują na nieistniejący katalog.
Efekt: czarny ekran, który wygląda jak błąd silnika.

## Decyzja

Brak routingu po ścieżkach. Stan widoku żyje w query stringu (`?example=menu&lang=en`), nieznane adresy kończą się
`404.html`, a `index.html` ma `Cache-Control: no-cache`. Serwer statyczny (`scripts/hosting-server.mjs`) ma
`fallback: "404"` jako domyślne ustawienie.

## Konsekwencje

- Odświeżenie wraca do tego samego przykładu i języka, także w podkatalogu i z `file://`.
- `404.html` jest dwujęzyczna i linkuje względnie (`./`), więc działa pod dowolnym mountem.
- Koszt: brak ładnych adresów typu `/examples/menu`; deep-linki ograniczają się do parametrów.
- Obejście dla hostingu wymagającego SPA: `--fallback=index` jest dostępne, ale udokumentowane jako świadome
  ryzyko, nie domyślna konfiguracja.

## Odrzucone alternatywy

- **Router historyczny** — wymaga przepisywania adresów i psuje ścieżki względne.
- **`base: "/"` na sztywno** — wyklucza publikację w podkatalogu, która jest realnym scenariuszem (`B2D_BASE`).
