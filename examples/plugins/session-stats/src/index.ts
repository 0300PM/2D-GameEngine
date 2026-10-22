import type { PluginContext, PluginDefinition, PluginManifest } from "@engine";

const manifest: PluginManifest = {
  id: "session-stats",
  version: "1.0.0",
  engine: "^0.1.0",
  name: "Session stats",
  description: "Sample plugin: counts time, frames and collected pickups, and shows them in a panel.",
  author: "Browser2DEngine examples",
  permissions: ["systems", "panels", "events", "storage"]
};

type Stats = {
  elapsed: number;
  frames: number;
  collected: number;
  best: number;
};

const createRow = (label: string, value: string): HTMLElement => {
  const row = document.createElement("div");
  row.className = "plugin-row";
  const name = document.createElement("span");
  name.textContent = label;
  const data = document.createElement("strong");
  data.textContent = value;
  row.append(name, data);
  return row;
};

const renderPanel = (container: HTMLElement, stats: Stats): void => {
  container.replaceChildren(
    createRow("time", `${stats.elapsed.toFixed(1)} s`),
    createRow("frames", String(stats.frames)),
    createRow("collected", String(stats.collected)),
    createRow("best score", String(stats.best))
  );
};

export const createSessionStatsPlugin = (): PluginDefinition => {
  const stats: Stats = { elapsed: 0, frames: 0, collected: 0, best: 0 };
  let panelContainer: HTMLElement | null = null;
  let lastRender = 0;

  return {
    manifest,
    activate(context: PluginContext): void {
      stats.best = Number(context.storage.get("best") ?? 0) || 0;
      stats.elapsed = 0;
      stats.frames = 0;
      stats.collected = 0;
      lastRender = 0;

      context.events.on<{ score: number }>("game:collected", (payload) => {
        stats.collected += 1;
        if (payload.score > stats.best) {
          stats.best = payload.score;
          context.storage.set("best", String(stats.best));
        }
      });

      context.systems.register(
        "sampler",
        (deltaTime: number) => {
          stats.elapsed += deltaTime;
          stats.frames += 1;
          if (!panelContainer || stats.elapsed - lastRender < 0.25) return;
          lastRender = stats.elapsed;
          renderPanel(panelContainer, stats);
        },
        { order: 200 }
      );

      context.panels.register({
        id: "session-stats",
        title: "Session stats",
        order: 10,
        mount: (parent: HTMLElement) => {
          const element = document.createElement("div");
          element.className = "plugin-panel";
          parent.appendChild(element);
          panelContainer = element;
          renderPanel(element, stats);
          return () => {
            element.remove();
            panelContainer = null;
          };
        }
      });

      context.onDispose(() => {
        stats.elapsed = 0;
        stats.frames = 0;
        stats.collected = 0;
      });

      context.logger.info("session stats ready", { best: stats.best });
    },
    deactivate(): void {
      panelContainer = null;
    }
  };
};
