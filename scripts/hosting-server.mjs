import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { extname, join, normalize, resolve } from "node:path";

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2"
};

export const inlineScriptHashes = (root) => {
  const file = join(root, "index.html");
  if (!existsSync(file)) return [];
  const html = readFileSync(file, "utf8");
  const hashes = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = pattern.exec(html))) {
    if (match[1].trim() === "") continue;
    hashes.push(`'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`);
  }
  return hashes;
};

export const strictCsp = (hashes) =>
  [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'"
  ].join("; ");

const securityHeaders = (options, hashes) => {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
  };
  if (options.csp === "strict") headers["Content-Security-Policy"] = strictCsp(hashes);
  if (options.csp === "report-only") {
    headers["Content-Security-Policy-Report-Only"] = strictCsp(hashes);
  }
  return headers;
};

const cacheHeaders = (options, urlPath) => {
  if (options.cache === "immutable") {
    const immutable = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css|png|jpg|webp|svg)$/.test(urlPath);
    return immutable
      ? { "Cache-Control": "public, max-age=31536000, immutable" }
      : { "Cache-Control": "no-cache" };
  }
  if (options.cache === "aggressive") return { "Cache-Control": "public, max-age=3600" };
  return { "Cache-Control": "no-store" };
};

export const createHostingServer = async (options = {}) => {
  const root = resolve(options.root ?? join(process.cwd(), "dist"));
  const mount = options.mount ?? "/";
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;
  const fallback = options.fallback ?? "404";
  const hashes = inlineScriptHashes(root);
  const base = securityHeaders(options, hashes);

  const send = (response, status, body, type, extra = {}) => {
    response.writeHead(status, { "Content-Type": type, ...base, ...extra });
    response.end(body);
  };

  const handler = (request, response) => {
    const url = request.url ?? "/";
    if (!url.startsWith(mount === "/" ? "/" : mount)) {
      send(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const relativeUrl = `/${url.slice(mount.length)}`.replace(/\/+/g, "/");
    const decoded = decodeURIComponent(relativeUrl.split("?")[0].split("#")[0]);
    const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
    const candidate = join(root, safe);

    const serveFile = (file) => {
      const type = MIME[extname(file)] ?? "application/octet-stream";
      const headers = { "Content-Type": type, ...base, ...cacheHeaders(options, relativeUrl) };
      response.writeHead(200, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(file).pipe(response);
    };

    if (candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()) {
      serveFile(candidate);
      return;
    }
    if (candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isDirectory()) {
      const index = join(candidate, "index.html");
      if (existsSync(index)) {
        serveFile(index);
        return;
      }
    }
    if (fallback === "index" && !extname(decoded) && existsSync(join(root, "index.html"))) {
      serveFile(join(root, "index.html"));
      return;
    }
    const errorPage = join(root, "404.html");
    if (existsSync(errorPage)) {
      const body = readFileSync(errorPage);
      response.writeHead(404, { "Content-Type": MIME[".html"], ...base, ...cacheHeaders(options, relativeUrl) });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    send(response, 404, "Not found", "text/plain; charset=utf-8");
  };

  const server = options.https ? createHttpsServer(options.https, handler) : createHttpServer(handler);
  await new Promise((done) => server.listen(port, host, done));
  const actual = server.address();
  const protocol = options.https ? "https" : "http";
  const url = `${protocol}://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actual.port}${mount}`;

  return {
    server,
    url,
    mount,
    origin: url.replace(/\/$/, ""),
    close: () => new Promise((done) => server.close(done))
  };
};

const isMain = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;

if (isMain) {
  const arg = (name, fallback) => {
    const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const instance = await createHostingServer({
    root: arg("root", "dist"),
    mount: arg("mount", "/"),
    port: Number(arg("port", "4180")),
    host: arg("host", "0.0.0.0"),
    csp: arg("csp", "none"),
    cache: arg("cache", "none"),
    fallback: arg("fallback", "index")
  });
  console.log(`Hosting preview: ${instance.url} (root ${resolve(arg("root", "dist"))}, csp ${arg("csp", "none")})`);
}
