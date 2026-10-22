import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"]
  },
  resolve: {
    alias: [
      { find: "@engine", replacement: resolve(__dirname, "packages/engine/src") },
      { find: "@project-format", replacement: resolve(__dirname, "packages/project-format/src") },
      { find: "@phaser-adapter", replacement: resolve(__dirname, "packages/phaser-adapter/src") },
      { find: "@wasm-bridge", replacement: resolve(__dirname, "packages/wasm-bridge/src") }
    ]
  }
});
