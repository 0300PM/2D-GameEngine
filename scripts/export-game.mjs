import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { inlineScriptHashes, strictCsp } from "./hosting-server.mjs";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const manifestPath = join(DIST, "release.json");
if (!existsSync(manifestPath)) {
  console.error('Missing dist/release.json. Run "npm run build" first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const outDir = resolve(ROOT, arg("out", "release/game"));
const clean = !process.argv.includes("--keep");

if (existsSync(outDir) && clean) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(DIST, outDir, { recursive: true });

const outManifest = JSON.parse(readFileSync(join(outDir, "release.json"), "utf8"));
const hashes = inlineScriptHashes(outDir);
const csp = strictCsp(hashes);
const hosting = join(outDir, "hosting");
mkdirSync(hosting, { recursive: true });

const write = (name, body) => writeFileSync(join(hosting, name), `${body.trimEnd()}\n`, "utf8");

write(
  "nginx.conf",
  `
# Browser2DEngine — ${outManifest.name} ${outManifest.version} (${outManifest.buildId})
# Wklej blok server do /etc/nginx/conf.d/b2d.conf. Dokumentacja: docs/index.html#deploy
server {
    listen 443 ssl http2;
    server_name game.example.com;

    root /var/www/b2d/game;
    index index.html;

    # HTTPS jest wymagane: audio, WebGL i workery działają inaczej na http://
    ssl_certificate     /etc/letsencrypt/live/game.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.example.com/privkey.pem;

    add_header Content-Security-Policy "${csp}" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Hashowane pliki z assets/ są niezmienne — cache na rok
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    # index.html musi być zawsze świeży, inaczej gracz zostaje na starym buildzie
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }

    # Gra działa pod stałym adresem katalogu; nieznane ścieżki zwracają 404.html.
    # Przepisywanie głębokich ścieżek na index.html psuje względne ścieżki assets/.
    error_page 404 /404.html;
    location = /404.html {
        add_header Cache-Control "no-cache" always;
    }
    location / {
        try_files $uri $uri/ =404;
    }

    types {
        application/wasm wasm;
        audio/wav wav;
    }
}
`
);

write(
  "netlify.toml",
  `
[build]
  publish = "game"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "${csp}"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "no-cache"

# Netlify automatycznie serwuje 404.html dla nieznanych ścieżek — bez redirectów SPA.
`
);

write(
  "_headers",
  `
/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
);

write(
  "vercel.json",
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      cleanUrls: true,
      trailingSlash: false,
      headers: [
        {
          source: "/(.*)",
          headers: [
            { key: "Content-Security-Policy", value: csp },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" }
          ]
        },
        {
          source: "/assets/(.*)",
          headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
        }
      ]
    },
    null,
    2
  )
);

write(
  "firebase.json",
  JSON.stringify(
    {
      hosting: {
        public: ".",
        ignore: ["firebase.json", "**/.*", "**/node_modules/**", "hosting/**"],
        headers: [
          {
            source: "**",
            headers: [
              { key: "Content-Security-Policy", value: csp },
              { key: "X-Content-Type-Options", value: "nosniff" }
            ]
          },
          {
            source: "/assets/**",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
          }
        ]
      }
    },
    null,
    2
  )
);

write(
  "htaccess",
  `
# Apache 2.4 — umieść jako .htaccess w katalogu z grą
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "${csp}"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType audio/wav "access plus 1 year"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>

<IfModule mod_mime.c>
  AddType application/wasm .wasm
  AddType audio/wav .wav
  AddType text/javascript .js
</IfModule>

ErrorDocument 404 /404.html

<IfModule mod_mime.c>
  AddType text/html .html
</IfModule>
`
);

write(
  "README.md",
  `
# Hosting — ${outManifest.name} ${outManifest.version}

Build: \`${outManifest.buildId}\` · base path: \`${outManifest.base}\` · pliki: ${outManifest.totals.files} · gzip: ${(outManifest.totals.gzip / 1024).toFixed(0)} kB

Wybierz jeden plik konfiguracyjny i przenieś katalog \`game\` na serwer:

| Hosting | Plik | Uwaga |
|---------|------|-------|
| nginx | \`nginx.conf\` | wklej blok \`server\`, ustaw \`root\` |
| Apache | \`htaccess\` | zmień nazwę na \`.htaccess\` |
| Netlify | \`netlify.toml\` | \`publish = "game"\` |
| Cloudflare Pages | \`_headers\` | wrzuć do katalogu publikacji |
| Vercel | \`vercel.json\` | \`rewrites\` pokrywa odświeżenie |
| Firebase Hosting | \`firebase.json\` | \`public: "."\` |

CSP zawiera hash inline skryptu startowego (\`sha256-…\`), więc ekran błędu startowego działa bez
\`'unsafe-inline'\`. Po każdej zmianie inline skryptu w \`index.html\` wygeneruj pliki ponownie:
\`npm run export:game\`.

Zasady, których nie wolno zgubić:

1. \`index.html\` zawsze \`no-cache\`, pliki z \`assets/\` zawsze \`immutable\` — inaczej gracz zostaje na starym buildzie.
2. Odświeżenie działa, bo gra ma stały adres katalogu, a stan siedzi w parametrach
   (\`?example=…&lang=…\`). Nie przepisuj głębokich ścieżek na \`index.html\` — względne
   ścieżki do \`assets/\` przestałyby się rozwiązywać. Nieznane adresy → \`404.html\`.
3. HTTPS obligatoryjnie — bez niego audio i część API przeglądarki zachowuje się inaczej.
4. \`.wasm\` musi mieć \`application/wasm\`, inaczej \`WebAssembly.instantiateStreaming\` odmówi.
5. Nie zmieniaj nazwy katalogu \`assets\` — ścieżki w buildzie są względne wobec \`index.html\`.
`
);

const checksums = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else checksums.push(full);
  }
};
walk(outDir);
checksums.sort();
const lines = checksums.map((file) => {
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${hash}  ${relative(outDir, file).split("\\").join("/")}`;
});
writeFileSync(join(outDir, "CHECKSUMS.txt"), `${lines.join("\n")}\n`, "utf8");

const totalBytes = checksums.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `Eksport gry: ${relative(ROOT, outDir)} · ${checksums.length + 1} plików · ${(totalBytes / 1024).toFixed(0)} kB · CSP hash ${hashes.length} · hosting/ ${readdirSync(hosting).length} konfiguracji`
);
