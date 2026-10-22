# Dług techniczny

Rejestr świadomie odłożonych decyzji i znanych słabości. Każda pozycja ma identyfikator, obszar, wagę, realny
wpływ na użytkownika i **warunek spłaty** — czyli moment, w którym pozycja przestaje być długiem i staje się
zadaniem. Numerów nie zmieniamy i nie usuwamy: zamkniętą pozycję przenosimy do sekcji „Spłacone” z datą, żeby
dało się prześledzić historię.

Waga: **S1** blokuje wydanie lub bezpieczeństwo, **S2** kosztuje użytkownika pracę, **S3** spowalnia rozwój,
**S4** kosmetyka i porządki.

## Otwarte

| ID | Waga | Obszar | Problem | Wpływ | Warunek spłaty |
|----|------|--------|---------|-------|----------------|
| D-001 | S2 | monorepo | `packages/*` nie są budowane do `dist` — `main` wskazuje `src/index.ts`, a importy wewnętrzne idą ścieżką względną (`../../engine/src/...`). Działa w tym repozytorium, nie zadziała po `npm publish`. | Zewnętrzny konsument nie może zainstalować pakietów z rejestru; publikacja wymaga kroku budowania deklaracji. | Pierwsze wydanie poza monorepo: `tsup`/`tsc -b` per pakiet + `exports` na `dist/*.js` i `dist/*.d.ts`. |
| D-002 | S2 | build | Cały silnik i Phaser to jeden chunk (~1,62 MB, 384 kB gzip). | Wolny pierwszy start na słabym łączu; brak korzyści z cache przy zmianie jednej sceny. | Podział na `vendor` (Phaser) i `app` + `manualChunks`, gdy pojawi się drugi wpis albo gdy gzip przekroczy 500 kB. |
| D-003 | S2 | fizyka | Tylko Arcade: brak obrotów, brak realistycznych kontaktów, brak ciągłych zderzeń (CCD). | Gry z obracającymi się ciałami wymagają własnej warstwy. | Konkretna gra tego potrzebuje **i** `PhysicsPort` nie wystarcza — wtedy adapter Planck/matter, nie ręczna fizyka. |
| D-004 | S2 | tilemapy | `Tilemap` wczytuje całą mapę naraz; brak chunków i odciążania. | Duże mapy (10k+ kafelków) kosztują pamięć i czas startu. | Mapa > 4 000 kafelków w realnym projekcie **lub** pomiar pokazujący > 100 ms na `createMap`. |
| D-005 | S2 | dostępność | Treść canvasu nie trafia do drzewa dostępności. | Czytniki ekranu nie widzą gry; wymagany lustrzany HUD w DOM. | Zawsze — to cecha platformy; spłata = biblioteka `a11y` z generowanym HUD-em i opisami stanu. |
| D-006 | S3 | CI | WebKit/Safari nie jest uruchamiany w automacie tego środowiska (brak `libicu66` dla binarki Playwright). | Safari pokrywane ręcznie; regresję wyłapie użytkownik, nie CI. | Runner z bibliotekami WebKit (macOS w CI) albo oficjalny obraz Playwright z WebKit. |
| D-007 | S3 | narzędzia wydania | `scripts/release.mjs` liczy kanały stabilności i symbole API parsując źródła regexem, a nie importując moduły TS. | Nowy format zapisu w `stability.ts` cicho zepsuje licznik w artefaktach. | Przejście na `vite-node`/`tsx` w skryptach wydania; do tego czasu liczby pilnuje `tests/unit/Stability.test.ts`. |
| D-008 | S3 | testy | Brak progów pokrycia kodu; jakość pilnują liczby testów i scenariusze e2e. | Nowy moduł może wejść bez testów i nikt tego nie zauważy. | `vitest --coverage` z progiem globalnym 70% i raportem w artefaktach wydania. |
| D-009 | S3 | dokumentacja | Strona docs to jeden plik ~713 kB (203 kB gzip) z 45 sekcjami; PL i EN są pisane równolegle w `build_docs.py`. | Koszt autorstwa: każda zmiana to dwa teksty; ładowanie rośnie z każdą stroną. | Podział na pliki per strona + generator z front-matter; tłumaczenia jako osobne pliki źródeł. |
| D-010 | S3 | pluginy | Manifest nie izoluje kodu — plugin działa w tym samym realmie. | Instalacja obcego pluginu to pełne zaufanie do jego kodu. | Katalog pluginów (odłożony) wymaga `iframe`/`Worker` z mostkiem i limitem uprawnień. |
| D-011 | S3 | save serwer | `tools/save-server` nie jest spakowany ani wersjonowany razem z pakietami. | Samodzielny backend wymaga ręcznego kopiowania z repozytorium. | Publikacja obrazu Docker albo pakietu `@browser2d/save-server` po stabilizacji API. |
| D-012 | S4 | zależności | ESLint 8 jest po końcu wsparcia; Phaser przypięty do `3.80.1`. | Brak poprawek bezpieczeństwa w linterze; brak nowszych funkcji Phasera. | Migracja do ESLint 9 (flat config) przy okazji najbliższego bumpa major; Phaser aktualizowany po przejściu e2e na nowej wersji. |
| D-013 | S4 | WASM | Most WASM jest eksperymentalny i nie ma pełnego pokrycia testami e2e (brak zbudowanego modułu w CI). | Funkcja „opcjonalna” faktycznie bywa nieprzetestowana po zmianie. | Moduł WASM w artefaktach CI + scenariusz porównujący wynik TS i WASM na tych samych danych. |
| D-014 | S4 | playground | Stan widoku w query stringu: brak deep-linków do sceny z parametrami (np. poziomu). | Nie da się podzielić linkiem konkretnego stanu gry. | Potrzeba produktowa: udostępnianie scenariuszy testowych linkiem. |

## Spłacone

| ID | Data | Co się zmieniło |
|----|------|-----------------|
| D-015 | 2026-10-22 | `npm ci` nie działał na czystym klonie — trzy katalogi pakietów nie miały `package.json`. Dodano manifesty, wersje i przypięte zależności wewnętrzne; pilnuje tego `scripts/versions.mjs --check` i `tests/unit/WorkspaceVersions.test.ts`. |
| D-016 | 2026-10-22 | Wyszukiwarka w dokumentacji rozróżniała `kompatybilnosc` i `kompatybilność`. Dodano normalizację diakrytyków (łącznie z `ł`). |
| D-017 | 2026-10-22 | Scenariusz regresyjny liczył kryształy po tagu `crystal`, a scena nadaje `collectible` — test sprawdzał coś innego niż gra robi. Poprawiony tag i asercje. |
| D-018 | 2026-10-22 | Ekran błędu startowego obcinał stos wywołań (limit 220 px). Wysokość podniesiona, treść przewijalna. |

## Zasady

1. **Dług bez warunku spłaty nie jest długiem, tylko życzeniem.** Każda pozycja ma zdanie „spłata, gdy…”, które da
   się sprawdzić (liczba, pomiar, zdarzenie produktowe).
2. **Waga S1 blokuje wydanie.** `node scripts/release.mjs --check` czyta tabelę „Otwarte” i kończy się błędem,
   dopóki jest w niej choć jedna pozycja S1. Spłata albo obniżenie wagi to jedyne wyjścia.
3. **Nowy dług dopisujemy w tym samym commicie, w którym powstaje.** Nie „przy okazji refaktoru”.
4. **Spłata przenosi wiersz do „Spłacone” z datą**, nie kasuje go — historia jest częścią dokumentacji.
