# 0004 — WASM opcjonalny, tylko przy mierzalnej przewadze

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** specyfikacja wymagała opcjonalnego punktu integracji C++23/WASM.

## Kontekst

WASM kusi obietnicą wydajności, ale w grze 2D wąskim gardłem jest renderowanie i DOM, nie arytmetyka w TS. Most
WASM dokłada czas inicjalizacji modułu, kopiowanie pamięci i drugi język w repozytorium.

## Decyzja

`WasmBridge` istnieje jako warstwa opcjonalna (`required: false`), z fallbackiem czysto TypeScriptowym i stanami
`idle | loading | ready | failed | unavailable`. Nie leży na ścieżce krytycznej: brak modułu nigdy nie blokuje
startu. Funkcja jest oznaczona w rejestrze stabilności jako `experimental` (`stability.ts`).

## Konsekwencje

- Gra działa identycznie bez WASM; benchmark porównuje obie ścieżki na tych samych danych.
- Moduł zostaje w projekcie tylko wtedy, gdy wygrywa pomiar — inaczej jest usuwany, a nie „trzymany na wszelki
  wypadek”.
- Wątki i SIMD dopiero po benchmarku jednojęzykowym; `SharedArrayBuffer` wymaga HTTPS i nagłówków COOP/COEP, co
  zawęża hosting.
- Koszt: dodatkowy stan w diagnostyce i dokumentacji (`#wasm`), który trzeba utrzymywać.

## Odrzucone alternatywy

- **WASM jako domyślna ścieżka** — czas startu i rozmiar rosną, a zysk jest nieudowodniony.
- **Rust zamiast C++23** — lepsze narzędzia, ale wymaganie mówiło wprost o C++23.
