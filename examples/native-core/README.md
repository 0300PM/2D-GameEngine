# Native core — C++23 reference

Samodzielny przykład, który steruje rdzeniem C++ bez przeglądarki: te same nagłówki, z których
powstaje moduł WebAssembly, są linkowane do małego programu-host.

```
native/core/include/b2d/core/   time, random, world, scene, harmonogram komponentów, loop
native/core/bench/              harness przepustowości (bench_core)
examples/native-core/native/    dwa hosty: b2d_native_example i b2d_native_example_async
```

## Dwa hosty

| Target                     | Scena               | Co robi                                                                               |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `b2d_native_example`       | `native-core`       | 2 048 obiektów, 600 klatek po 60 Hz, hierarchia, komponenty, 4 096 losowań            |
| `b2d_native_example_async` | `native-core-async` | 256 obiektów, 120 klatek, inne ziarno i inne parametry — drugi, niezależny scenariusz |

Oba wypisują **jedną linię JSON** na stdout, więc CI i testy mogą porównać wynik bez parsowania logów.

## Build

```bash
# Linux / macOS
cmake -S native/core -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native --config Release
ctest --test-dir build-native --output-on-failure -C Release

# Windows (generator Visual Studio wymaga architektury)
cmake -S native/core -B build-native -A x64
cmake --build build-native --config Release
ctest --test-dir build-native -C Release --output-on-failure
```

Binarki trafiają do `build-native/` na Linuksie/macOS i do `build-native/Release/` na Windows.
Skrypty npm rozwiązują ścieżkę przez `config/native.ts`, więc nie trzeba jej znać.

Targety można wyłączyć opcjami CMake: `-DB2D_CORE_BUILD_TESTS=OFF`,
`-DB2D_CORE_BUILD_BENCH=OFF`, `-DB2D_CORE_BUILD_EXAMPLES=OFF` (tak robi build WASM).

## Run

```bash
npm run native:example    # buduje hosty, jeśli trzeba, i weryfikuje raport z fixture
npm run examples:native   # to samo bez testów TS — krok CI w jobie native
```

`node examples/native-core/run.mjs` robi dokładnie to: buduje brakujące binarki, uruchamia oba hosty
i porównuje pola z `examples/native-core/expected.json`.

Przykładowy raport:

```json
{
  "format": "b2d-native-example",
  "scene": "native-core",
  "frames": 600,
  "fixedSteps": 600,
  "objects": 2048,
  "components": 2048,
  "elapsed": 10.0,
  "digest": "1f0c4a9b"
}
```

## Kontrakt

| Element               | Nagłówek                   | Co sprawdza przykład                                          |
| --------------------- | -------------------------- | ------------------------------------------------------------- |
| Fixed step loop       | `b2d/core/engine_loop.hpp` | 600 klatek po 60 Hz, akumulacja czasu gry                     |
| Deterministyczny RNG  | `b2d/core/random.hpp`      | ziarno, stały strumień, digest stabilny między uruchomieniami |
| Hierarchia            | `b2d/core/world.hpp`       | 2 048 obiektów, transformacje świata, aktywacja               |
| Kolejność komponentów | `b2d/core/scene.hpp`       | fazy input → behavior → physics → animation → render          |
| SceneManager          | `b2d/core/scene.hpp`       | rejestracja, start/stop i czyszczenie sceny                   |

Digest to FNV-1a z próbek pozycji świata i wartości RNG, więc każda zmiana w matematyce,
RNG albo harmonogramie zmienia liczbę zamiast cicho dryfować.

## Fixture

`expected.json` przechowuje pola `frames`, `fixedSteps`, `objects`, `components` i `digest` dla
obu hostów. Po świadomej zmianie zachowania rdzenia odśwież ją:

```bash
npm run examples:baseline
```

Testy `examples/native-core/tests/host.test.ts` sprawdzają sam parser raportu zawsze, a uruchomienie
hostów — gdy `B2D_NATIVE_BUILD=1` i w systemie jest `cmake`.

Dokumentacja silnika: <https://docs.krecik.tech/game-engine>
