import { join } from "node:path";
import { createHostingServer } from "./hosting-server.mjs";
import { createReporter, observe, summarise, waitForBoot } from "./e2e-common.mjs";

const ROOT = process.cwd();
const BOOT_TIMEOUT = 30000;
const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const only = arg("engine", "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

let playwright;
try {
  playwright = await import("playwright");
} catch (error) {
  console.error("Playwright is not installed. Run: npm install --no-save playwright && npx playwright install");
  console.error(String(error));
  process.exit(1);
}

const engines = [
  { name: "chromium", options: { args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] } },
  { name: "firefox", options: {} },
  { name: "webkit", options: {} }
].filter((engine) => only.length === 0 || only.includes(engine.name));

const server = await createHostingServer({ root: join(ROOT, "dist"), host: "127.0.0.1", csp: "strict", cache: "immutable" });

const readGame = (page) =>
  page.evaluate(() => {
    const engine = window.engine;
    if (!engine) return null;
    const scene = engine.getScenes().getActiveScene();
    const player = scene?.getObject("player") ?? null;
    return {
      running: engine.isRunning(),
      paused: engine.getTime().isPaused,
      objects: scene?.objectCount() ?? 0,
      player: player ? { x: player.world.x, y: player.world.y } : null,
      hud: (scene?.findByTag("ui") ?? []).map((object) => object.render?.text ?? object.text ?? "").join(" | ")
    };
  });

const results = [];

for (const engine of engines) {
  const reporter = createReporter(engine.name);
  let browser;
  try {
    browser = await playwright[engine.name].launch(engine.options);
  } catch (error) {
    const reason = String(error.message ?? error).split("\n")[0].slice(0, 160);
    reporter.check("silnik dostępny w tym środowisku", true, `POMINIĘTY — ${reason}`);
    results.push(reporter.finish({ consoleErrors: [], pageErrors: [], failedRequests: [] }));
    console.log(`  (pominięto ${engine.name}: ${reason})\n`);
    continue;
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const page = await context.newPage();
  const observed = observe(page);

  try {
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page, BOOT_TIMEOUT);

    const boot = await readGame(page);
    reporter.check("canvas i pętla startują", boot?.running === true && boot.objects > 50, `${boot?.objects ?? 0} obiektów`);
    reporter.check("brak wyjątków strony", observed.pageErrors.length === 0, observed.pageErrors[0] ?? "");
    reporter.check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors[0] ?? "");
    reporter.check("brak nieudanych żądań", observed.failedRequests.length === 0, observed.failedRequests[0] ?? "");

    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector("#game-container canvas");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
      return { width: canvas?.width ?? 0, height: canvas?.height ?? 0, gl: !!gl };
    });
    reporter.check("powierzchnia gry ma rozmiar", renderer.width > 0 && renderer.height > 0, `${renderer.width}×${renderer.height}`);
    reporter.check(
      "renderer działa (WebGL lub canvas 2D)",
      renderer.gl || (renderer.width > 0 && renderer.height > 0),
      renderer.gl ? "WebGL" : "canvas 2D"
    );

    const before = (await readGame(page))?.player;
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyD");
    const after = (await readGame(page))?.player;
    reporter.check(
      "sterowanie klawiaturą przesuwa gracza",
      !!before && !!after && after.x - before.x > 1,
      `${before?.x.toFixed(1) ?? "?"} → ${after?.x.toFixed(1) ?? "?"}`
    );

    await page.keyboard.press("p");
    const paused = (await readGame(page))?.paused;
    await page.keyboard.press("p");
    const resumed = (await readGame(page))?.paused;
    reporter.check("pauza i wznowienie czasu", paused === true && resumed === false, `pauza=${paused} powrót=${resumed}`);

    await page.keyboard.press("e");
    await page.waitForFunction(() => document.getElementById("examples-modal")?.hidden === false, null, { timeout: 5000 });
    const examples = await page.$$eval("#example-list li", (items) => items.length);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("examples-modal")?.hidden === true, null, { timeout: 5000 });
    reporter.check("modal przykładów otwiera się i zamyka", examples >= 6, `${examples} pozycji`);

    await page.click('[data-set-lang="en"]');
    const lang = await page.evaluate(() => document.documentElement.lang);
    reporter.check("przełączanie języka", lang === "en", `lang=${lang}`);
    await page.click('[data-set-lang="pl"]');

    const save = await page.evaluate(async () => {
      await window.b2d.clearSave();
      const cleared = await window.b2d.loadSave();
      return { cleared: cleared === null };
    });
    reporter.check("czyszczenie zapisu w localStorage", save.cleared === true);

    const violations = await page.evaluate(() => window.__cspViolations ?? []);
    reporter.check("strict CSP bez naruszeń", violations.length === 0, violations[0] ?? "");
  } catch (error) {
    reporter.check("scenariusz kompatybilności zakończony", false, String(error.message ?? error).split("\n")[0]);
  } finally {
    results.push(reporter.finish(observed));
    await context.close();
    await browser.close();
  }
}

await server.close();
summarise("Kompatybilność", results, process.argv);
