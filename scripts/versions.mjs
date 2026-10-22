import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.env.B2D_ROOT ?? process.cwd());
const PACKAGES_DIR = join(ROOT, "packages");
const ENGINE_VERSION_FILE = join(ROOT, "packages/engine/src/version.ts");

export const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export const parseSemver = (value) => {
  const match = SEMVER.exec(String(value ?? "").trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  };
};

export const formatSemver = ({ major, minor, patch, prerelease }) =>
  `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ""}`;

export const bumpSemver = (version, kind) => {
  const parsed = parseSemver(version);
  if (!parsed) throw new Error(`Nieprawidłowa wersja: ${version}`);
  if (kind === "major") return formatSemver({ major: parsed.major + 1, minor: 0, patch: 0, prerelease: null });
  if (kind === "minor") return formatSemver({ major: parsed.major, minor: parsed.minor + 1, patch: 0, prerelease: null });
  if (kind === "patch") return formatSemver({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1, prerelease: null });
  throw new Error(`Nieznany typ zmiany: ${kind}`);
};

export const compareSemver = (left, right) => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) throw new Error(`Nieprawidłowa wersja: ${!a ? left : right}`);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
};

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

export const workspaceManifests = (root = ROOT) => {
  const dir = join(root, "packages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name, "package.json"))
    .filter((file) => existsSync(file));
};

export const readEngineVersionFile = (root = ROOT) => {
  const file = join(root, "packages/engine/src/version.ts");
  if (!existsSync(file)) return null;
  const source = readFileSync(file, "utf8");
  const version = /ENGINE_VERSION\s*=\s*"([^"]+)"/.exec(source)?.[1] ?? null;
  const apiLevel = /API_LEVEL\s*=\s*(\d+)/.exec(source)?.[1] ?? null;
  const stability = /API_STABILITY\s*=\s*"([^"]+)"/.exec(source)?.[1] ?? null;
  return { version, apiLevel: apiLevel === null ? null : Number(apiLevel), stability };
};

const lockstepDependency = (manifest, rootVersion) => {
  const problems = [];
  for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
    const deps = manifest[field] ?? {};
    for (const [name, range] of Object.entries(deps)) {
      if (!name.startsWith("@browser2d/")) continue;
      if (range !== rootVersion) {
        problems.push(`${manifest.name}: ${field}.${name} = "${range}", oczekiwano "${rootVersion}"`);
      }
    }
  }
  return problems;
};

export const checkVersions = (root = ROOT) => {
  const rootManifestPath = join(root, "package.json");
  const problems = [];
  if (!existsSync(rootManifestPath)) {
    return { ok: false, rootVersion: null, packages: [], problems: ["Brak package.json w katalogu głównym"] };
  }
  const rootManifest = readJson(rootManifestPath);
  const rootVersion = rootManifest.version;
  if (!parseSemver(rootVersion)) problems.push(`package.json: wersja "${rootVersion}" nie jest semverem`);

  const packages = workspaceManifests(root).map((file) => {
    const manifest = readJson(file);
    const relative = file.slice(root.length + 1);
    if (!manifest.name) problems.push(`${relative}: brak pola name`);
    if (manifest.version !== rootVersion) {
      problems.push(`${manifest.name ?? relative}: wersja "${manifest.version}", oczekiwano "${rootVersion}"`);
    }
    problems.push(...lockstepDependency(manifest, rootVersion));
    return { file: relative, name: manifest.name ?? null, version: manifest.version ?? null };
  });

  const versionFile = readEngineVersionFile(root);
  if (!versionFile) {
    problems.push("Brak packages/engine/src/version.ts");
  } else {
    if (versionFile.version !== rootVersion) {
      problems.push(`version.ts: ENGINE_VERSION "${versionFile.version}", oczekiwano "${rootVersion}"`);
    }
    if (!Number.isInteger(versionFile.apiLevel) || versionFile.apiLevel < 1) {
      problems.push("version.ts: API_LEVEL musi być liczbą całkowitą ≥ 1");
    }
    if (!["stable", "experimental"].includes(versionFile.stability ?? "")) {
      problems.push("version.ts: API_STABILITY musi być \"stable\" albo \"experimental\"");
    }
  }

  return { ok: problems.length === 0, rootVersion, packages, versionFile, problems };
};

export const applyVersion = (version, options = {}) => {
  const root = options.root ?? ROOT;
  const parsed = parseSemver(version);
  if (!parsed) throw new Error(`Nieprawidłowa wersja: ${version}`);
  const changed = [];

  const rootManifestPath = join(root, "package.json");
  const rootManifest = readJson(rootManifestPath);
  rootManifest.version = version;
  writeJson(rootManifestPath, rootManifest);
  changed.push("package.json");

  for (const file of workspaceManifests(root)) {
    const manifest = readJson(file);
    manifest.version = version;
    for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
      for (const name of Object.keys(manifest[field] ?? {})) {
        if (name.startsWith("@browser2d/")) manifest[field][name] = version;
      }
    }
    writeJson(file, manifest);
    changed.push(file.slice(root.length + 1));
  }

  const file = join(root, "packages/engine/src/version.ts");
  const source = readFileSync(file, "utf8");
  const apiLevel = options.apiLevel ?? Number(/API_LEVEL\s*=\s*(\d+)/.exec(source)?.[1] ?? 1);
  const stability = options.stability ?? /API_STABILITY\s*=\s*"([^"]+)"/.exec(source)?.[1] ?? "experimental";
  writeFileSync(
    file,
    `export const ENGINE_VERSION = "${version}";\nexport const API_LEVEL = ${apiLevel};\nexport const API_STABILITY = "${stability}" as const;\n`,
    "utf8"
  );
  changed.push("packages/engine/src/version.ts");

  return { version, apiLevel, stability, changed };
};

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const set = args.find((value) => value.startsWith("--set="))?.slice("--set=".length);
  const positional = args.find((value) => ["major", "minor", "patch"].includes(value));
  const bump = args.find((value) => value.startsWith("--bump="))?.slice("--bump=".length) ?? positional;
  const check = args.includes("--check") || (!set && !bump);

  if (set || bump) {
    const current = checkVersions().rootVersion;
    const next = set ? set : bumpSemver(current, bump);
    const result = applyVersion(next, {
      apiLevel: bump === "major" ? Number(readEngineVersionFile()?.apiLevel ?? 1) + 1 : undefined
    });
    console.log(`Wersja: ${current} → ${result.version} (API_LEVEL ${result.apiLevel})`);
    for (const file of result.changed) console.log(`  zapisano ${file}`);
    const after = checkVersions();
    if (!after.ok) {
      console.error("Niespójność po zmianie wersji:");
      for (const problem of after.problems) console.error(`  ${problem}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const report = checkVersions();
  console.log(`Wersja rdzenia: ${report.rootVersion} · pakiety: ${report.packages.length}`);
  for (const entry of report.packages) console.log(`  ${entry.name.padEnd(28)} ${entry.version}  (${entry.file})`);
  if (report.versionFile) {
    console.log(`  version.ts: ENGINE_VERSION ${report.versionFile.version} · API_LEVEL ${report.versionFile.apiLevel} · API_STABILITY ${report.versionFile.stability}`);
  }
  if (report.ok) {
    console.log(check ? "OK: wersje spójne w monorepo." : "OK");
    process.exit(0);
  }
  console.error("BŁĄD: wersje niespójne.");
  for (const problem of report.problems) console.error(`  ${problem}`);
  process.exit(1);
}
