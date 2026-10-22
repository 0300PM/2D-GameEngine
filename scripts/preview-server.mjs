import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "dist");
const PORT = Number(process.env.PORT ?? 5175);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2"
};

const headers = (type) => ({
  "Content-Type": type,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cache-Control": "no-store"
});

const resolveFile = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(ROOT, safe);
  if (!candidate.startsWith(ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    if (existsSync(index)) return index;
  }
  return null;
};

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers("text/plain"));
    response.end();
    return;
  }

  const url = request.url ?? "/";
  const file = resolveFile(url) ?? join(ROOT, "index.html");
  const type = MIME[extname(file)] ?? "application/octet-stream";

  response.writeHead(200, headers(type));
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

if (!existsSync(ROOT)) {
  console.error(`Missing build output: ${ROOT}. Run "npm run build" first.`);
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`Static preview on http://${HOST}:${PORT} serving ${ROOT}`);
});
