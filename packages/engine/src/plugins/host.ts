import type { EventBus } from "../systems/EventBus";
import type { Logger } from "../systems/Logger";
import { PluginError, PluginPermissionError, pluginErrorOf } from "./errors";
import { normalizePluginManifest, validatePluginManifest } from "./manifest";
import type { PluginManifest, PluginPermission } from "./manifest";
import { ImporterRegistry, PanelRegistry, SystemRegistry } from "./registries";
import { isValidRange, satisfiesRange } from "./semver";
import type {
  PluginAssetApi,
  PluginContext,
  PluginDefinition,
  PluginEventApi,
  PluginSceneApi,
  PluginState,
  PluginStatus,
  PluginStorageApi,
  PluginSummary,
  PluginSystemDescriptor,
  PluginSystemHandler,
  PluginSystemOptions
} from "./types";

export type PluginServices = {
  scenes: PluginSceneApi;
  assets: PluginAssetApi;
  storage?: () => Storage | null;
  storagePrefix?: string;
};

export type PluginHostOptions = {
  engineVersion: string;
  logger: Logger;
  events: EventBus;
  services: PluginServices;
  maxFailures?: number;
};

type PluginRecord = {
  definition: PluginDefinition;
  manifest: PluginManifest;
  state: PluginState;
  disposers: (() => void)[];
  failures: number;
  lastError: string | null;
};

const DEFAULT_STORAGE_PREFIX = "b2d:plugin:";

export class PluginHost {
  private records = new Map<string, PluginRecord>();
  private readonly logger: Logger;
  private readonly events: EventBus;
  private readonly engineVersion: string;
  private readonly services: PluginServices;
  private readonly maxFailures: number;
  private readonly systems = new SystemRegistry();
  private readonly importers = new ImporterRegistry();
  private readonly panels = new PanelRegistry();
  private activating = new Set<string>();

  constructor(options: PluginHostOptions) {
    this.logger = options.logger.child("Plugins");
    this.events = options.events;
    this.engineVersion = options.engineVersion;
    this.services = options.services;
    this.maxFailures = Math.max(1, options.maxFailures ?? 3);
  }

  install(plugin: PluginDefinition): PluginStatus {
    const issues = validatePluginManifest(plugin?.manifest);
    if (issues.length > 0) {
      const id = typeof plugin?.manifest?.id === "string" ? plugin.manifest.id : "unknown";
      throw new PluginError("invalid-manifest", id, `Invalid manifest for "${id}": ${issues[0].message}`, issues);
    }
    if (typeof plugin.activate !== "function") {
      throw new PluginError("invalid-manifest", plugin.manifest.id, `Plugin "${plugin.manifest.id}" needs an activate function`);
    }
    const manifest = normalizePluginManifest(plugin.manifest);
    if (this.records.has(manifest.id)) {
      throw new PluginError("duplicate-id", manifest.id, `Plugin "${manifest.id}" is already installed`);
    }
    this.records.set(manifest.id, {
      definition: { ...plugin, manifest },
      manifest,
      state: "installed",
      disposers: [],
      failures: 0,
      lastError: null
    });
    this.logger.info(`Installed plugin "${manifest.id}@${manifest.version}"`);
    this.events.emit("plugin:installed", { id: manifest.id, version: manifest.version });
    return this.toStatus(manifest.id);
  }

