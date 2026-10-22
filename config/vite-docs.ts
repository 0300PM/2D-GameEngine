import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import type { Plugin } from "vite";
import { distDir, docsDir } from "./paths";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

export const docsAssets = (options: { enabled?: boolean } = {}): Plugin => ({
  name: "b2d-docs-assets",
  apply: () => options.enabled !== false,
  closeBundle() {
    if (options.enabled === false) return;
    if (!existsSync(docsDir) || !existsSync(distDir)) return;
    cpSync(docsDir, join(distDir, "docs"), { recursive: true });
  },
  configureServer(server) {
    server.middlewares.use("/docs", (request, response, next) => {
      const url = (request.url ?? "/").split("?")[0];
      const relative = normalize(decodeURIComponent(url)).replace(/^(\.\.[/\\])+/, "");
      const candidate = join(docsDir, relative);
      const file = url === "/" || url === "" ? join(docsDir, "index.html") : candidate;
      const inside = file.startsWith(docsDir);
      if (!inside || !existsSync(file) || !statSync(file).isFile()) {
        next();
        return;
      }
      response.setHeader("Content-Type", CONTENT_TYPES[extname(file)] ?? "application/octet-stream");
      createReadStream(file).pipe(response);
    });
  }
});
