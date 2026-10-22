# Session stats — example plugin

Minimal, complete Browser2DEngine plugin. It registers a system, a debug panel, an event
subscription and a namespaced storage key, which covers every extension point the host
offers today.

```ts
import { createEngine } from "@engine";
import { createSessionStatsPlugin } from "../../examples/plugins/session-stats/src";

const engine = createEngine({
  parent: "game",
  plugins: [createSessionStatsPlugin()]
});
```

The playground installs exactly this plugin, so the demo doubles as an integration test.

## Manifest

| Field | Value | Why |
|-------|-------|-----|
| `id` | `session-stats` | Lowercase kebab-case, unique per engine |
| `version` | `1.0.0` | Plugin version, checked against dependency ranges |
| `engine` | `^0.1.0` | Refuses to start on an incompatible engine |
| `permissions` | `systems`, `panels`, `events`, `storage` | Each capability is denied until declared |

## What it does

- `systems.register("sampler", …)` — ticks after the scene, samples time and frame count
- `panels.register({ … })` — renders a DOM panel inside the host container
- `events.on("game:collected", …)` — counts pickups and stores the best score
- `storage` — namespaced keys (`b2d:plugin:session-stats:best`), so plugins cannot collide
- `onDispose` — resets counters when the plugin is deactivated
