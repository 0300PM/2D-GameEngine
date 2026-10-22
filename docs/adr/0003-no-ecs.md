# 0003 — Brak ECS: prototyp oceniony i odrzucony

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** wymaganie mówiło „oceń ECS na prototypie”, nie „wdroż ECS”.

## Kontekst

Scena z tysiącami jednorodnych obiektów to klasyczny argument za ECS. Repozytorium ma już hierarchię obiektów,
komponenty z kolejnością systemów i zapytania po tagach — czyli 80% tego, po co ludzie sięgają po ECS.

## Decyzja

ECS **nie** wchodzi do publicznego API. Powstał prototyp i benchmark (`scripts/bench-ecs.mjs`,
`benchmarks/cases.ts`), porównujący aktualny model obiektowy z układem SoA dla 10 000 encji. Wniosek: przy
istniejącej hierarchii i hookach per obiekt ECS wygrywa dopiero w scenariuszach czysto danych (cząstki, boidy), a
przepisanie całego modelu kosztowałoby kompatybilność formatu projektu i wszystkich testów scen.

## Konsekwencje

- `GameObject`, `Component`, `Scene` i format projektu pozostały bez zmian; eksperyment nie zostawił
  połowicznej abstrakcji.
- Warunki powrotu są wypisane na stronie `#ecs` w dokumentacji — m.in. scena > 20 000 jednorodnych obiektów albo
  dyspozycja komponentów > 20% klatki w profilerze.
- Koszt: brak korzyści cache-locality dla symulacji cząstek; jeśli taka symulacja się pojawi, ECS wejdzie jako
  **dodatkowy** system obok obiektów, nie zamiast nich.

## Odrzucone alternatywy

- **Wdrożenie hybrydowe od razu** — dwa modele równolegle bez realnego przypadku użycia to dług bez spłaty.
- **Biblioteka ECS z npm** — dodaje zależność i własny model cyklu życia, którego nie da się pogodzić z `Scene`.
