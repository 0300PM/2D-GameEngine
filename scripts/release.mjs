import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { checkVersions, readEngineVersionFile } from "./versions.mjs";

const ROOT = resolve(process.env.B2D_ROOT ?? process.cwd());
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback = null) => {
  const hit = args.find((argument) => argument.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const log = (message) => console.log(message);
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

const readStabilityCounts = () => {
  const source = readFileSync(join(ROOT, "packages/engine/src/stability.ts"), "utf8");
  const registry = source.split("export const FEATURE_STATUS")[1]?.split("});")[0] ?? "";
  const counts = { stable: 0, experimental: 0, internal: 0 };
  const pattern = /status\("[^"]+",\s*"(stable|experimental|internal)"/g;
  let match;
  while ((match = pattern.exec(registry))) counts[match[1]] += 1;
  return counts;
};

const readDeprecations = () => {
  const path = join(ROOT, "packages/engine/src/deprecation.ts");
  if (!existsSync(path)) return [];
  const source = readFileSync(path, "utf8");
  const entries = [];
  for (const block of source.split("registerDeprecation({").slice(1)) {
    const record = block.split("});")[0];
    const field = (name) => {
      const match = new RegExp(`${name}:\\s*(.+?),\\s*$`, "m").exec(record);
      if (!match) return null;
      return match[1].trim().replace(/^["']|["']$/g, "");
    };
    const id = field("id");
    if (!id) continue;
    const replacement = field("replacement");
    entries.push({
      id,
      replacement: replacement === "null" ? null : replacement,
      since: field("since"),
      removeIn: field("removeIn")
    });
  }
  return entries;
};

const readChangelogEntry = (version) => {
  const path = join(ROOT, "CHANGELOG.md");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const escaped = version.replace(/\./g, "\\.");
  const start = text.search(new RegExp(`^## \\[${escaped}\\]`, "m"));
  if (start === -1) return null;
  const rest = text.slice(start);
  const next = rest.slice(1).search(/^## \[/m);
  return next === -1 ? rest.trimEnd() : rest.slice(0, next + 1).trimEnd();
};

const runTests = (outFile) => {
  log("  testy: vitest run --reporter=json");
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, "node_modules/vitest/vitest.mjs"), "run", "--reporter=json", `--outputFile=${outFile}`],
      { cwd: ROOT, stdio: "pipe", encoding: "utf8" }
    );
  } catch (error) {
    if (!existsSync(outFile)) {
      throw new Error(`Testy nie zapisały raportu: ${String(error.message ?? error).slice(0, 300)}`);
    }
    log("  uwaga: testy zakończone niezerowym kodem — raport zapisany, sprawdź release.json");
  }
  return readJson(outFile);
};

const summariseTests = (report) => ({
  total: report.numTotalTests ?? 0,
  passed: report.numPassedTests ?? 0,
  failed: report.numFailedTests ?? 0,
  pending: report.numPendingTests ?? 0,
  files: report.testResults?.length ?? 0,
  durationMs: report.testResults?.reduce((sum, file) => sum + (file.endTime - file.startTime), 0) ?? 0,
  failures: (report.testResults ?? [])
    .flatMap((file) =>
      (file.assertionResults ?? [])
        .filter((assertion) => assertion.status === "failed")
        .map((assertion) => ({ file: relative(ROOT, file.name), test: assertion.fullName }))
    )
    .slice(0, 20)
});

const summariseBenchmarks = (latest, baseline) => {
  if (!latest) return null;
  const previous = new Map((baseline?.benchmarks ?? []).map((entry) => [`${entry.group}/${entry.name}`, entry]));
  const rows = (latest.benchmarks ?? []).map((entry) => {
    const before = previous.get(`${entry.group}/${entry.name}`);
    const delta = before && before.meanMs > 0 ? (entry.meanMs - before.meanMs) / before.meanMs : null;
    return {
      group: entry.group,
      name: entry.name,
      meanMs: Number(entry.meanMs.toFixed(4)),
      medianMs: Number(entry.medianMs.toFixed(4)),
      hz: Number(entry.hz.toFixed(1)),
      baselineMeanMs: before ? Number(before.meanMs.toFixed(4)) : null,
      delta: delta === null ? null : Number(delta.toFixed(4))
    };
  });
  const deltas = rows.map((row) => row.delta).filter((delta) => typeof delta === "number");
  return {
    environment: latest.environment ?? null,
    baselineRecordedAt: baseline?.environment?.recordedAt ?? null,
    cases: rows.length,
    worstRegression: deltas.length ? Math.max(...deltas) : null,
    medianDelta: deltas.length ? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : null,
    rows
  };
};

const buildArtifacts = async () => {
  const versions = checkVersions(ROOT);
  if (!versions.ok) {
    for (const problem of versions.problems) console.error(`  ${problem}`);
    fail("BŁĄD: wersje niespójne — popraw je przed budowaniem artefaktów.");
  }
  const version = versions.rootVersion;
  const outDir = resolve(ROOT, value("out", join("release/artifacts", version)));
  mkdirSync(outDir, { recursive: true });

  log(`Artefakty wydania ${version} → ${relative(ROOT, outDir)}`);

  const manifestPath = join(ROOT, "dist/release.json");
  if (!existsSync(manifestPath)) fail('Brak dist/release.json — uruchom "npm run build".');
  const manifest = readJson(manifestPath);

  const hasTests = existsSync(join(outDir, "test-results.json")) && flag("reuse-tests");
  let testSummary = null;
  if (!flag("skip-tests")) {
    const report = hasTests ? readJson(join(outDir, "test-results.json")) : runTests(join(outDir, "test-results.json"));
    testSummary = summariseTests(report);
    log(`  testy: ${testSummary.passed}/${testSummary.total} w ${testSummary.files} plikach, ${testSummary.failed} błędów`);
  }

  const latestBench = existsSync(join(ROOT, "benchmarks/latest.json")) ? readJson(join(ROOT, "benchmarks/latest.json")) : null;
  const baselineBench = existsSync(join(ROOT, "benchmarks/baseline.json")) ? readJson(join(ROOT, "benchmarks/baseline.json")) : null;
  const benchmarks = summariseBenchmarks(latestBench, baselineBench);
  if (benchmarks) {
    writeFileSync(join(outDir, "benchmarks.json"), `${JSON.stringify(benchmarks, null, 2)}\n`, "utf8");
    log(`  benchmarki: ${benchmarks.cases} przypadków, najgorsza zmiana ${(benchmarks.worstRegression * 100).toFixed(1)}%`);
  }

  const apiSnapshot = existsSync(join(ROOT, "tests/fixtures/public-api.json")) ? readJson(join(ROOT, "tests/fixtures/public-api.json")) : null;
  const stability = readStabilityCounts();
  const versionFile = readEngineVersionFile(ROOT);

  const release = {
    format: "b2d-release-artifacts",
    version,
    generatedAt: new Date().toISOString(),
    buildId: manifest.buildId,
    base: manifest.base,
    api: versionFile,
    stability,
    artifacts: {
      tests: testSummary,
      benchmarks,
      bundle: {
        totals: manifest.totals,
        singleFile: manifest.singleFile ?? null,
        files: manifest.files?.length ?? 0
      },
      api: apiSnapshot ? { symbols: apiSnapshot.symbols.length, apiLevel: apiSnapshot.apiLevel } : null
    }
  };
  writeFileSync(join(outDir, "release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8");

  if (apiSnapshot) writeFileSync(join(outDir, "api-snapshot.json"), `${JSON.stringify(apiSnapshot, null, 2)}\n`, "utf8");
  copyFileSync(manifestPath, join(outDir, "bundle-manifest.json"));
  if (latestBench) writeFileSync(join(outDir, "benchmarks-raw.json"), `${JSON.stringify(latestBench, null, 2)}\n`, "utf8");

  const changelogEntry = readChangelogEntry(version);
  const deprecations = readDeprecations();
  const projectFormatVersion = /CURRENT_PROJECT_VERSION\s*=\s*(\d+)/.exec(
    readFileSync(join(ROOT, "packages/engine/src/project/Schema.ts"), "utf8")
  )?.[1] ?? "?";
  const saveFormatVersion = /CURRENT_SAVE_VERSION\s*=\s*(\d+)/.exec(
    readFileSync(join(ROOT, "packages/engine/src/save/PlayerSave.ts"), "utf8")
  )?.[1] ?? "?";
  if (changelogEntry) writeFileSync(join(outDir, "changelog-entry.md"), `${changelogEntry}\n`, "utf8");

  const extractBullets = (markdown, limit = 3) => {
    const bullets = [];
    let current = null;
    for (const line of markdown.split("\n")) {
      if (line.startsWith("- ")) {
        if (current) bullets.push(current.trim());
        current = line.slice(2).trim();
      } else if (current && /^\s{2,}\S/.test(line)) {
        current += ` ${line.trim()}`;
      } else if (current) {
        bullets.push(current.trim());
        current = null;
      }
    }
    if (current) bullets.push(current.trim());
    return bullets.filter((bullet) => bullet.length > 0).slice(0, limit);
  };

  const highlights = changelogEntry ? extractBullets(changelogEntry, 3) : [];
  const notes = [
    `# Browser2DEngine ${version}`,
    "",
    `Build ${manifest.buildId} · API_LEVEL ${versionFile?.apiLevel ?? "?"} · API_STABILITY ${versionFile?.stability ?? "?"}`,
    "",
    "## Highlights",
    "",
    highlights.length
      ? highlights.map((bullet) => `- ${bullet}`).join("\n")
      : "- (uzupełnij: brak punktów w changelogu dla tej wersji)",
    "",
    "## Breaking changes",
    "",
    "- (uzupełnij ręcznie: żadna zmiana nie jest łamiąca, albo wstaw tabelę przed → po → co zrobić)",
    "",
    "## Deprecations",
    "",
    deprecations.length
      ? ["| Deprecated | Replacement | Removed in |", "|------------|-------------|------------|"]
          .concat(deprecations.map((entry) => `| \`${entry.id}\` | ${entry.replacement ? `\`${entry.replacement}\`` : "—"} | ${entry.removeIn} |`))
          .join("\n")
      : "None.",
    "",
    "## Migrations",
    "",
    `- Project format: up to ${projectFormatVersion}. \`node scripts/migrate.mjs --kind=project --in=project.json --out=project.v${projectFormatVersion}.json\``,
    `- Player saves: up to version ${saveFormatVersion}; applied on load, a newer save is rejected with \`SaveCorruptionError\`.`,
    "",
    "## Quality gate",
    "",
    "| Check | Result |",
    "|-------|--------|",
    testSummary ? `| Unit and integration tests | ${testSummary.passed}/${testSummary.total} in ${testSummary.files} files |` : "| Unit and integration tests | skipped |",
    benchmarks
      ? `| Benchmarks vs baseline | worst ${(benchmarks.worstRegression * 100).toFixed(1)} %, median ${(benchmarks.medianDelta * 100).toFixed(1)} % |`
      : "| Benchmarks vs baseline | no data |",
    `| Bundle size | ${kb(manifest.totals.gzip)} gzip, ${manifest.files?.length ?? 0} files |`,
    apiSnapshot ? `| API snapshot | ${apiSnapshot.symbols.length} symbols |` : "| API snapshot | missing |",
    "",
    "## Stability",
    "",
    `| Channel | Features |`,
    `|---------|----------|`,
    `| stable | ${stability.stable} |`,
    `| experimental | ${stability.experimental} |`,
    `| internal | ${stability.internal} |`,
    "",
    "",
    "## Known limitations",
    "",
    "- Patrz strona `#compat` w dokumentacji: lista przeglądarek, znane ograniczenia i procedura zgłoszeń.",
    "- Otwarty dług techniczny: `docs/TECH_DEBT.md` (waga S1 blokuje wydanie).",
    "",
    "## Artifacts",
    "",
    "| File | Size | SHA-256 |",
    "|------|------|---------|"
  ];

  const files = readdirSync(outDir)
    .filter((name) => name !== "CHECKSUMS.txt" && name !== "release-notes.md")
    .sort();
  const checksums = [];
  for (const name of files) {
    const buffer = readFileSync(join(outDir, name));
    const hash = sha256(buffer);
    checksums.push(`${hash}  ${name}`);
    notes.push(`| \`${name}\` | ${kb(statSync(join(outDir, name)).size)} | \`${hash.slice(0, 16)}…\` |`);
  }
  notes.push("");
  notes.push("Wygenerowane przez `node scripts/release.mjs --artifacts`. Szablon i zasady: `docs/RELEASE_NOTES_TEMPLATE.md`.");
  notes.push("");

  writeFileSync(join(outDir, "release-notes.md"), notes.join("\n"), "utf8");
  checksums.push(`${sha256(readFileSync(join(outDir, "release-notes.md")))}  release-notes.md`);
  writeFileSync(join(outDir, "CHECKSUMS.txt"), `${checksums.join("\n")}\n`, "utf8");

  const index = {
    format: "b2d-release-index",
    updatedAt: new Date().toISOString(),
    releases: readdirSync(resolve(ROOT, "release/artifacts"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const file = join(ROOT, "release/artifacts", entry.name, "release.json");
        if (!existsSync(file)) return null;
        const data = readJson(file);
        return {
          version: data.version,
          buildId: data.buildId,
          generatedAt: data.generatedAt,
          tests: data.artifacts?.tests ? `${data.artifacts.tests.passed}/${data.artifacts.tests.total}` : null,
          benchmarks: data.artifacts?.benchmarks?.cases ?? null,
          bundleGzip: data.artifacts?.bundle?.totals?.gzip ?? null,
          path: `release/artifacts/${entry.name}`
        };
      })
      .filter(Boolean)
      .sort((left, right) => (left.version < right.version ? 1 : -1))
  };
  writeFileSync(resolve(ROOT, "release/artifacts/index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  log(`  zapisano: ${files.length + 2} plików`);
  log(`  ${relative(ROOT, join(outDir, "release-notes.md"))}`);
  for (const line of notes.slice(0, 12)) log(`  ${line}`);
};

const check = () => {
  const versions = checkVersions(ROOT);
  const problems = [...versions.problems];

  if (!existsSync(join(ROOT, "CHANGELOG.md"))) problems.push("Brak CHANGELOG.md");
  else if (!readChangelogEntry(versions.rootVersion)) {
    problems.push(`CHANGELOG.md nie ma sekcji "## [${versions.rootVersion}]"`);
  }

  for (const file of ["docs/RELEASE_NOTES_TEMPLATE.md", "docs/TECH_DEBT.md", "docs/adr/README.md"]) {
    if (!existsSync(join(ROOT, file))) problems.push(`Brak ${file}`);
  }

  const debtPath = join(ROOT, "docs/TECH_DEBT.md");
  if (existsSync(debtPath)) {
    const debt = readFileSync(debtPath, "utf8");
    const open = debt.slice(debt.indexOf("## Otwarte"), debt.indexOf("## Spłacone"));
    for (const line of open.split("\n")) {
      if (!line.startsWith("| D-")) continue;
      const cells = line.split("|").map((cell) => cell.trim());
      if (cells[2] === "S1") problems.push(`Otwarty dług S1: ${cells[1]} — ${cells[4]}`);
    }
  }

  const adrDir = join(ROOT, "docs/adr");
  if (existsSync(adrDir)) {
    const index = readFileSync(join(adrDir, "README.md"), "utf8");
    for (const file of readdirSync(adrDir).filter((name) => /^\d{4}-.*\.md$/.test(name))) {
      if (!index.includes(`(${file})`)) problems.push(`docs/adr/README.md nie linkuje ${basename(file)}`);
    }
  }

  const manifestPath = join(ROOT, "dist/release.json");
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    if (!String(manifest.buildId ?? "").startsWith(`${versions.rootVersion}+`)) {
      problems.push(`dist/release.json ma buildId "${manifest.buildId}", oczekiwano prefiksu "${versions.rootVersion}+"`);
    }
  }

  log(`Kontrola wydania ${versions.rootVersion}`);
  if (problems.length === 0) {
    log("OK: wersje, changelog, szablon, ADR i build są spójne.");
    return;
  }
  console.error("BŁĄD: wydanie nie jest gotowe.");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
};

if (flag("check")) check();
else if (flag("artifacts")) await buildArtifacts();
else if (flag("dry-run")) {
  const versions = checkVersions(ROOT);
  log(`Wersja: ${versions.rootVersion}`);
  log(`Pakiety: ${versions.packages.map((entry) => `${entry.name}@${entry.version}`).join(", ")}`);
  log(`Changelog: ${readChangelogEntry(versions.rootVersion) ? "wpis istnieje" : "BRAK WPISU"}`);
  log(`Artefakty: ${existsSync(join(ROOT, "release/artifacts")) ? "katalog istnieje" : "katalog powstanie przy --artifacts"}`);
} else {
  log("Użycie: node scripts/release.mjs --check | --artifacts [--skip-tests] [--out=DIR] | --dry-run");
  process.exit(2);
}
