# Telemetry panel — example plugin

Reports which core the engine is running on (`cpp` once the WebAssembly module is attached,
`typescript` otherwise), the ABI version and the measured loop throughput.

```ts
import { createEngine } from "@engine";
import { createTelemetryPanelPlugin } from "../examples/plugins/telemetry-panel/src";

const engine = createEngine({ parent: "game", plugins: [createTelemetryPanelPlugin()] });
```

The plugin only reads what the host already exposes: `systems` for the per-frame sampler,
`panels` for the DOM mount point and `events` for the `core:ready` announcement.
It writes no files, owns no storage key and tears its panel down through `onDispose`.

## Contract

| Extension point | Used for |
|-----------------|----------|
| `systems.register` | samples `deltaTime`, throttled to four repaints per second |
| `panels.register` | one DOM panel titled "Native telemetry" |
| `events.on` | `core:ready` payload `{ impl, abi }` |

## Tests

`tests/unit/Examples.test.ts` installs the plugin, emits `core:ready` and checks the panel
content, so a broken manifest or a missing permission fails the suite.
