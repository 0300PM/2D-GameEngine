# Deterministyczność — przykład TypeScript

Przykład pokazuje, jak z rdzenia TypeScript wycisnąć powtarzalny wynik: stały krok czasu,
kolejność komponentów i digest, który zmienia się wyłącznie wtedy, gdy zmienia się zachowanie.

```
examples/determinism/src/digest.ts   RNG + fixed step + sortowanie faz → digest FNV-1a
examples/determinism/src/frames.ts   scena headless: obiekty, komponenty, 240 klatek
examples/determinism/src/harness.ts  minimalny SceneContext i RenderPort (bez DOM i Phasera)
examples/determinism/expected.json   wartości odniesienia (golden)
```

## Użycie

```ts
import { runDeterministicDigest, runFixedFrames } from "./src";

runDeterministicDigest({ objects: 256, frames: 120, seed: 1337 });
// → { impl: "typescript", objects: 256, frames: 120, digest: "a545b167" }

runFixedFrames({ objects: 512, frames: 240, seed: 424242 });
// → { objects: 512, frames: 240, componentUpdates: 122880, orderStable: true, digest: "50d0e49a" }
```

## Co mierzy

| Funkcja                  | Co robi                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `runDeterministicDigest` | losuje pozycje z `Random(seed)`, pędzi 120 kroków fixed step, miesza pozycje i kolejność faz |
| `runFixedFrames`         | tworzy scenę headless z 512 obiektami, dodaje `Mover` w każdej fazie i puszcza 240 klatek    |

Digest jest liczony z zaokrąglonych pozycji świata, skomponowanej macierzy transformacji,
liczności faz, liczby encji z tagami oraz liczby wywołań `onUpdate`. Dzięki temu zmiana
w sortowaniu komponentów, clampie `deltaTime` czy RNG natychmiast psuje golden value.

## Testy

```bash
npm run examples:check
```

- `tests/digest.test.ts` — powtarzalność dla tego samego ziarna, różnica przy innym ziarnie,
  skalowanie liczby obiektów, stabilność kolejności faz i przyrost aktualizacji komponentów.
- `tests/golden.test.ts` — porównanie z `expected.json`.

Po świadomej zmianie zachowania odśwież fixture:

```bash
npm run examples:baseline
```

Dokumentacja silnika: <https://docs.krecik.tech/game-engine>
