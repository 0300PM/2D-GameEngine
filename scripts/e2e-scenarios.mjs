import { join } from "node:path";
import { createHostingServer } from "./hosting-server.mjs";
import { createReporter, launchBrowser, observe, summarise, waitForBoot } from "./e2e-common.mjs";

const ROOT = process.cwd();
const server = await createHostingServer({ root: join(ROOT, "dist"), host: "127.0.0.1", csp: "none" });
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const observed = observe(page);
const reporter = createReporter("scenarios");
const { check } = reporter;

const readGame = () =>
  page.evaluate(() => {
    const engine = window.engine;
    if (!engine) return null;
    const scene = engine.getScenes().getActiveScene();
    const player = scene?.getObject("player") ?? null;
    return {
      sceneId: engine.getScenes().getActiveSceneId(),
      running: engine.isRunning(),
      paused: engine.getTime().isPaused,
      timeScale: engine.getTime().timeScale,
      audio: engine.getAudio().getState(),
      player: player ? { x: player.world.x, y: player.world.y } : null,
      crystals: (scene?.findByTag("collectible") ?? []).map((crystal) => ({ x: crystal.world.x, y: crystal.world.y })),
      ui: (scene?.findByTag("ui") ?? []).map((object) => object.render?.text ?? object.text ?? ""),
      objects: scene?.objectCount() ?? 0
    };
  });

const held = new Set();
const press = async (codes) => {
  for (const code of [...held]) {
    if (!codes.has(code)) {
      await page.keyboard.up(code);
      held.delete(code);
    }
  }
  for (const code of codes) {
    if (!held.has(code)) {
      await page.keyboard.down(code);
      held.add(code);
    }
  }
};
const releaseAll = () => press(new Set());

