# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions are bumped in lockstep across every package
in `packages/*` — see [docs/adr/0007-lockstep-versions.md](docs/adr/0007-lockstep-versions.md).

Sections are always present, even when empty, so tooling and humans look in the same place: `Added`, `Changed`,
`Deprecated`, `Removed`, `Fixed`, `Security`. Entries are grouped by area and reference the documentation page that
describes the behaviour, not the file that implements it.

## [Unreleased]

### Added

- `engine.getStabilityReport()` and the `FEATURE_STATUS` registry: every feature carries a channel
  (`stable`, `experimental`, `internal`), a `since` version and a note; `isStable()` and `isExperimental()` answer
  the question in code instead of in prose. Documented on `#releases`.
- `registerDeprecation()`, `deprecate()`, `formatDeprecation()`, `deprecationReport()` plus
  `engine.warnDeprecated(id)`, which emits one log entry per deprecated id per session instead of one per frame.
- `scripts/versions.mjs` (`--check`, `--set=`, `--bump=`): lockstep version enforcement for the whole monorepo,
  including the `ENGINE_VERSION` constant and internal `@browser2d/*` dependency ranges.
- `scripts/release.mjs` (`--check`, `--dry-run`, `--artifacts`): release gate and artifact builder — test results,
  benchmark results, bundle report, API snapshot, checksums and generated release notes in one directory.
- `scripts/migrate.mjs`: command-line migration for project files and player saves (`--kind=project|save`,
  `--from=`, `--out=`, `--check`).
- `docs/RELEASE_NOTES_TEMPLATE.md`, `docs/TECH_DEBT.md`, `docs/adr/` with an index and eight decision records.
- Documentation pages `#releases` (channels, release procedure, artifacts) and `#debt` (technical debt and ADRs),
  both in Polish and English.

### Changed

- `package.json` of every workspace package now carries an explicit `version`, `private` flag, `exports` map and a
  pinned internal dependency, so `npm ci` can install the monorepo from the lockfile alone. `npm ci` failed before
  this change: the lockfile had no entries for `@browser2d/phaser-adapter`, `@browser2d/project-format` and
  `@browser2d/wasm-bridge`.
- The licence audit counts 308 packages after adding the workspace manifests (was 305); the CI gate and all
  documentation numbers were updated rather than loosened.

### Deprecated

- `scene.createSprite(asset, options)` → `scene.spawn("sprite", options)`, removed in 0.3.0.
- `engine.getDiagnostics().toJSON()` → `engine.getDiagnosticsReport()`, removed in 0.3.0.

Both are registered at start-up, so `engine.getDeprecations()` lists them without any application code.

### Removed

- Nothing.

### Fixed

- `npm ci` on a clean checkout: the three package manifests that existed only as source folders are now real
  workspace packages with versions.
- Documentation search treated `kompatybilnosc` and `kompatybilność` as different terms; queries are now
  diacritic-insensitive (`ł` included).

### Security

- No security fixes in this cycle. The policy for reporting vulnerabilities is documented on `#policy`.

## [0.1.0] - 2026-10-22

First public milestone: the whole MVP plus the extensions that were validated along the way. The engine is at
`API_LEVEL 1` and `API_STABILITY experimental` — 0.x carries no stability promise yet, and breaking changes land in a
minor until 1.0.0.

### Added

- **Engine core** — `createEngine()` with validated options, `start`/`stop`/`destroy`, scene registration and
  switching, and one Phaser `game` instance per engine (`#config`, `#lifecycle`).
- **Time** — `deltaTime` in seconds with `maxDeltaTime` clamping, `timeScale`, pause/resume, optional fixed step
  (`fixedStep: { hz, maxSteps }`, `Scene.fixedUpdate`, `fixedAlpha`), timers and intervals with cancellation, a seeded
  `Random`, and documented determinism limits (`#time`, `#determinism`).
