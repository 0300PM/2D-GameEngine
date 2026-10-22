# Native Core — C++23 / WASM

Moduł opcjonalny. Kompilacja do WebAssembly przez Emscripten.

## Kompilacja natywna (test)

```bash
cmake -S . -B build
cmake --build build
ctest --test-dir build
```

## Kompilacja WASM

```bash
emcmake cmake -S . -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm
```

Wynik: `build-wasm/core.wasm` + `core.js` (loader).

Granica JS/WASM: `WasmBridge` w `packages/wasm-bridge`.
Przekazuj większe porcje danych, minimalizuj liczbę wywołań przez granicę.

## Potencjalne zadania WASM (MVP poza zakresem obowiązkowym)

- A* pathfinding na dużej siatce
- Generowanie proceduralne mapy
- Symulacja cząstek

Dodaj moduł tylko po wykazaniu korzyści vs TS.
