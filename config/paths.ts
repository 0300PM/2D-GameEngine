import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
export const playgroundRoot = resolve(repoRoot, "apps/playground");
export const publicDir = resolve(playgroundRoot, "public");
export const docsDir = resolve(repoRoot, "docs");
export const distDir = resolve(repoRoot, "dist");

export const aliases = [
  { find: "@engine", replacement: resolve(repoRoot, "packages/engine/src") },
  { find: "@project-format", replacement: resolve(repoRoot, "packages/project-format/src") },
  { find: "@phaser-adapter", replacement: resolve(repoRoot, "packages/phaser-adapter/src") },
  { find: "@wasm-bridge", replacement: resolve(repoRoot, "packages/wasm-bridge/src") }
];
