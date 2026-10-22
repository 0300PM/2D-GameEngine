import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const MANIFEST = join(ROOT, "dist", "release.json");
const BASELINE = join(ROOT, "benchmarks", "bundle-baseline.json");

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const TOLERANCE = Number(arg("tolerance", "0.1"));
const FILE_TOLERANCE = Number(arg("file-tolerance", "0.35"));
const MIN_FILE_BYTES = Number(arg("min-bytes", "16384"));
const BASELINE_PATH = resolve(ROOT, arg("baseline", "benchmarks/bundle-baseline.json"));
const UPDATE = flag("update");
const CHECK = flag("check");

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const pct = (value) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

if (!existsSync(MANIFEST)) {
  console.error(`Missing dist/release.json — run "npm run build" first (${MANIFEST}).`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const current = {
  generatedAt: new Date().toISOString(),
  buildId: manifest.buildId,
  base: manifest.base,
  totals: manifest.totals,
  singleFile: manifest.singleFile,
  files: manifest.files.map((file) => ({ path: file.path, bytes: file.bytes, gzip: file.gzip }))
};

const describe = (report) => {
  console.log(`Raport rozmiaru · build ${report.buildId ?? "?"} · base ${report.base ?? "?"}`);
  console.log(
    `  suma: ${kb(report.totals.bytes)} · gzip ${kb(report.totals.gzip)} · brotli ${kb(report.totals.brotli)} · plików ${report.totals.files}`
  );
  if (report.singleFile) console.log(`  single-file: ${report.singleFile.path} ${kb(report.singleFile.bytes)}`);
  const top = [...report.files].sort((a, b) => b.gzip - a.gzip).slice(0, 8);
  for (const file of top) console.log(`    ${file.path.padEnd(38)} raw ${kb(file.bytes).padStart(10)}  gzip ${kb(file.gzip).padStart(9)}`);
};

if (UPDATE || !existsSync(BASELINE_PATH)) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  describe(current);
  console.log(UPDATE ? `Zapisano bazę: ${BASELINE_PATH}` : `Brak bazy — zapisano pierwszą: ${BASELINE_PATH}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
describe(current);
console.log(`Baza: ${baseline.generatedAt} · gzip ${kb(baseline.totals.gzip)} · tolerancja ${pct(TOLERANCE)}`);

const regressions = [];
const growth = current.totals.gzip / baseline.totals.gzip - 1;
console.log(`  gzip suma: ${kb(baseline.totals.gzip)} → ${kb(current.totals.gzip)} (${pct(growth)})`);
if (growth > TOLERANCE) {
  regressions.push(`gzip sum grew ${pct(growth)} (limit ${pct(TOLERANCE)})`);
}

const byPath = new Map(baseline.files.map((file) => [file.path, file]));
for (const file of current.files) {
  const before = byPath.get(file.path);
  if (!before) {
    console.log(`  nowy plik: ${file.path} (${kb(file.gzip)} gzip)`);
    continue;
  }
  byPath.delete(file.path);
  const delta = file.gzip / before.gzip - 1;
  if (Math.abs(delta) < 0.02) continue;
  console.log(`  ${file.path}: ${kb(before.gzip)} → ${kb(file.gzip)} (${pct(delta)})`);
  if (delta > FILE_TOLERANCE && file.gzip - before.gzip > MIN_FILE_BYTES) {
    regressions.push(`${file.path} gzip grew ${pct(delta)} (file limit ${pct(FILE_TOLERANCE)})`);
  }
}
for (const path of byPath.keys()) console.log(`  usunięto plik: ${path}`);

if (current.singleFile && baseline.singleFile) {
  const delta = current.singleFile.bytes / baseline.singleFile.bytes - 1;
  console.log(`  single-file: ${kb(baseline.singleFile.bytes)} → ${kb(current.singleFile.bytes)} (${pct(delta)})`);
  if (delta > Math.max(TOLERANCE, 0.05)) {
    regressions.push(`playground.html grew ${pct(delta)}`);
  }
}

if (!CHECK) {
  console.log("Tryb raportu — użyj --check, aby egzekwować progi.");
  process.exit(0);
}

if (regressions.length === 0) {
  console.log("OK: rozmiar w progach.");
  process.exit(0);
}
console.error("REGRESJA ROZMIARU:");
for (const entry of regressions) console.error(`  - ${entry}`);
process.exit(1);
