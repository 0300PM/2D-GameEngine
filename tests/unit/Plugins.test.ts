import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginHost } from "../../packages/engine/src/plugins/host";
import { PluginError, PluginPermissionError } from "../../packages/engine/src/plugins/errors";
import { Logger } from "../../packages/engine/src/systems/Logger";
import { EventBus } from "../../packages/engine/src/systems/EventBus";
import type { PluginDefinition } from "../../packages/engine/src/plugins/types";
import type { PluginManifest } from "../../packages/engine/src/plugins/manifest";

const manifest = (patch: Partial<PluginManifest> = {}): PluginManifest => ({
  id: "demo",
  version: "1.0.0",
  engine: "^0.1.0",
  permissions: [],
  ...patch
});

const createHost = (options: { engineVersion?: string; maxFailures?: number } = {}) => {
  const logger = new Logger("test", "error");
  const events = new EventBus();
  const host = new PluginHost({
    engineVersion: options.engineVersion ?? "0.1.0",
    logger,
    events,
    maxFailures: options.maxFailures,
    services: {
      scenes: { list: () => ["menu", "game"], activeId: () => "game" },
      assets: {
        ids: () => ["player", "coin"],
        isLoaded: (id: string) => id === "player"
      },
      storage: () => (typeof localStorage === "undefined" ? null : localStorage)
    }
  });
  return { host, events, logger };
};

const plugin = (patch: Partial<PluginManifest> = {}, activate: PluginDefinition["activate"] = () => undefined): PluginDefinition => ({
  manifest: manifest(patch),
  activate
});

beforeEach(() => {
  localStorage.clear();
});

