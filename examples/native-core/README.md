# Native core — C++23 reference

A standalone example that drives the C++ core directly, without the browser: the same
headers the engine compiles to WebAssembly are linked into a small host program.

```
native/core/include/b2d/core/   time, random, world, scene, component schedule, loop
native/core/bench/              throughput harness
```

## Build

```bash
cmake -S native/core -B build-native -DCMAKE_BUILD_TYPE=Release
cmake --build build-native --target test_core test_scene bench_core
ctest --test-dir build-native --output-on-failure
./build-native/bench_core
```

## Run

```bash
node examples/native-core/run.mjs
```

The script builds the host binary if it is missing, runs the deterministic scenario and
prints one JSON line, so CI can diff it:

```json
{"format":"b2d-native-example","scene":"native-core","frames":600,"fixedSteps":600,"objects":2048,"elapsed":10.0,"digest":"1f0c4a9b"}
```

## Contract

| Piece | Header | What the example exercises |
|-------|--------|----------------------------|
| Fixed step loop | `b2d/core/engine_loop.hpp` | 600 frames at 60 Hz, accumulated game time |
| Deterministic RNG | `b2d/core/random.hpp` | seeded stream, digest is stable across runs |
| Hierarchy | `b2d/core/world.hpp` | 2 048 objects, parent/child transforms, activation |
| Component order | `b2d/core/scene.hpp` | input → behavior → physics → animation → render |
| Scene manager | `b2d/core/scene.hpp` | register, start, stop and clear a scene |

The digest is an FNV-1a hash of the sampled world positions, so any change in the maths,
the RNG or the scheduler shows up as a different number instead of a silent drift.

Documentation for the engine itself lives at <https://docs.krecik.tech/game-engine>.
