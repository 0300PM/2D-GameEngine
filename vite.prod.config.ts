import { defineConfig } from "vite";
import { buildMeta } from "./config/build-meta";
import { aliases, distDir, playgroundRoot, publicDir } from "./config/paths";
import { docsAssets } from "./config/vite-docs";

const base = process.env.B2D_BASE ?? "./";

export default defineConfig({
  base,
  plugins: [buildMeta({ base, mode: "production" }), docsAssets({ enabled: process.env.B2D_EMBED_DOCS !== "0" })],
  root: playgroundRoot,
  publicDir,
  resolve: { alias: aliases },
  build: {
    outDir: distDir,
    emptyOutDir: true,
    target: "es2020",
    sourcemap: process.env.B2D_SOURCEMAP === "1",
    reportCompressedSize: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1700,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
