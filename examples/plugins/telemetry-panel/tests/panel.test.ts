import { EventBus } from "../../../../packages/engine/src/systems/EventBus";
import { Logger } from "../../../../packages/engine/src/systems/Logger";
import { PluginHost } from "../../../../packages/engine/src/plugins/host";
import { ENGINE_VERSION } from "../../../../packages/engine/src/version";
import { createTelemetryPanelPlugin } from "../src/index";

const buildHost = (events = new EventBus()): PluginHost =>
  new PluginHost({
    engineVersion: ENGINE_VERSION,
    logger: new Logger("example", "error"),
    events,
    services: {
      scenes: { list: () => [], activeId: () => null },
      assets: { ids: () => [], isLoaded: () => false }
    }
  });

describe("telemetry-panel example", () => {
  it("installs with a valid manifest", () => {
    const plugins = buildHost();
    expect(plugins.install(createTelemetryPanelPlugin())).toMatchObject({ id: "telemetry-panel", state: "installed" });
    expect(plugins.get("telemetry-panel")?.state).toBe("installed");
  });

  it("mounts a panel that reports the active core", async () => {
    const plugins = buildHost();
    plugins.install(createTelemetryPanelPlugin());
    await plugins.activateAll();
    const parent = document.createElement("div");
    expect(plugins.getPanels().mount("telemetry", parent)).toBe(true);
    expect(parent.textContent).toContain("core");
    expect(parent.textContent).toContain("typescript");
    plugins.getPanels().unmount("telemetry");
    expect(parent.childElementCount).toBe(0);
  });

  it("accepts the core:ready announcement and stays active", async () => {
    const events = new EventBus();
    const plugins = buildHost(events);
    plugins.install(createTelemetryPanelPlugin());
    await plugins.activateAll();
    const parent = document.createElement("div");
    plugins.getPanels().mount("telemetry", parent);
    events.emit("core:ready", { impl: "cpp", abi: 1 });
    expect(plugins.get("telemetry-panel")?.state).toBe("active");
    expect(plugins.getSystems().some((system) => system.name === "telemetry" && system.owner === "telemetry-panel")).toBe(true);
  });
});
