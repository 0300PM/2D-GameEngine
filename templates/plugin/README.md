# Plugin template

1. Copy this directory and rename `id` in `src/index.ts` (lowercase kebab-case, unique).
2. Set `engine` to the engine range you support, for example `^0.1.0`.
3. Add only the permissions you really use: `systems`, `importers`, `panels`, `events`, `scenes`, `assets`, `storage`.
4. Install it with `createEngine({ parent, plugins: [createPlugin()] })` or `engine.installPlugin(...)`.

## Ground rules

- The manifest is a declaration, not a sandbox: the code runs in the page realm.
  Only install plugins you trust; use an iframe or worker for untrusted code.
- Never touch `window` globals the engine owns (`window.engine`, `window.b2d`).
- Register everything through the context so `deactivate()` can clean it up, and return
  cleanup functions from `panel.mount` / use `onDispose`.
- A system that throws is disabled after three failures; keep one system per concern.

See `docs/index.html#plugins` for the full contract.