- **Scenes** — `preload`/`create`/`update`/`shutdown`, scene data passing, restart, transitions, loading screen,
  and teardown that stops owned tweens, sounds and timers (`#scenes`).
- **Objects** — `GameObject` with hierarchy, world transforms, tags, groups, queries, deferred destroy and
  component/system ordering (`#objects`, `#hierarchy`, `#components`).
- **Rendering** — sprites, text, rectangles and ellipses through a `RenderPort`; the engine never talks to Phaser
  directly (`#render`, `#ports`).
- **Input** — action mapping over `KeyboardEvent.code`, pointer state, screen-to-world conversion, per-action
  key remapping with conflict detection (`#input`).
- **Physics** — Arcade colliders, overlaps, sensors, layers and masks, contact events, raycasts and area queries
  behind `PhysicsPort` (`#physics`).
- **Camera** — follow with smoothing, world bounds, zoom, shake/fade/flash (`#camera`).
- **Assets** — manifest with stable ids, licences and checksums, pipeline with statuses, cancellation, retry,
  refcounted holds, GC, size report and diagnostics (`#assets`).
- **Audio** — four channels, effective volume, mute, autoplay queue flushed by `unlock()`, per-scene ownership
  (`#audio`).
- **Animation** — 28 easings, property tweens, sequences, repeat/yoyo, frame animations, camera effects (`#animation`).
- **Project format** — versioned JSON (`formatVersion: 2`) with a v1 migration chain, reference validation,
  unknown-field preservation, checksummed envelope and atomic repository writes (`#json`).
- **Saves** — player progress separated from the project, checksums, corruption detection, adapters for memory,
  localStorage, IndexedDB, file system, HTTP and SQL (PostgreSQL and MySQL) (`#saves`, `#sql`).
- **Events** — typed event bus with error isolation and namespace support (`#events`).
- **Debugging** — fps overlay, log panel with filters, debug views (colliders, grid, axes, camera bounds) with
  per-adapter support detection, profiler markers, diagnostics report and export (`#debug`).
- **Plugins** — manifest with semver ranges, four extension points, dependency ordering, cycle detection, error
  budgets, namespaced events and storage (`#plugins`).
- **C++23 / WebAssembly** — optional bridge that never sits on the critical path, with a TypeScript fallback
  (`#wasm`, experimental).
- **Reference game** — a playable top-down game with HUD, menu, sound, save/restore and restart (`#example`).
- **Build and deployment** — separate dev/prod Vite configs, relative base path, `release.json` manifest, size
  budget with CI thresholds, self-contained export with seven hosting configs and a CSP hash, startup error screen
  with environment diagnostics (`#deploy`).
- **Quality** — 508 unit and integration tests, 17 benchmarks with a recorded baseline, three end-to-end suites
  (scenarios, device matrix, browser matrix), a licence audit gate and an API snapshot of 296 symbols
  (`#tests`, `#compat`).

### Changed

- Adapter isolation is enforced by ports; the public API does not re-export Phaser types except in
  `@browser2d/phaser-adapter`.
- The playground stores view state in the query string (`?example=…&lang=…`) instead of path routing.

### Deprecated

- Nothing at release time. The first deprecations arrive in `Unreleased`.

### Removed

- Nothing.

### Fixed

- Crystal pickup regression scenario counted objects by tag `crystal` while the scene tags them `collectible`; the
  scenario now asserts what the game actually does.
- Mute toggle and save-after-reload checks were timing-dependent and now poll for the state change.
- Startup error overlay was clipped at 220 px and hid the stack; it is scrollable and centred now.

### Security

- Strict CSP for exported builds: `script-src 'self' 'sha256-…'` with a hash computed from the inline boot script,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`.
- Imported project data is untrusted input: 14 limits, prototype-key rejection, reference validation, no `eval`
  anywhere on the startup path (`#policy`).

[Unreleased]: https://example.invalid/browser2d/compare/0.1.0...HEAD
[0.1.0]: https://example.invalid/browser2d/releases/tag/0.1.0
