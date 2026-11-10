import { defineConfig } from "vite";
import { buildMeta } from "./config/build-meta";
import { aliases, playgroundRoot, publicDir } from "./config/paths";
import { docsRedirect } from "./config/vite-docs";

export default defineConfig({
  plugins: [docsRedirect(), buildMeta({ base: "/", mode: "development" })],
  root: playgroundRoot,
  publicDir,
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "no-store"
    },
    hmr: { protocol: "wss", clientPort: 443 }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  resolve: { alias: aliases }
});
