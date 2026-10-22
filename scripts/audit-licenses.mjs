import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const LOCK = join(ROOT, "package-lock.json");
const ASSETS = join(ROOT, "apps/playground/public/assets");
const REPORT = join(ROOT, "docs", "LICENSES.md");

const ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "CC0-1.0",
  "CC-BY-4.0",
  "Unlicense",
  "Python-2.0",
  "BlueOak-1.0.0",
  "MPL-2.0",
  "MIT-0"
]);

const REVIEW = new Set(["LGPL-3.0", "LGPL-2.1", "MPL-2.0"]);
const FORBIDDEN = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "SSPL-1.0", "BUSL-1.1", "CC-BY-NC-4.0"]);

const args = process.argv.slice(2);
const check = args.includes("--check");
const quiet = args.includes("--quiet");

if (!existsSync(LOCK)) {
  console.error("Missing package-lock.json — run npm install first.");
  process.exit(1);
}

const lock = JSON.parse(readFileSync(LOCK, "utf8"));
const packages = Object.entries(lock.packages ?? {})
  .filter(([path, entry]) => path !== "" && path.includes("node_modules/") && !entry.link)
  .map(([path, entry]) => ({
    name: path.replace(/^.*node_modules\//, ""),
    version: String(entry.version ?? "?"),
    license: typeof entry.license === "string" ? entry.license : Array.isArray(entry.licenses) ? entry.licenses.join(" OR ") : "",
    dev: Boolean(entry.dev)
  }))
  .filter((entry) => entry.name !== "");

const classify = (license) => {
  if (!license) return "unknown";
  const parts = license
    .replace(/[()]/g, "")
    .split(/\s+(?:OR|AND)\s+/)
    .map((part) => part.trim());
  if (parts.some((part) => FORBIDDEN.has(part))) return "forbidden";
  if (parts.every((part) => ALLOWED.has(part))) {
    return parts.some((part) => REVIEW.has(part)) ? "review" : "allowed";
  }
  return "unknown";
};

const deps = packages.map((entry) => ({ ...entry, status: classify(entry.license) }));
const byStatus = (status) => deps.filter((entry) => entry.status === status);
const counts = {
  total: deps.length,
  allowed: byStatus("allowed").length,
  review: byStatus("review").length,
  unknown: byStatus("unknown").length,
  forbidden: byStatus("forbidden").length,
  runtime: deps.filter((entry) => !entry.dev).length
};

const ASSET_MANIFEST = join(ASSETS, "LICENSES.json");
const assetEntries = [];
const problems = [];

if (!existsSync(ASSETS)) {
  problems.push(`Brak katalogu zasobów: ${ASSETS}`);
} else {
  const declared = existsSync(ASSET_MANIFEST) ? JSON.parse(readFileSync(ASSET_MANIFEST, "utf8")) : {};
  for (const name of readdirSync(ASSETS).sort()) {
    const full = join(ASSETS, name);
    if (!statSync(full).isFile()) continue;
    if (["README.md", "LICENSES.json"].includes(name)) continue;
    const entry = declared[name];
    assetEntries.push({
      name,
      license: entry?.license ?? "",
      source: entry?.source ?? "",
      author: entry?.author ?? ""
    });
    if (!entry) {
      problems.push(`Zasób ${name} nie ma wpisu w LICENSES.json`);
    } else if (!entry.license) {
      problems.push(`Zasób ${name} nie ma pola license`);
    } else if (classify(entry.license) === "forbidden") {
      problems.push(`Zasób ${name} ma niedozwoloną licencję: ${entry.license}`);
    } else if (!entry.source) {
      problems.push(`Zasób ${name} nie ma podanego źródła`);
    }
  }
  for (const key of Object.keys(declared)) {
    if (!existsSync(join(ASSETS, key))) problems.push(`LICENSES.json wymienia nieistniejący plik: ${key}`);
  }
}

for (const entry of byStatus("unknown")) problems.push(`Zależność ${entry.name}@${entry.version} ma nieznaną licencję: ${entry.license || "brak"}`);
for (const entry of byStatus("forbidden")) problems.push(`Zależność ${entry.name}@${entry.version} ma niedozwoloną licencję: ${entry.license}`);

const rows = (list) =>
  list
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `| \`${entry.name}\` | ${entry.version} | ${entry.license || "—"} | ${entry.dev ? "dev" : "runtime"} | ${entry.status} |`)
    .join("\n");

const assetRows = assetEntries
  .map((entry) => `| \`${entry.name}\` | ${entry.license || "—"} | ${entry.author || "—"} | ${entry.source || "—"} |`)
  .join("\n");

const generated = `# Licencje

Plik generowany przez \`npm run audit:licenses:write\`. Nie edytuj ręcznie.

## Zależności

${counts.total} pakietów (${counts.runtime} runtime), dozwolone: ${counts.allowed}, do przeglądu: ${counts.review}, nieznane: ${counts.unknown}, niedozwolone: ${counts.forbidden}.

| Pakiet | Wersja | Licencja | Zakres | Status |
|--------|--------|----------|--------|--------|
${rows(deps)}

## Zasoby gry

Źródło prawdy: \`apps/playground/public/assets/LICENSES.json\`. Każdy plik musi mieć licencję i źródło; brak wpisu blokuje build.

| Plik | Licencja | Autor | Źródło |
|------|----------|-------|--------|
${assetRows || "| — | — | — | — |"}

## Zasady

- Dozwolone: ${[...ALLOWED].sort().join(", ")}.
- Do przeglądu (wolno, ale świadomie): ${[...REVIEW].sort().join(", ")}.
- Niedozwolone bez decyzji prawnej: ${[...FORBIDDEN].sort().join(", ")}.
- Każdy zasób graficzny i audio wymaga licencji i źródła; \`validateProject({ requireLicenses: true })\` egzekwuje to także w danych projektu.
- \`npm run audit:licenses\` kończy się kodem 1 przy nieznanej lub niedozwolonej licencji, brakującym wpisie zasobu albo nieaktualnym raporcie.
`;

const exists = existsSync(REPORT);
const current = exists ? readFileSync(REPORT, "utf8") : "";
const stale = current !== generated;

if (!check) {
  writeFileSync(REPORT, generated, "utf8");
}

if (!quiet) {
  console.log(
    `Licencje: ${counts.total} pakietów (${counts.runtime} runtime) · dozwolone ${counts.allowed} · przegląd ${counts.review} · nieznane ${counts.unknown} · niedozwolone ${counts.forbidden}`
  );
  console.log(`Zasoby: ${assetEntries.length} plików, wpisy w LICENSES.json: ${assetEntries.filter((entry) => entry.license).length}`);
  if (check && stale) console.log(`Raport nieaktualny: ${REPORT} (uruchom npm run audit:licenses:write)`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

if (check && stale) process.exit(1);

if (!quiet) console.log(`OK: licencje w porządku${check ? " i raport aktualny" : ""}.`);