  async activate(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) throw new PluginError("missing-dependency", id, `Plugin "${id}" is not installed`);
    if (record.state === "active") return;
    if (this.activating.has(id)) {
      throw new PluginError("dependency-cycle", id, `Dependency cycle detected at plugin "${id}"`);
    }
    if (!satisfiesRange(this.engineVersion, record.manifest.engine)) {
      this.fail(record, new PluginError(
        "incompatible-engine",
        id,
        `Plugin "${id}@${record.manifest.version}" requires engine "${record.manifest.engine}" but ${this.engineVersion} is running`
      ));
      return;
    }
    this.activating.add(id);
    try {
      const dependencies = Object.entries(record.manifest.dependencies ?? {});
      for (const [dependencyId, range] of dependencies) {
        const dependency = this.records.get(dependencyId);
        if (!dependency) {
          this.fail(record, new PluginError("missing-dependency", id, `Plugin "${id}" needs "${dependencyId}" which is not installed`));
          return;
        }
        if (!isValidRange(range) || !satisfiesRange(dependency.manifest.version, range)) {
          this.fail(record, new PluginError(
            "missing-dependency",
            id,
            `Plugin "${id}" needs "${dependencyId}@${range}" but "${dependency.manifest.version}" is installed`
          ));
          return;
        }
        await this.activate(dependencyId);
        if (dependency.state !== "active") {
          this.fail(record, new PluginError("missing-dependency", id, `Plugin "${id}" cannot start because "${dependencyId}" is not active`));
          return;
        }
      }
      const context = this.createContext(record);
      await record.definition.activate(context);
      record.state = "active";
      record.lastError = null;
      this.logger.info(`Activated plugin "${id}"`);
      this.events.emit("plugin:activated", { id });
    } catch (error) {
      this.fail(record, pluginErrorOf(error, id, "activate-failed"));
    } finally {
      this.activating.delete(id);
    }
  }

  async activateAll(): Promise<void> {
    for (const id of [...this.records.keys()]) {
      try {
        await this.activate(id);
      } catch (error) {
        this.logger.error(`Unexpected activation failure for "${id}"`, error);
      }
    }
  }

  async deactivate(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.state !== "active") return;
    for (const candidate of [...this.records.values()]) {
      if (candidate.state !== "active") continue;
      if (Object.keys(candidate.manifest.dependencies ?? {}).includes(id)) await this.deactivate(candidate.manifest.id);
    }
    try {
      if (typeof record.definition.deactivate === "function") await record.definition.deactivate();
    } catch (error) {
      this.recordError(record, pluginErrorOf(error, id, "deactivate-failed"));
    }
    this.runDisposers(record);
    this.systems.removeOwner(id);
    this.importers.removeOwner(id);
    this.panels.removeOwner(id);
    record.state = "inactive";
    this.logger.info(`Deactivated plugin "${id}"`);
    this.events.emit("plugin:deactivated", { id });
  }

  async uninstall(id: string): Promise<void> {
    await this.deactivate(id);
    if (!this.records.delete(id)) return;
    this.events.emit("plugin:uninstalled", { id });
  }

  async dispose(): Promise<void> {
    for (const id of [...this.records.keys()].reverse()) await this.deactivate(id);
    this.records.clear();
    this.systems.clear();
    this.importers.clear();
    this.panels.clear();
  }

  update(deltaTime: number): void {
    const errors = this.systems.update(deltaTime);
    for (const failure of errors) {
      const record = this.records.get(failure.owner);
      const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
      if (record) {
        record.failures += 1;
        record.lastError = `system "${failure.system}": ${message}`;
      }
      this.logger.error(`Plugin system "${failure.system}" of "${failure.owner}" failed: ${message}`);
      this.events.emit("plugin:system-error", { id: failure.owner, system: failure.system, message });
      const disabled = this.systems.list().some((entry) => entry.owner === failure.owner && entry.name === failure.system && entry.disabled);
      if (disabled) {
        this.logger.warn(`Plugin system "${failure.system}" of "${failure.owner}" disabled after repeated failures`);
        this.events.emit("plugin:system-disabled", { id: failure.owner, system: failure.system });
      }
    }
  }

  get(id: string): PluginStatus | undefined {
    return this.records.has(id) ? this.toStatus(id) : undefined;
  }

  has(id: string): boolean {
    return this.records.has(id);
  }

  list(): PluginStatus[] {
    return [...this.records.keys()].map((id) => this.toStatus(id));
  }

  summary(): PluginSummary {
    const statuses = this.list();
    return {
      total: statuses.length,
      active: statuses.filter((status) => status.state === "active").length,
      failed: statuses.filter((status) => status.state === "failed").length,
      systems: this.systems.list().length,
      importers: this.importers.list().length,
      panels: this.panels.list().length,
      audit: statuses.map((status) => ({
        id: status.id,
        version: status.version,
        state: status.state,
        permissions: [...status.permissions],
        dependencies: [...status.dependencies]
      }))
    };
  }

  getImporters(): ImporterRegistry {
    return this.importers;
  }

  getPanels(): PanelRegistry {
    return this.panels;
  }

  getSystems(): readonly PluginSystemDescriptor[] {
    return this.systems.list();
  }

  enableSystem(owner: string, name: string): boolean {
    return this.systems.enable(owner, name);
  }

  private fail(record: PluginRecord, error: PluginError): void {
    this.runDisposers(record);
    this.systems.removeOwner(record.manifest.id);
    this.importers.removeOwner(record.manifest.id);
    this.panels.removeOwner(record.manifest.id);
    record.state = "failed";
    this.recordError(record, error);
  }

  private recordError(record: PluginRecord, error: PluginError): void {
    record.failures += 1;
    record.lastError = `${error.code}: ${error.message}`;
    this.logger.error(`Plugin "${record.manifest.id}" failed: ${error.message}`);
    this.events.emit("plugin:failed", { id: record.manifest.id, code: error.code, message: error.message });
  }

  private runDisposers(record: PluginRecord): void {
    while (record.disposers.length > 0) {
      const disposer = record.disposers.pop();
      if (!disposer) continue;
      try {
        disposer();
      } catch (error) {
        this.logger.warn(`Disposer of plugin "${record.manifest.id}" failed`, error);
      }
    }
  }

  private toStatus(id: string): PluginStatus {
    const record = this.records.get(id);
    if (!record) throw new PluginError("missing-dependency", id, `Plugin "${id}" is not installed`);
    return {
      id: record.manifest.id,
      name: record.manifest.name ?? record.manifest.id,
      version: record.manifest.version,
      state: record.state,
      permissions: record.manifest.permissions ?? [],
      dependencies: Object.keys(record.manifest.dependencies ?? {}),
      systems: this.systems.countByOwner(id),
      importers: this.importers.countByOwner(id),
      panels: this.panels.countByOwner(id),
      failures: record.failures,
      lastError: record.lastError
    };
  }

  private createContext(record: PluginRecord): PluginContext {
    const manifest = record.manifest;
    const granted = new Set<PluginPermission>(manifest.permissions ?? []);
    const logger = this.logger.child(manifest.id);
    return {
      manifest,
      engineVersion: this.engineVersion,
      logger,
      systems: granted.has("systems")
        ? {
            register: (name: string, handler: PluginSystemHandler, options?: PluginSystemOptions) =>
              this.systems.register(manifest.id, name, handler, { maxFailures: options?.maxFailures ?? this.maxFailures, order: options?.order })
          }
        : this.denied(manifest.id, "systems", "systems", ["register"]),
      importers: granted.has("importers")
        ? { register: (importer) => this.importers.register(manifest.id, importer) }
        : this.denied(manifest.id, "importers", "importers", ["register"]),
      panels: granted.has("panels")
        ? { register: (panel) => this.panels.register(manifest.id, panel) }
        : this.denied(manifest.id, "panels", "panels", ["register"]),
      events: granted.has("events") ? this.createEvents(manifest.id) : this.denied(manifest.id, "events", "events", ["on", "emit"]),
      scenes: granted.has("scenes") ? this.services.scenes : this.denied(manifest.id, "scenes", "scenes", ["list", "activeId"]),
      assets: granted.has("assets") ? this.services.assets : this.denied(manifest.id, "assets", "assets", ["ids", "isLoaded"]),
      storage: granted.has("storage") ? this.createStorage(manifest.id) : this.denied(manifest.id, "storage", "storage", ["get", "set", "remove", "keys", "clear"]),
      onDispose: (disposer: () => void) => {
        if (typeof disposer === "function") record.disposers.push(disposer);
      }
    };
  }

  private createEvents(id: string): PluginEventApi {
    return {
      on: <T>(event: string, handler: (payload: T) => void) => this.events.on(event, handler),
      emit: <T>(event: string, payload: T) => {
        this.events.emit(`plugin:${id}:${event}`, payload);
      }
    };
  }

  private createStorage(id: string): PluginStorageApi {
    const prefix = `${this.services.storagePrefix ?? DEFAULT_STORAGE_PREFIX}${id}:`;
    const backend = (): Storage | null => {
      try {
        return this.services.storage ? this.services.storage() : typeof localStorage === "undefined" ? null : localStorage;
      } catch (error) {
        void error;
        return null;
      }
    };
    return {
      get: (key: string) => backend()?.getItem(prefix + key) ?? null,
      set: (key: string, value: string) => backend()?.setItem(prefix + key, value),
      remove: (key: string) => backend()?.removeItem(prefix + key),
      keys: () => {
        const store = backend();
        if (!store) return [];
        const keys: string[] = [];
        for (let index = 0; index < store.length; index += 1) {
          const key = store.key(index);
          if (key && key.startsWith(prefix)) keys.push(key.slice(prefix.length));
        }
        return keys;
      },
      clear: () => {
        const store = backend();
        if (!store) return;
        for (const key of this.createStorage(id).keys()) store.removeItem(prefix + key);
      }
    };
  }

  private denied<T extends object>(id: string, permission: PluginPermission, capability: string, methods: readonly string[]): T {
    const target: Record<string, unknown> = {};
    for (const method of methods) {
      target[method] = () => {
        throw new PluginPermissionError(id, permission, `${capability}.${method}`);
      };
    }
    return target as T;
  }
}
