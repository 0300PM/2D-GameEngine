# Release notes — template

Use this template for every release. Copy it, fill in the placeholders, and keep the section order — the tooling and
the support process both assume it. `node scripts/release.mjs --artifacts` generates a draft with the measured
sections already filled in; the human part is `Highlights`, `Breaking changes` and `Migrations`.

```markdown
# Browser2DEngine {version} — {date}

{one sentence: what this release is about}

## Highlights

- {user-visible outcome, not an implementation detail}
- {second outcome}
- {third outcome}

## Breaking changes

{Write "None." when there are none — an empty section reads as an omission.}

| Change | Before | After | Action |
|--------|--------|-------|--------|
| {API or behaviour} | `{old}` | `{new}` | {one command or one edit} |

## Deprecations

| Deprecated | Replacement | Removed in |
|------------|-------------|------------|
| `{symbol}` | `{replacement}` | {version} |

## Migrations

- **Project format** {from} → {to}: `node scripts/migrate.mjs --kind=project --in=project.json --out=project.v{to}.json`
- **Player saves** {from} → {to}: applied automatically on load; a save from a newer build is rejected with
  `SaveCorruptionError` instead of being half-read.
- {anything a user must do by hand, with the exact command}

## Fixes

- {symptom → cause → what changed}

## Stability

| Channel | Features |
|---------|----------|
| stable | {count} — {list the ones that changed channel} |
| experimental | {count} — {list} |
| internal | {count} |

`API_LEVEL` {level} · `API_STABILITY` {stability}

## Quality gate

| Check | Result |
|-------|--------|
| Types and lint | {pass/fail} |
| Unit and integration tests | {passed}/{total} in {files} files |
| End-to-end scenarios | {passed}/{total} |
| Device matrix | {profiles} profiles |
| Browser matrix | {engines and results, including skipped ones with the reason} |
| Benchmarks vs baseline | {max deviation} %, tolerance {tolerance} % |
| Bundle size | {gzip} kB, {delta} % vs baseline |
| Licence audit | {packages} packages, {violations} violations |
| API snapshot | {symbols} symbols, {added} added, {removed} removed |

## Artifacts

| File | Size | SHA-256 |
|------|------|---------|
| `dist/{entry}.js` | {bytes} | {hash} |
| `playground.html` | {bytes} | {hash} |
| `artifacts/test-results.json` | {bytes} | {hash} |
| `artifacts/benchmarks.json` | {bytes} | {hash} |
| `CHECKSUMS.txt` | — | — |

## Known limitations

- {limitation with the workaround, or "see #compat"}

## Upgrade

```bash
npm install @browser2d/engine@{version}
node scripts/release.mjs --check
```
```

## Rules

1. **Numbers come from the artifacts, not from memory.** Every table row in `Quality gate` has a file behind it in
   `release/artifacts/{version}/`. If a number cannot be traced to a file, it does not go in the notes.
2. **No claim without a check.** A phrase such as "faster" needs the benchmark delta next to it, and a phrase such as
   "supported" needs the engine and version from the browser matrix.
3. **Skipped is not passed.** A browser or profile that did not run is listed as skipped with the reason.
4. **Breaking changes list the action, not just the fact.** A user must be able to fix their code from the table
   alone.
5. **Empty sections are written as "None."** Silent omissions look like oversights, and support cannot tell them
   apart from real gaps.
