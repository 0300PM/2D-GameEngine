# Architecture Decision Records

Każda decyzja, której cofnięcie kosztowałoby więcej niż tydzień pracy, ma tu swój rekord. Format jest stały:
**Kontekst → Decyzja → Konsekwencje → Odrzucone alternatywy**. Status `przyjęta` oznacza, że kod i dokumentacja
są z nią zgodne; `zastąpiona` wskazuje następcę.

| Nr | Decyzja | Status |
|----|---------|--------|
| [0001](0001-adapter-isolation-ports.md) | Izolacja adaptera przez porty | przyjęta |
| [0002](0002-versioned-json-project-format.md) | Wersjonowany format JSON z łańcuchem migracji | przyjęta |
| [0003](0003-no-ecs.md) | Brak ECS — prototyp oceniony i odrzucony | przyjęta |
| [0004](0004-wasm-optional.md) | WASM opcjonalny, tylko przy mierzalnej przewadze | przyjęta |
| [0005](0005-no-spa-fallback.md) | Brak SPA fallback — stan w query stringu | przyjęta |
| [0006](0006-lockstep-versions.md) | Jedna wersja dla wszystkich pakietów | przyjęta |
| [0007](0007-blocking-quality-gates.md) | Bramy jakości jako blokujące komendy | przyjęta |
| [0008](0008-single-file-playground.md) | Playground jako jeden klasyczny plik HTML | przyjęta |
| [0009](0009-generated-single-page-docs.md) | Dokumentacja jako generowana jedna strona | przyjęta |

## Jak dodać rekord

1. Numer kolejny, czterocyfrowy, plik `NNNN-krotki-opis.md`.
2. Wpis w tabeli powyżej — `scripts/release.mjs --check` zgłasza rekord bez wpisu.
3. Sekcje: Kontekst, Decyzja, Konsekwencje (także koszty), Odrzucone alternatywy.
4. Zmiana decyzji = nowy rekord ze statusem `zastępuje 000N`, nie edycja historii.
