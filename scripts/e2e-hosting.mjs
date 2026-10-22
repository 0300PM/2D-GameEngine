import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHostingServer } from "./hosting-server.mjs";

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, "dist");
const BOOT_TIMEOUT = 20000;

const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error('Missing dist/index.html. Run "npm run build" first.');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium");
  console.error(String(error));
  process.exit(1);
}

const selfSigned = () => {
  const dir = mkdtempSync(join(tmpdir(), "b2d-tls-"));
  const key = join(dir, "key.pem");
  const cert = join(dir, "cert.pem");
  execFileSync("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=127.0.0.1"
  ]);
  return { key: readFileSync(key), cert: readFileSync(cert) };
};

const browser = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });

const observe = (page) => {
  const state = { consoleErrors: [], pageErrors: [], failedRequests: [], cspViolations: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error.message ?? error)));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "failed";
    if (reason.includes("ERR_ABORTED") && request.url().endsWith("favicon.ico")) return;
    state.failedRequests.push(`${request.url()} (${reason})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("favicon.ico")) {
      state.failedRequests.push(`${response.url()} (HTTP ${response.status()})`);
    }
  });
  page.on("console", () => undefined);
  page.on("dialog", (dialog) => void dialog.dismiss());
  return state;
};

const waitForBoot = async (page, timeout = BOOT_TIMEOUT) => {
  await page.waitForFunction(() => !!document.querySelector("#game-container canvas"), null, { timeout });
};

const bootFailed = (page) =>
  page.evaluate(() => document.getElementById("boot-error")?.classList.contains("on") ?? false);

const runScenario = async (name, options, body) => {
  const server = await createHostingServer({ root: DIST, host: "127.0.0.1", ...options });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const observed = observe(page);
  const checks = [];
  const check = (label, ok, detail = "") => {
    checks.push({ label, ok, detail });
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  };
  try {
    await body({ page, server, check, observed, context });
  } catch (error) {
    checks.push({ label: "wyjątek scenariusza", ok: false, detail: String(error?.message ?? error) });
    console.log(`  FAIL wyjątek scenariusza — ${error?.message ?? error}`);
  }
  await context.close();
  await server.close();
  const ok = checks.every((entry) => entry.ok);
  console.log(`${ok ? "OK  " : "BŁĄD"} ${name} (${checks.length} sprawdzeń)`);
  return { name, ok, checks, consoleErrors: observed.consoleErrors, pageErrors: observed.pageErrors, failedRequests: observed.failedRequests, cspViolations: observed.cspViolations };
};

const results = [];

results.push(
  await runScenario("http-root", {}, async ({ page, server, check, observed }) => {
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    check("canvas istnieje", true);
    check("ekran błędu ukryty", !(await bootFailed(page)));
    check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors.join(" | "));
    check("brak wyjątków strony", observed.pageErrors.length === 0, observed.pageErrors.join(" | "));
    check("brak nieudanych żądań", observed.failedRequests.length === 0, observed.failedRequests.slice(0, 3).join(" | "));
    const meta = await page.evaluate(() => ({
      build: document.querySelector('meta[name="b2d-build"]')?.content ?? "",
      base: document.querySelector('meta[name="b2d-base"]')?.content ?? ""
    }));
    check("meta build obecny", meta.build.length > 0, meta.build);
    check("base względny", meta.base === "./", meta.base);
    const context = await page.evaluate(() => ({
      protocol: window.location.protocol,
      secure: window.isSecureContext
    }));
    check("protokół http", context.protocol === "http:", context.protocol);
    check("loopback liczony jako secure context (oczekiwane)", context.secure === true);
  })
);

results.push(
  await runScenario("http-subpath", { mount: "/game/" }, async ({ page, server, check, observed }) => {
    const requests = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    check("canvas istnieje", true);
    const assets = requests.filter((path) => path.includes("/assets/"));
    check("zasoby pod /game/assets/", assets.length > 0 && assets.every((path) => path.startsWith("/game/assets/")), assets.slice(0, 3).join(" | "));
    check("brak nieudanych żądań", observed.failedRequests.length === 0, observed.failedRequests.slice(0, 3).join(" | "));
    check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors.join(" | "));
  })
);

results.push(
  await runScenario("csp-strict", { csp: "strict" }, async ({ page, server, check, observed }) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    check("canvas istnieje pod CSP", true);
    check("ekran błędu ukryty", !(await bootFailed(page)));
    const violations = await page.evaluate(() => window.__cspViolations ?? []);
    check("brak naruszeń CSP", violations.length === 0, violations.slice(0, 3).join(" | "));
    check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors.join(" | "));
    const header = await page.evaluate(() => document.querySelector('meta[name="b2d-build"]')?.content ?? "");
    check("build liczony z metadanych", header.length > 0, header);
  })
);

results.push(
  await runScenario("https-csp", { csp: "strict", https: selfSigned() }, async ({ page, server, check, observed }) => {
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    check("canvas istnieje po HTTPS", true);
    const secure = await page.evaluate(() => ({
      secure: window.isSecureContext,
      protocol: window.location.protocol,
      isolated: window.crossOriginIsolated
    }));
    check("kontekst bezpieczny", secure.secure === true, String(secure.secure));
    check("protokół https", secure.protocol === "https:", secure.protocol);
    check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors.join(" | "));
  })
);

results.push(
  await runScenario("cache-immutable", { cache: "immutable" }, async ({ page, server, check }) => {
    const headers = new Map();
    page.on("response", (response) => headers.set(new URL(response.url()).pathname, response.headers()));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    await page.waitForTimeout(300);
    const indexCache = headers.get("/")?.["cache-control"] ?? "";
    const assetPath = [...headers.keys()].find((path) => path.startsWith("/assets/") && path.endsWith(".js"));
    const assetCache = assetPath ? headers.get(assetPath)?.["cache-control"] ?? "" : "";
    check("index.html no-cache", indexCache.includes("no-cache"), indexCache);
    check("js immutable", assetCache.includes("immutable"), assetCache);
    check("nosniff", (headers.get("/")?.["x-content-type-options"] ?? "") === "nosniff");
  })
);

results.push(
  await runScenario("refresh-state", {}, async ({ page, server, check }) => {
    await page.goto(`${server.url}?example=menu&lang=en`, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const read = () =>
      page.evaluate(() => ({
        lang: document.body.dataset.lang ?? "",
        htmlLang: document.documentElement.lang,
        example: new URLSearchParams(window.location.search).get("example"),
        title: document.getElementById("active-example")?.textContent ?? "",
        status: document.getElementById("status")?.textContent ?? ""
      }));
    const before = await read();
    check("język z URL", before.lang === "en" && before.htmlLang === "en", `${before.lang}/${before.htmlLang}`);
    check("przykład z URL", before.example === "menu", String(before.example));
    check("tytuł przykładu po angielsku", before.title.includes("Start screen"), before.title);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const after = await read();
    check("stan przeżywa odświeżenie", after.lang === "en" && after.example === "menu" && after.title === before.title, `${after.lang}/${after.example}/${after.title}`);
  })
);

results.push(
  await runScenario("missing-bundle", {}, async ({ page, server, check }) => {
    await page.route("**/assets/*.js", (route) => route.abort("failed"));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("boot-error")?.classList.contains("on"), null, { timeout: 15000 });
    check("ekran błędu widoczny", await bootFailed(page));
    const detail = await page.evaluate(() => ({
      message: document.getElementById("boot-error-detail")?.textContent ?? "",
      diag: document.getElementById("boot-diag-body")?.textContent ?? "",
      copy: !!document.getElementById("boot-copy"),
      download: !!document.getElementById("boot-download"),
      status: document.getElementById("status")?.textContent ?? ""
    }));
    check("komunikat wskazuje moduł", detail.message.length > 0, detail.message.slice(0, 90));
    check("diagnostyka wypełniona", detail.diag.includes("build:") && detail.diag.includes("error:"), detail.diag.split("\n")[0]);
    check("przycisk kopiowania", detail.copy);
    check("przycisk raportu", detail.download);
    check("pasek statusu pokazuje błąd", detail.status.toLowerCase().includes("błąd"), detail.status);
  })
);

results.push(
  await runScenario("unknown-path", {}, async ({ page, server, check, observed }) => {
    const response = await page.goto(`${server.url}nie-ma-takiej-strony`, { waitUntil: "domcontentloaded" });
    check("status 404", response?.status() === 404, String(response?.status()));
    const body = await page.evaluate(() => document.body.innerText);
    check("strona 404 po polsku", body.includes("nie istnieje"), body.slice(0, 60));
    check("strona 404 po angielsku", body.includes("does not exist"));
    const link = await page.evaluate(() => document.querySelector("main a")?.getAttribute("href") ?? "");
    check("link powrotny względny", link === "./", link);
    check("bez wyjątków strony", observed.pageErrors.length === 0, observed.pageErrors.join(" | "));
  })
);

await browser.close();

const failed = results.filter((entry) => !entry.ok);
console.log(`\nHosting: ${results.length - failed.length}/${results.length} scenariuszy OK`);
if (arg("json", "0") === "1") console.log(JSON.stringify(results, null, 2));
if (failed.length > 0) {
  for (const scenario of failed) {
    for (const check of scenario.checks.filter((entry) => !entry.ok)) {
      console.error(`  ${scenario.name}: ${check.label} ${check.detail}`);
    }
  }
  process.exit(1);
}