describe("installation", () => {
  it("installs a valid plugin", () => {
    const { host } = createHost();
    const status = host.install(plugin());
    expect(status.state).toBe("installed");
    expect(host.has("demo")).toBe(true);
    expect(host.list()).toHaveLength(1);
  });

  it("rejects an invalid manifest with issues attached", () => {
    const { host } = createHost();
    const invalid = { manifest: { id: "Bad Id", version: "1.0.0", engine: "^0.1.0" }, activate: () => undefined };
    try {
      host.install(invalid as unknown as PluginDefinition);
      throw new Error("expected install to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      const pluginError = error as PluginError;
      expect(pluginError.code).toBe("invalid-manifest");
      expect(pluginError.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown permissions", () => {
    const { host } = createHost();
    expect(() =>
      host.install(
        plugin({ permissions: ["unknown" as never] })
      )
    ).toThrow(/Unknown permission/);
  });

  it("rejects a duplicate id", () => {
    const { host } = createHost();
    host.install(plugin());
    expect(() => host.install(plugin())).toThrow(/already installed/);
  });

  it("rejects a plugin without activate", () => {
    const { host } = createHost();
    expect(() => host.install({ manifest: manifest() } as unknown as PluginDefinition)).toThrow(/activate/);
  });
});

describe("activation", () => {
  it("activates a plugin and emits an event", async () => {
    const { host, events } = createHost();
    const activated = vi.fn();
    events.on("plugin:activated", activated);
    host.install(plugin({}, () => undefined));
    await host.activate("demo");
    expect(host.get("demo")?.state).toBe("active");
    expect(activated).toHaveBeenCalledWith({ id: "demo" });
  });

  it("marks a plugin failed when the engine range does not match", async () => {
    const { host, events } = createHost({ engineVersion: "0.2.0" });
    const failed = vi.fn();
    events.on("plugin:failed", failed);
    host.install(plugin({ engine: "^1.0.0" }));
    await host.activate("demo");
    const status = host.get("demo");
    expect(status?.state).toBe("failed");
    expect(status?.lastError).toContain("incompatible-engine");
    expect(failed).toHaveBeenCalled();
  });

  it("fails when a dependency is missing", async () => {
    const { host } = createHost();
    host.install(plugin({ dependencies: { missing: "^1.0.0" } }));
    await host.activate("demo");
    expect(host.get("demo")?.lastError).toContain("missing-dependency");
  });

  it("fails when a dependency version does not satisfy the range", async () => {
    const { host } = createHost();
    host.install(plugin({ id: "base", version: "1.0.0" }));
    host.install(plugin({ id: "top", dependencies: { base: "^2.0.0" } }));
    await host.activate("top");
    expect(host.get("top")?.state).toBe("failed");
  });

  it("activates dependencies first", async () => {
    const { host } = createHost();
    const order: string[] = [];
    host.install(plugin({ id: "base" }, () => void order.push("base")));
    host.install(plugin({ id: "top", dependencies: { base: "^1.0.0" } }, () => void order.push("top")));
    await host.activate("top");
    expect(order).toEqual(["base", "top"]);
    expect(host.get("top")?.state).toBe("active");
  });

  it("detects dependency cycles", async () => {
    const { host } = createHost();
    host.install(plugin({ id: "a", dependencies: { b: "^1.0.0" } }));
    host.install(plugin({ id: "b", dependencies: { a: "^1.0.0" } }));
    await host.activate("a");
    expect(host.get("a")?.state).toBe("failed");
    expect(host.get("b")?.state).toBe("failed");
    expect(host.get("b")?.lastError).toContain("dependency-cycle");
  });

  it("isolates activation errors", async () => {
    const { host, events } = createHost();
    const failed = vi.fn();
    events.on("plugin:failed", failed);
    host.install(plugin({}, () => {
      throw new Error("boom");
    }));
    await host.activate("demo");
    expect(host.get("demo")?.state).toBe("failed");
    expect(host.get("demo")?.lastError).toContain("boom");
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("cleans registrations made before a failed activation", async () => {
    const { host } = createHost();
    host.install(
      plugin({ permissions: ["systems"] }, (ctx) => {
        ctx.systems.register("early", () => undefined);
        throw new Error("later failure");
      })
    );
    await host.activate("demo");
    expect(host.getSystems()).toHaveLength(0);
  });
});

describe("permissions", () => {
  it("denies capabilities that were not declared", async () => {
    const { host } = createHost();
    let permissionError: unknown = null;
    host.install(
      plugin({}, (ctx) => {
        try {
          ctx.systems.register("nope", () => undefined);
        } catch (error) {
          permissionError = error;
        }
        ctx.onDispose(() => undefined);
      })
    );
    await host.activate("demo");
    expect(permissionError).toBeInstanceOf(PluginPermissionError);
    expect((permissionError as PluginPermissionError).permission).toBe("systems");
  });

  it("grants capabilities after the permission is declared", async () => {
    const { host } = createHost();
    let scenes: string[] = [];
    let active: string | null = null;
    host.install(
      plugin({ permissions: ["scenes", "assets"] }, (ctx) => {
        scenes = ctx.scenes.list();
        active = ctx.scenes.activeId();
        expect(ctx.assets.isLoaded("player")).toBe(true);
        expect(ctx.assets.ids()).toEqual(["player", "coin"]);
      })
    );
    await host.activate("demo");
    expect(scenes).toEqual(["menu", "game"]);
    expect(active).toBe("game");
  });

  it("namespaces emitted events", async () => {
    const { host, events } = createHost();
    const received = vi.fn();
    events.on("plugin:demo:scored", received);
    host.install(plugin({ permissions: ["events"] }, (ctx) => {
      ctx.events.emit("scored", { points: 3 });
    }));
    await host.activate("demo");
    expect(received).toHaveBeenCalledWith({ points: 3 });
  });

  it("subscribes to engine events", async () => {
    const { host, events } = createHost();
    const received = vi.fn();
    host.install(plugin({ permissions: ["events"] }, (ctx) => {
      ctx.events.on("engine:started", received);
    }));
    await host.activate("demo");
    events.emit("engine:started", { ok: true });
    expect(received).toHaveBeenCalledWith({ ok: true });
  });

  it("scopes storage per plugin", async () => {
    const { host } = createHost();
    host.install(plugin({ id: "one", permissions: ["storage"] }, (ctx) => ctx.storage.set("key", "1")));
    await host.activate("one");
    host.install(plugin({ id: "two", permissions: ["storage"] }, (ctx) => ctx.storage.set("key", "2")));
    await host.activate("two");
    expect(localStorage.getItem("b2d:plugin:one:key")).toBe("1");
    expect(localStorage.getItem("b2d:plugin:two:key")).toBe("2");
  });
});

describe("systems", () => {
  it("ticks registered systems in order", async () => {
    const { host } = createHost();
    const calls: string[] = [];
    host.install(plugin({ permissions: ["systems"] }, (ctx) => {
      ctx.systems.register("late", () => void calls.push("late"), { order: 200 });
      ctx.systems.register("early", () => void calls.push("early"), { order: 10 });
    }));
    await host.activate("demo");
    host.update(0.016);
    expect(calls).toEqual(["early", "late"]);
  });

  it("disables a failing system after the failure budget", async () => {
    const { host, events } = createHost({ maxFailures: 2 });
    const disabled = vi.fn();
    events.on("plugin:system-disabled", disabled);
    let healthy = 0;
    host.install(plugin({ permissions: ["systems"] }, (ctx) => {
      ctx.systems.register("bad", () => {
        throw new Error("tick failed");
      });
      ctx.systems.register("good", () => void (healthy += 1));
    }));
    await host.activate("demo");
    host.update(0.016);
    host.update(0.016);
    host.update(0.016);
    expect(host.get("demo")?.lastError).toContain("tick failed");
    expect(disabled).toHaveBeenCalled();
    expect(healthy).toBe(3);
    expect(host.getSystems().find((system) => system.name === "bad")?.disabled).toBe(true);
  });

  it("re-enables a disabled system on request", async () => {
    const { host } = createHost({ maxFailures: 1 });
    host.install(plugin({ permissions: ["systems"] }, (ctx) => {
      ctx.systems.register("bad", () => {
        throw new Error("tick failed");
      });
    }));
    await host.activate("demo");
    host.update(0.016);
    expect(host.enableSystem("demo", "bad")).toBe(true);
    expect(host.getSystems()[0].disabled).toBe(false);
  });

  it("rejects duplicate system names per plugin", async () => {
    const { host } = createHost();
    let error: unknown = null;
    host.install(plugin({ permissions: ["systems"] }, (ctx) => {
      ctx.systems.register("dup", () => undefined);
      try {
        ctx.systems.register("dup", () => undefined);
      } catch (caught) {
        error = caught;
      }
    }));
    await host.activate("demo");
    expect((error as PluginError).code).toBe("duplicate-id");
  });
});

describe("importers and panels", () => {
  it("registers and uses an importer by extension", async () => {
    const { host } = createHost();
    host.install(
      plugin({ permissions: ["importers"] }, (ctx) => {
        ctx.importers.register({
          id: "csv-map",
          extensions: ["csv"],
          import: (data) => String(data).split(",")
        });
      })
    );
    await host.activate("demo");
    expect(host.getImporters().import(".CSV", "a,b,c")).toEqual(["a", "b", "c"]);
    expect(host.getImporters().list()[0].owner).toBe("demo");
  });

  it("rejects an extension that is already handled", async () => {
    const { host } = createHost();
    host.install(
      plugin({ id: "one", permissions: ["importers"] }, (ctx) => {
        ctx.importers.register({ id: "a", extensions: ["map"], import: () => null });
      })
    );
    host.install(
      plugin({ id: "two", permissions: ["importers"] }, (ctx) => {
        ctx.importers.register({ id: "b", extensions: ["map"], import: () => null });
      })
    );
    await host.activate("one");
    await host.activate("two");
    expect(host.get("two")?.state).toBe("failed");
    expect(host.get("two")?.lastError).toContain("duplicate-importer");
  });

  it("throws for an unknown importer extension", () => {
    const { host } = createHost();
    expect(() => host.getImporters().import("nope", {})).toThrow(/No importer/);
  });

  it("mounts and unmounts panels", async () => {
    const { host } = createHost();
    const parent = document.createElement("div");
    const cleanup = vi.fn();
    host.install(
      plugin({ permissions: ["panels"] }, (ctx) => {
        ctx.panels.register({
          id: "stats",
          title: "Stats",
          mount: (element) => {
            element.textContent = "stats";
            return cleanup;
          }
        });
      })
    );
    await host.activate("demo");
    expect(host.getPanels().mount("stats", parent)).toBe(true);
    expect(parent.textContent).toBe("stats");
    expect(host.getPanels().list()[0]).toMatchObject({ id: "stats", title: "Stats", owner: "demo" });
    expect(host.getPanels().unmount("stats")).toBe(true);
    expect(cleanup).toHaveBeenCalled();
  });
});

describe("teardown", () => {
  it("runs disposers in reverse order and purges registries", async () => {
    const { host } = createHost();
    const calls: string[] = [];
    host.install(
      plugin({ permissions: ["systems", "panels", "importers"] }, (ctx) => {
        ctx.systems.register("tick", () => undefined);
        ctx.panels.register({ id: "p", title: "P", mount: () => () => void calls.push("panel") });
        ctx.importers.register({ id: "i", extensions: ["i"], import: () => null });
        ctx.onDispose(() => calls.push("first"));
        ctx.onDispose(() => calls.push("second"));
      })
    );
    host.install(plugin({ id: "dependant", dependencies: { demo: "^1.0.0" } }));
    await host.activate("demo");
    await host.activate("dependant");
    await host.uninstall("demo");
    expect(calls).toEqual(["second", "first"]);
    expect(host.get("demo")).toBeUndefined();
    expect(host.get("dependant")?.state).toBe("inactive");
    expect(host.getSystems()).toHaveLength(0);
    expect(host.getPanels().list()).toHaveLength(0);
    expect(host.getImporters().list()).toHaveLength(0);
  });

  it("calls the plugin deactivate hook", async () => {
    const { host } = createHost();
    const deactivate = vi.fn();
    host.install({ manifest: manifest(), activate: () => undefined, deactivate });
    await host.activate("demo");
    await host.deactivate("demo");
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(host.get("demo")?.state).toBe("inactive");
  });

  it("disposes every plugin", async () => {
    const { host } = createHost();
    host.install(plugin({ id: "one" }));
    host.install(plugin({ id: "two" }));
    await host.activateAll();
    await host.dispose();
    expect(host.list()).toHaveLength(0);
  });
});

describe("summary", () => {
  it("reports counts and the permission audit", async () => {
    const { host } = createHost();
    host.install(
      plugin({ permissions: ["systems", "panels"] }, (ctx) => {
        ctx.systems.register("tick", () => undefined);
        ctx.panels.register({ id: "p", title: "P", mount: () => undefined });
      })
    );
    host.install(plugin({ id: "broken", engine: "^9.0.0" }));
    await host.activateAll();
    const summary = host.summary();
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.systems).toBe(1);
    expect(summary.panels).toBe(1);
    expect(summary.audit[0].permissions).toEqual(["systems", "panels"]);
  });
});

describe("engine integration", () => {
  const buildEngine = async (plugins: PluginDefinition[]) => {
    const { Engine } = await import("../../packages/engine/src/core/Engine");
    const { Scene } = await import("../../packages/engine/src/core/Scene");
    class StubScene extends Scene {
      create(): void {
        return undefined;
      }
    }
    const engine = new Engine({ parent: "host", plugins }, () => ({
      createGame: () => undefined,
      registerScene: () => undefined,
      startScene: () => undefined,
      stopScene: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      isRunning: () => true,
      destroy: () => undefined
    }));
    engine.registerScene(new StubScene("menu"));
    return engine;
  };

  it("installs plugins from the engine options and activates them on start", async () => {
    const activate = vi.fn();
    const engine = await buildEngine([{ manifest: manifest(), activate }]);
    expect(engine.getPlugins().get("demo")?.state).toBe("installed");
    engine.start("menu");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(activate).toHaveBeenCalledTimes(1);
    expect(engine.getPlugins().get("demo")?.state).toBe("active");
    engine.destroy();
  });

  it("exposes plugins in the diagnostics report", async () => {
    const engine = await buildEngine([{ manifest: manifest({ permissions: ["systems"] }), activate: () => undefined }]);
    engine.start("menu");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const report = engine.getDiagnosticsReport();
    expect(report.plugins.total).toBe(1);
    expect(report.plugins.active).toBe(1);
    expect(report.plugins.audit[0].id).toBe("demo");
    engine.destroy();
  });

  it("installs plugins at runtime", async () => {
    const engine = await buildEngine([]);
    engine.installPlugin({ manifest: manifest({ id: "late" }), activate: () => undefined });
    await engine.getPlugins().activate("late");
    expect(engine.getPlugins().get("late")?.state).toBe("active");
    engine.destroy();
  });

  it("tears plugins down with the engine", async () => {
    const deactivate = vi.fn();
    const engine = await buildEngine([{ manifest: manifest(), activate: () => undefined, deactivate }]);
    engine.start("menu");
    await new Promise((resolve) => setTimeout(resolve, 0));
    engine.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deactivate).toHaveBeenCalledTimes(1);
  });
});
