# WASM Guide — C++23 + Emscripten

## PL

MVP nie wymaga WASM. Most jest przygotowany; dodaj moduł tylko po benchmarku TS vs WASM.

### Granica TS↔WASM — zasady

- Jedno wywołanie z dużą paczką danych > wiele drobnych wywołań.
- Nie ujawniaj wewnętrznych klas C++ — cienka fasada `extern "C"` lub `embind`.
- `WasmBridge` łagodzi błąd pobrania: `required:false` (domyślnie) nie wywala gry.

### Emscripten — instalacja

```bash
git clone https://github.com/emscripten-core/emsdk.git
./emsdk/emsdk install latest
./emsdk/emsdk activate latest
source ./emsdk/emsdk_env.sh
```

### Kompilacja

```bash
emcmake cmake -S native/core -B native/core/build-wasm
cmake --build native/core/build-wasm
ls native/core/build-wasm/*.wasm
```

Kopiuj do `apps/playground/public/wasm/`:

```bash
cp native/core/build-wasm/core.* apps/playground/public/wasm/
```

### Granica C++ — przykład pathfindingu

TS przekazuje płaską tablicę `blocked` (Uint8Array). C++ zwraca wektor pozycji.

```ts
const grid = { width: 64, height: 64, blocked: new Uint8Array(4096) };
const path = wasm.call<Vec2i[]>("findPathAStar", grid, {x:0,y:0}, {x:63,y:63});
```

Testuj algorytm natywnie i w przeglądarce — `native/core/tests`.

---

## EN

WASM is optional. Add it only with measured benefit.

- Batch data, minimize crossings.
- Thin facade, hide C++ internals.
- `WasmBridge` fails gracefully.

See PL above for build commands.
