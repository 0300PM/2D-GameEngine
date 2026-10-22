export const loadChromium = async () => {
  try {
    const module = await import("playwright");
    return module.chromium;
  } catch (error) {
    console.error("Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium");
    console.error(String(error));
    process.exit(1);
  }
};

export const launchBrowser = async () => {
  const chromium = await loadChromium();
  return chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
};

export const observe = (page) => {
  const state = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error.message ?? error)));
  page.on("response", (response) => {
    if (response.status() >= 400) state.failedRequests.push(`${response.url()} (HTTP ${response.status()})`);
  });
  return state;
};

export const waitForBoot = async (page, timeout = 20000) => {
  await page.waitForFunction(() => !!document.querySelector("#game-container canvas"), null, { timeout });
  await page.waitForFunction(() => window.engine?.isRunning?.() === true, null, { timeout });
};

export const createReporter = (name) => {
  const checks = [];
  return {
    name,
    checks,
    check(label, ok, detail = "") {
      checks.push({ label, ok, detail });
      console.log(`  ${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    },
    finish(observed) {
      const ok = checks.every((entry) => entry.ok);
      console.log(`${ok ? "OK  " : "BŁĄD"} ${name} (${checks.length} sprawdzeń)`);
      return {
        name,
        ok,
        checks,
        consoleErrors: observed?.consoleErrors ?? [],
        pageErrors: observed?.pageErrors ?? [],
        failedRequests: observed?.failedRequests ?? []
      };
    }
  };
};

export const summarise = (label, results, argv = process.argv) => {
  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${label}: ${results.length - failed.length}/${results.length} OK`);
  if (argv.includes("--json=1")) console.log(JSON.stringify(results, null, 2));
  if (failed.length > 0) {
    for (const scenario of failed) {
      for (const check of scenario.checks.filter((entry) => !entry.ok)) {
        console.error(`  ${scenario.name}: ${check.label} ${check.detail}`);
      }
    }
    process.exit(1);
  }
};
