import { join } from "node:path";
import { createHostingServer } from "./hosting-server.mjs";
import { createReporter, launchBrowser, observe, summarise, waitForBoot } from "./e2e-common.mjs";

const DEVICES = [
  { id: "desktop", viewport: { width: 1440, height: 900 } },
  { id: "laptop", viewport: { width: 1280, height: 800 } },
  { id: "tablet", viewport: { width: 820, height: 1180 }, hasTouch: true },
  { id: "phone", viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 },
  { id: "phone-small", viewport: { width: 320, height: 568 }, hasTouch: true, deviceScaleFactor: 2 }
];

const server = await createHostingServer({ root: join(process.cwd(), "dist"), host: "127.0.0.1", csp: "strict" });
const browser = await launchBrowser();
const results = [];

const measure = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("#game-container canvas");
    const rect = canvas?.getBoundingClientRect();
    const scroller = document.documentElement;
    const buttons = [...document.querySelectorAll("header button")].map((button) => {
      const box = button.getBoundingClientRect();
      return { id: button.id || button.textContent?.trim().slice(0, 12), width: box.width, height: box.height, right: box.right, top: box.top };
    });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: scroller.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      canvas: rect ? { width: rect.width, height: rect.height, ratio: rect.width / rect.height } : null,
      buttons,
      canvasCount: document.querySelectorAll("#game-container canvas").length
    };
  });

for (const device of DEVICES) {
  const context = await browser.newContext({
    viewport: device.viewport,
    hasTouch: Boolean(device.hasTouch),
    isMobile: Boolean(device.hasTouch),
    deviceScaleFactor: device.deviceScaleFactor ?? 1
  });
  const page = await context.newPage();
  const observed = observe(page);
  const reporter = createReporter(device.id);
  const { check } = reporter;

  try {
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForBoot(page);
    const metrics = await measure(page);
    check("canvas istnieje", metrics.canvasCount === 1);
    check("brak poziomego przewijania", metrics.scrollWidth <= metrics.viewport.width + 1, `${metrics.scrollWidth} ≤ ${metrics.viewport.width}`);
    check("canvas zachowuje proporcje 16:9", Math.abs((metrics.canvas?.ratio ?? 0) - 16 / 9) < 0.02, (metrics.canvas?.ratio ?? 0).toFixed(3));
    check("canvas mieści się w ekranie", (metrics.canvas?.width ?? 0) <= metrics.viewport.width && (metrics.canvas?.height ?? 0) <= metrics.viewport.height);
    const offscreen = metrics.buttons.filter((button) => button.right > metrics.viewport.width + 1 || button.top < 0);
    check("przyciski nagłówka w ekranie", offscreen.length === 0, offscreen.map((button) => button.id).join(","));
    const small = metrics.buttons.filter((button) => button.height < 24 || button.width < 24);
    check("cele dotykowe ≥ 24 px", small.length === 0, small.map((button) => `${button.id}:${Math.round(button.width)}x${Math.round(button.height)}`).join(","));
    check("brak błędów konsoli", observed.consoleErrors.length === 0, observed.consoleErrors[0] ?? "");

    await page.keyboard.press("KeyE");
    await page.waitForTimeout(350);
    const modal = await page.evaluate(() => {
      const element = document.getElementById("examples-modal");
      const list = document.getElementById("example-list");
      return { open: !element.hidden, items: list?.children.length ?? 0 };
    });
    check("katalog przykładów otwiera się", modal.open && modal.items > 0, `${modal.items} pozycji`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    if (device.hasTouch) {
      const box = await page.evaluate(() => {
        const canvas = document.querySelector("#game-container canvas");
        const rect = canvas.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      await page.touchscreen.tap(box.x, box.y);
      await page.waitForTimeout(250);
      const alive = await page.evaluate(() => window.engine.isRunning() && !!document.querySelector("#game-container canvas"));
      check("dotyk nie zatrzymuje gry", alive);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check("brak przewijania po dotyku", overflow);
    }

    check("brak wyjątków strony", observed.pageErrors.length === 0, observed.pageErrors[0] ?? "");
    check("brak nieudanych żądań", observed.failedRequests.length === 0, observed.failedRequests[0] ?? "");
  } finally {
    results.push(reporter.finish(observed));
    await context.close();
  }
}

const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const reducedPage = await reduced.newPage();
const reducedObserver = observe(reducedPage);
const reducedReporter = createReporter("reduced-motion");
try {
  await reducedPage.goto(server.url, { waitUntil: "domcontentloaded" });
  await waitForBoot(reducedPage);
  const state = await reducedPage.evaluate(() => ({
    running: window.engine.isRunning(),
    animations: typeof document.getAnimations === "function" ? document.getAnimations().length : 0
  }));
  reducedReporter.check("gra działa z prefers-reduced-motion", state.running === true);
  reducedReporter.check("brak animacji CSS blokujących start", state.animations < 12, `${state.animations} animacji`);
  reducedReporter.check("brak błędów konsoli", reducedObserver.consoleErrors.length === 0, reducedObserver.consoleErrors[0] ?? "");
} finally {
  results.push(reducedReporter.finish(reducedObserver));
  await reduced.close();
}

const resize = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const resizePage = await resize.newPage();
const resizeObserver = observe(resizePage);
const resizeReporter = createReporter("resize");
try {
  await resizePage.goto(server.url, { waitUntil: "domcontentloaded" });
  await waitForBoot(resizePage);
  const before = await measure(resizePage);
  await resizePage.setViewportSize({ width: 900, height: 620 });
  await resizePage.waitForTimeout(400);
  const after = await measure(resizePage);
  resizeReporter.check("canvas skaluje się po zmianie rozmiaru", (after.canvas?.width ?? 0) < (before.canvas?.width ?? 0), `${Math.round(before.canvas.width)} → ${Math.round(after.canvas.width)}`);
  resizeReporter.check("brak przewijania po zmianie rozmiaru", after.scrollWidth <= after.viewport.width + 1, `${after.scrollWidth} ≤ ${after.viewport.width}`);
  resizeReporter.check("silnik nadal działa", await resizePage.evaluate(() => window.engine.isRunning()));
  resizeReporter.check("brak błędów konsoli", resizeObserver.consoleErrors.length === 0, resizeObserver.consoleErrors[0] ?? "");
} finally {
  results.push(resizeReporter.finish(resizeObserver));
  await resize.close();
}

await browser.close();
await server.close();

summarise("Matryca urządzeń", results, process.argv);
