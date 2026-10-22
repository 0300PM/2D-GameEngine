import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "node_modules", "vite-node", "vite-node.mjs");
const ENTRY = join(ROOT, "scripts", "migrate.ts");

if (!existsSync(BIN)) {
  console.error("Brak vite-node. Uruchom: npm install");
  process.exit(1);
}
if (!existsSync(ENTRY)) {
  console.error(`Brak ${ENTRY}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [BIN, ENTRY, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