const steerUntil = async (predicate, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAt = Date.now();
  while (Date.now() < deadline) {
    const state = await readGame();
    if (!state || !state.player) return null;
    if (predicate(state)) {
      await releaseAll();
      return state;
    }
    const target = state.crystals
      .map((crystal) => ({ ...crystal, distance: Math.hypot(crystal.x - state.player.x, crystal.y - state.player.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!target) break;
    if (target.distance < bestDistance - 8) {
      bestDistance = target.distance;
      bestAt = Date.now();
    }
    if (Date.now() - bestAt > 6000) break;
    const keys = new Set();
    if (target.x - state.player.x > 12) keys.add("KeyD");
    if (target.x - state.player.x < -12) keys.add("KeyA");
    if (target.y - state.player.y > 12) keys.add("KeyS");
    if (target.y - state.player.y < -12) keys.add("KeyW");
    await press(keys);
    if (process.env.B2D_E2E_DEBUG) console.log('    steer', Math.round(state.player.x), Math.round(state.player.y), `d=${Math.round(target.distance)}`, [...keys].join('+'));
    await page.waitForTimeout(90);
  }
  await releaseAll();
  return readGame();
};

try {
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  const boot = await readGame();
  check("scena startowa to game", boot?.sceneId === "game", String(boot?.sceneId));
  check("silnik działa", boot?.running === true);
  check("scena ma obiekty", (boot?.objects ?? 0) > 50, `${boot?.objects} obiektów`);
  check("brak błędów konsoli po starcie", observed.consoleErrors.length === 0, observed.consoleErrors[0] ?? "");

  const startX = boot.player.x;
  await press(new Set(["KeyD"]));
  await page.waitForTimeout(900);
  await releaseAll();
  const moved = await readGame();
  check("ruch w prawo przesuwa gracza", moved.player.x - startX > 15, `dx ${Math.round(moved.player.x - startX)} px`);

  await press(new Set(["KeyA"]));
  await page.waitForTimeout(900);
  await releaseAll();
  await page.waitForTimeout(150);
  const leftEdge = await readGame();
  check("kolizja ze ścianą trzyma gracza w świecie", leftEdge.player.x > 0, `x ${Math.round(leftEdge.player.x)}`);

  const beforeAudio = (await readGame()).audio;
  await page.keyboard.press("KeyN");
  const mutedChanged = await page
    .waitForFunction((before) => window.engine.getAudio().getState().muted !== before, beforeAudio.muted, { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  const afterAudio = (await readGame()).audio;
  check("klawisz N przełącza wyciszenie", mutedChanged, `${beforeAudio.muted} → ${afterAudio.muted}`);

  const collected = await steerUntil((state) => state.crystals.length < 8, 25000);
  check("bot zbiera kryształ", (collected?.crystals.length ?? 8) < 8, `${collected?.crystals.length} pozostało`);
  const hud = collected?.ui.join(" ") ?? "";
  check("HUD pokazuje wynik", /\d\s*\/\s*8/.test(hud), hud.slice(0, 60));

  await page.keyboard.press("KeyP");
  await page.waitForTimeout(200);
  const paused = await readGame();
  check("P pauzuje czas", paused.paused === true);
  const frozen = paused.player.x;
  await press(new Set(["KeyD"]));
  await page.waitForTimeout(350);
  await releaseAll();
  const stillFrozen = await readGame();
  check("pauza zatrzymuje ruch", Math.abs(stillFrozen.player.x - frozen) < 2, `dx ${Math.round(stillFrozen.player.x - frozen)}`);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(200);
  check("P wznawia czas", (await readGame()).paused === false);

  const collectedCount = 8 - (collected?.crystals.length ?? 8);
  await page.keyboard.press("KeyR");
  await page.waitForFunction(
    () => (window.engine.getScenes().getActiveScene()?.findByTag("collectible")?.length ?? 0) > 0,
    null,
    { timeout: 15000 }
  );
  const restarted = await readGame();
  check("R odtwarza scenę gry", restarted.sceneId === "game" && restarted.objects > 50, `${restarted.objects} obiektów`);
  check(
    "restart zachowuje zebrane kryształy",
    restarted.crystals.length === 8 - collectedCount,
    `${restarted.crystals.length} kryształów po zebraniu ${collectedCount}`
  );

  await page.keyboard.press("KeyE");
  await page.waitForTimeout(400);
  const modalOpen = await page.evaluate(() => !document.getElementById("examples-modal").hidden);
  check("E otwiera katalog przykładów", modalOpen);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const modalClosed = await page.evaluate(() => document.getElementById("examples-modal").hidden);
  check("Escape zamyka katalog", modalClosed);

  await page.evaluate(() => {
    const button = document.getElementById("debug-toggle");
    button.click();
  });
  await page.waitForTimeout(350);
  const debug = await page.evaluate(() => {
    const panel = document.getElementById("debug-panel");
    const summary = document.getElementById("debug-plugin-summary");
    return {
      open: !panel.hidden,
      plugins: summary?.textContent?.trim() ?? "",
      rows: document.querySelectorAll("#plugin-panels .plugin-row").length
    };
  });
  check("panel debugowania się otwiera", debug.open);
  check("panel pokazuje pluginy", /1\/1/.test(debug.plugins), debug.plugins);
  check("panel listuje wiersze pluginu", debug.rows >= 3, `${debug.rows} wierszy`);

  const report = await page.evaluate(() => {
    const value = window.engine.getDiagnosticsReport();
    return {
      keys: Object.keys(value),
      scene: value.scene?.id,
      objects: value.scene?.objects,
      plugins: value.plugins?.total,
      findings: value.findings.length
    };
  });
  check("raport diagnostyczny ma sekcje", ["config", "time", "scene", "assets", "physics", "profiler", "logs", "plugins", "findings"].every((key) => report.keys.includes(key)), report.keys.join(","));
  check("raport wskazuje scenę gry", report.scene === "game", String(report.scene));
  check("raport liczy plugin", report.plugins === 1, String(report.plugins));

  const saved = await page.evaluate(() => window.b2d.loadSave());
  check("zapis gracza istnieje po zebraniu", saved !== null && saved !== undefined, JSON.stringify(saved)?.slice(0, 60));

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  const restored = await page
    .waitForFunction(
      () =>
        (window.engine.getScenes().getActiveScene()?.findByTag("ui") ?? []).some((object) =>
          /[1-8]\s*\/\s*8/.test(object.render?.text ?? "")
        ),
      null,
      { timeout: 10000 }
    )
    .then(() => true)
    .catch(() => false);
  const reloaded = await page.evaluate(() => ({
    scene: window.engine.getScenes().getActiveSceneId(),
    example: new URLSearchParams(window.location.search).get("example"),
    ui: (window.engine.getScenes().getActiveScene()?.findByTag("ui") ?? []).map((object) => object.render?.text ?? "")
  }));
  check("po odświeżeniu wraca ten sam przykład", reloaded.example === "top-down" && reloaded.scene === "game", `${reloaded.example}/${reloaded.scene}`);
  check("postęp zapisu wraca po odświeżeniu", restored, reloaded.ui.join(" ").slice(0, 40));

  await page.evaluate(() => window.b2d.clearSave());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoot(page);
  const cleared = await page.evaluate(() => ({
    crystals: (window.engine.getScenes().getActiveScene()?.findByTag("collectible") ?? []).length,
    ui: (window.engine.getScenes().getActiveScene()?.findByTag("ui") ?? []).map((object) => object.render?.text ?? "")
  }));
  check("wyczyszczony zapis przywraca pełną planszę", cleared.crystals === 8, `${cleared.crystals} kryształów`);
  check("wyczyszczony zapis zeruje HUD", cleared.ui.some((text) => /0\s*\/\s*8/.test(text)), cleared.ui.join(" ").slice(0, 40));
} finally {
  await releaseAll();
  await context.close();
}

const results = [reporter.finish(observed)];

const resilient = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const missingPage = await resilient.newPage();
const missingObserver = observe(missingPage);
const missingReporter = createReporter("missing-asset");
try {
  await missingPage.route("**/assets/player.png", (route) => route.fulfill({ status: 404, body: "gone" }));
  await missingPage.goto(server.url, { waitUntil: "domcontentloaded" });
  await waitForBoot(missingPage);
  await missingPage.waitForTimeout(800);
  const state = await missingPage.evaluate(() => {
    const report = window.b2d.assetReport();
    const scene = window.engine.getScenes().getActiveScene();
    return {
      running: window.engine.isRunning(),
      canvas: !!document.querySelector("#game-container canvas"),
      objects: scene?.objectCount() ?? 0,
      failed: report.failures.map((failure) => failure.id),
      failedCount: report.counts.failed,
      bootError: document.getElementById("boot-error")?.classList.contains("on") ?? false
    };
  });
  missingReporter.check("gra startuje bez pliku gracza", state.running && state.canvas && state.objects > 50, `${state.objects} obiektów`);
  missingReporter.check("ekran błędu startowego się nie pokazuje", state.bootError === false);
  missingReporter.check("raport zasobów wskazuje brakujący plik", state.failed.includes("player"), state.failed.join(","));
  missingReporter.check("brak wyjątków strony", missingObserver.pageErrors.length === 0, missingObserver.pageErrors[0] ?? "");
} finally {
  results.push(missingReporter.finish(missingObserver));
  await resilient.close();
  await server.close();
}

summarise("Scenariusze", results, process.argv);
