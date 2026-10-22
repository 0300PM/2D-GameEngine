import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { constants, createBrotliCompress, createGzip } from "node:zlib";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const TARGET = join(DIST, "release.json");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const SKIP = new Set([".map"]);

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (!SKIP.has(extname(entry.name))) out.push(full);
  }
  return out;
};

const compressedSize = async (file, kind) => {
  const transform =
    kind === "gzip"
      ? createGzip({ level: 9 })
      : createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
  let bytes = 0;
  for await (const chunk of createReadStream(file).pipe(transform)) bytes += chunk.length;
  return bytes;
};

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

if (!existsSync(DIST)) {
  console.error(`Missing ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

const meta = (() => {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const id = /name="b2d-build" content="([^"]+)"/.exec(html)?.[1] ?? "unknown";
  const builtAt = /name="b2d-built-at" content="([^"]+)"/.exec(html)?.[1] ?? new Date().toISOString();
  const base = /name="b2d-base" content="([^"]+)"/.exec(html)?.[1] ?? "./";
  return { id, builtAt, base };
})();

const files = [];
const totals = { bytes: 0, gzip: 0, brotli: 0, files: 0 };

for (const file of walk(DIST).filter((path) => path !== TARGET)) {
  const size = statSync(file).size;
  const entry = {
    path: relative(DIST, file).split("\\").join("/"),
    bytes: size,
    gzip: await compressedSize(file, "gzip"),
    brotli: await compressedSize(file, "brotli"),
    sha256: sha256(file)
  };
  files.push(entry);
  totals.bytes += entry.bytes;
  totals.gzip += entry.gzip;
  totals.brotli += entry.brotli;
  totals.files += 1;
}

files.sort((a, b) => b.bytes - a.bytes);

const single = existsSync(join(ROOT, "playground.html"))
  ? { path: "playground.html", bytes: statSync(join(ROOT, "playground.html")).size }
  : null;

const manifest = {
  name: "browser2d-engine-playground",
  version: PKG.version,
  buildId: meta.id,
  builtAt: meta.builtAt,
  base: meta.base,
  generatedAt: new Date().toISOString(),
  totals,
  files,
  singleFile: single
};

writeFileSync(TARGET, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `release.json: ${totals.files} plików · ${(totals.bytes / 1024).toFixed(0)} kB · gzip ${(totals.gzip / 1024).toFixed(0)} kB · brotli ${(totals.brotli / 1024).toFixed(0)} kB · base ${meta.base}`
);
