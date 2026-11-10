import type { PluginContext, PluginDefinition, PluginManifest } from "@engine";

const manifest: PluginManifest = {
  id: "telemetry-panel",
  version: "1.0.0",
  engine: "^0.1.0",
  name: "Native telemetry",
  description: "Reports the active core implementation, ABI and loop throughput in a panel.",
  author: "Browser2DEngine examples",
  permissions: ["systems", "panels", "events"]
};

type Sample = {
  impl: string;
  abi: number;
  frames: number;
  elapsed: number;
  ticksPerSecond: number;
};

const row = (label: string, value: string): HTMLElement => {
  const element = document.createElement("div");
  element.className = "plugin-row";
  const name = document.createElement("span");
  name.textContent = label;
  const data = document.createElement("strong");
  data.textContent = value;
  element.append(name, data);
  return element;
};

const render = (container: HTMLElement, sample: Sample): void => {
  container.replaceChildren(
    row("core", sample.impl),
    row("abi", String(sample.abi)),
    row("frames", String(sample.frames)),
    row("game time", `${sample.elapsed.toFixed(1)} s`),
    row("ticks/s", String(sample.ticksPerSecond))
  );
};

export const createTelemetryPanelPlugin = (): PluginDefinition => {
  const sample: Sample = { impl: "typescript", abi: 0, frames: 0, elapsed: 0, ticksPerSecond: 0 };
  let container: HTMLElement | null = null;
  let lastPaint = 0;

  return {
    manifest,
    activate(context: PluginContext): void {
      context.events.on<{ impl: string; abi: number }>("core:ready", (payload) => {
        sample.impl = payload.impl;
        sample.abi = payload.abi;
      });

      context.systems.register(
        "telemetry",
        (deltaTime: number) => {
          sample.frames += 1;
          sample.elapsed += deltaTime;
          if (!container || sample.elapsed - lastPaint < 0.25) return;
          lastPaint = sample.elapsed;
          sample.ticksPerSecond = sample.elapsed > 0 ? Math.round(sample.frames / sample.elapsed) : 0;
          render(container, sample);
        },
        { order: 250 }
      );

      context.panels.register({
        id: "telemetry",
        title: "Native telemetry",
        order: 20,
        mount: (parent: HTMLElement) => {
          const element = document.createElement("div");
          element.className = "plugin-panel";
          parent.appendChild(element);
          container = element;
          render(element, sample);
          return () => {
            element.remove();
            container = null;
          };
        }
      });

      context.onDispose(() => {
        sample.frames = 0;
        sample.elapsed = 0;
        sample.ticksPerSecond = 0;
      });
    },
    deactivate(): void {
      container = null;
    }
  };
};
