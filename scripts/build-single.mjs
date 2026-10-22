import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const ASSETS = join(ROOT, "apps/playground/public/assets");
const SHELL = join(ROOT, "apps/playground/index.html");
const TARGET = join(ROOT, "playground.html");

const read = (path) => readFileSync(path, "utf8");

const MIME = { png: "image/png", wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", json: "application/json" };

const assetMap = () => {
  const map = {};
  for (const name of readdirSync(ASSETS)) {
    const extension = name.split(".").pop();
    if (!extension || !MIME[extension]) continue;
    map[name.slice(0, -(extension.length + 1))] = `data:${MIME[extension]};base64,${readFileSync(join(ASSETS, name)).toString("base64")}`;
  }
  return map;
};

const bundle = (() => {
  const html = read(join(DIST, "index.html"));
  const match = /<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/.exec(html);
  if (!match) throw new Error("Bundle script not found in dist/index.html");
  return read(join(DIST, match[1].replace(/^\.?\//, "")));
})();

const esmPatterns = [
  /(^|[;{}])\s*export\s+(default|const|let|var|function|class|async|\{|\*)/m,
  /(^|[;{}])\s*import\s+["'{*]/m,
  /(^|[;{}])\s*import\s+[\w$]+\s*(,|from)/m,
  /import\.meta/
];
for (const pattern of esmPatterns) {
  const match = pattern.exec(bundle);
  if (match) throw new Error(`Bundle needs ESM: found "${match[0].trim()}"`);
}

const chunks = readdirSync(join(DIST, "assets")).filter((file) => file.endsWith(".js"));
if (chunks.length !== 1) {
  throw new Error(`Single-file build must emit one script, found ${chunks.length}: ${chunks.join(", ")}`);
}

const code = `(function(){"use strict";\n${bundle}\n})();`.replace(/<\/script/gi, "<\\/script");
const assets = JSON.stringify(assetMap()).replace(/</g, "\\u003c");

const PKG = JSON.parse(read(join(ROOT, "package.json")));
const STAMP = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const META = [
  `<meta name="b2d-build" content="${PKG.version}+${STAMP}-single">`,
  `<meta name="b2d-built-at" content="${new Date().toISOString()}">`,
  `<meta name="b2d-base" content="./">`,
  `<meta name="b2d-mode" content="single-file">`
].join("\n  ");

let shell = read(SHELL)
  .replace(/\s*<script type="module" src="\/src\/main\.ts"><\/script>/, "")
  .replace("</head>", () => `  ${META}\n  <script>window.__B2D_ASSETS__ = ${assets};</script>\n</head>`)
  .replace("</body>", () => `  <script data-b2d-boot>\n${code}\n  </script>\n</body>`);

if (!shell.includes("data-b2d-boot")) throw new Error("Boot script injection failed");
if (/\/src\/main\.ts|type="module"/.test(shell)) throw new Error("Shell still references a module entry");

writeFileSync(TARGET, shell, "utf8");
console.log(`playground.html ${(shell.length / 1024).toFixed(0)} kB, classic script, assets ${Object.keys(assetMap()).length}`);
