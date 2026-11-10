#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const DOCS_URL = "https://docs.krecik.tech/game-engine";

const ROOT = resolve(process.cwd());
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "release",
  "build-native",
  "build-wasm",
  "coverage",
  "uploads"
]);
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".html",
  ".txt",
  ".cpp",
  ".hpp",
  ".h"
]);
const STALE_PATTERNS = [
  { pattern: /docs\/index\.html/, hint: "link to the docs site instead" },
  { pattern: /docs\/adr\//, hint: "ADR files are not part of this repository" },
  { pattern: /docs\/api\//, hint: "the API reference lives on the docs site" },
  { pattern: /docs\/guides\//, hint: "guides live on the docs site" },
  { pattern: /docs\/[A-Z][A-Z_]+\.md/, hint: "use a docs-site anchor such as #releases" }
];

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (TEXT_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) out.push(full);
  }
  return out;
};

const problems = [];

if (existsSync(join(ROOT, "docs"))) problems.push("docs/ exists — documentation lives at " + DOCS_URL);

for (const file of walk(ROOT)) {
  const path = relative(ROOT, file).replace(/\\/g, "/");
  if (path === "playground.html" || path.startsWith("benchmarks/bundle-baseline.json")) continue;
  const source = readFileSync(file, "utf8");
  if (!source.includes("docs")) continue;
  if (path === "scripts/docs-check.mjs" || path === "tests/unit/WorkspaceVersions.test.ts") continue;
  for (const { pattern, hint } of STALE_PATTERNS) {
    if (pattern.test(source)) problems.push(`${path}: matches ${pattern.source} — ${hint}`);
  }
  const localLinks = source.match(/\]\((?!https?:|#|\/)([^)]*docs[^)]*)\)/gi) ?? [];
  for (const link of localLinks) problems.push(`${path}: relative docs link ${link}`);
}

const entryPoints = [
  "README.md",
  "templates/plugin/README.md",
  "examples/native-core/README.md",
  "examples/determinism/README.md"
];
for (const entry of entryPoints) {
  if (!existsSync(join(ROOT, entry))) continue;
  const source = readFileSync(join(ROOT, entry), "utf8");
  if (!source.includes(DOCS_URL)) problems.push(`${entry}: must point at ${DOCS_URL}`);
}

if (problems.length > 0) {
  console.error(`docs check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`docs check: no local documentation, every reference points at ${DOCS_URL}`);
