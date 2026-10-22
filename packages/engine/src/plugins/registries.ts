import { PluginError } from "./errors";
import type {
  PluginImporter,
  PluginImporterDescriptor,
  PluginPanel,
  PluginPanelDescriptor,
  PluginSystemDescriptor,
  PluginSystemHandler,
  PluginSystemOptions
} from "./types";

export type SystemRunError = {
  owner: string;
  system: string;
  error: unknown;
};

type SystemEntry = {
  name: string;
  owner: string;
  order: number;
  handler: PluginSystemHandler;
  maxFailures: number;
  failures: number;
  disabled: boolean;
};

const DEFAULT_ORDER = 100;
const DEFAULT_MAX_FAILURES = 3;

export class SystemRegistry {
  private entries: SystemEntry[] = [];

  register(owner: string, name: string, handler: PluginSystemHandler, options: PluginSystemOptions = {}): void {
    if (typeof name !== "string" || name.trim() === "") throw new PluginError("invalid-manifest", owner, "System needs a name");
    if (this.entries.some((entry) => entry.owner === owner && entry.name === name)) {
      throw new PluginError("duplicate-id", owner, `System "${name}" is already registered by "${owner}"`);
    }
    const entry: SystemEntry = {
      name,
      owner,
      order: options.order ?? DEFAULT_ORDER,
      handler,
      maxFailures: Math.max(1, options.maxFailures ?? DEFAULT_MAX_FAILURES),
      failures: 0,
      disabled: false
    };
    this.entries.push(entry);
    this.entries.sort((a, b) => (a.order === b.order ? a.name.localeCompare(b.name) : a.order - b.order));
  }

  removeOwner(owner: string): number {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.owner !== owner);
    return before - this.entries.length;
  }

  update(deltaTime: number): SystemRunError[] {
    const errors: SystemRunError[] = [];
    for (const entry of this.entries) {
      if (entry.disabled) continue;
      try {
        entry.handler(deltaTime);
        entry.failures = 0;
      } catch (error) {
        entry.failures += 1;
        if (entry.failures >= entry.maxFailures) entry.disabled = true;
        errors.push({ owner: entry.owner, system: entry.name, error });
      }
    }
    return errors;
  }

  enable(owner: string, name: string): boolean {
    const entry = this.entries.find((candidate) => candidate.owner === owner && candidate.name === name);
    if (!entry) return false;
    entry.disabled = false;
    entry.failures = 0;
    return true;
  }

  list(): readonly PluginSystemDescriptor[] {
    return this.entries.map((entry) => ({
      name: entry.name,
      order: entry.order,
      owner: entry.owner,
      failures: entry.failures,
      disabled: entry.disabled
    }));
  }

  countByOwner(owner: string): number {
    return this.entries.filter((entry) => entry.owner === owner).length;
  }

  clear(): void {
    this.entries = [];
  }
}

const normalizeExtension = (value: string): string => value.trim().toLowerCase().replace(/^\./, "");

export class ImporterRegistry {
  private importers = new Map<string, { importer: PluginImporter; owner: string }>();

  register(owner: string, importer: PluginImporter): void {
    if (typeof importer?.id !== "string" || importer.id.trim() === "") {
      throw new PluginError("invalid-manifest", owner, "Importer needs a non-empty id");
    }
    if (!Array.isArray(importer.extensions) || importer.extensions.length === 0) {
      throw new PluginError("invalid-manifest", owner, `Importer "${importer.id}" needs at least one extension`);
    }
    const existing = this.importers.get(importer.id);
    if (existing) {
      throw new PluginError("duplicate-importer", owner, `Importer "${importer.id}" is already registered by "${existing.owner}"`);
    }
    for (const extension of importer.extensions) {
      const normalized = normalizeExtension(extension);
      for (const [id, entry] of this.importers) {
        if (entry.importer.extensions.some((candidate) => normalizeExtension(candidate) === normalized)) {
          throw new PluginError("duplicate-importer", owner, `Extension "${normalized}" is already handled by importer "${id}"`);
        }
      }
    }
    this.importers.set(importer.id, { importer, owner });
  }

  removeOwner(owner: string): number {
    let removed = 0;
    for (const [id, entry] of [...this.importers]) {
      if (entry.owner === owner) {
        this.importers.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  find(extension: string): PluginImporter | null {
    const normalized = normalizeExtension(extension);
    for (const entry of this.importers.values()) {
      if (entry.importer.extensions.some((candidate) => normalizeExtension(candidate) === normalized)) return entry.importer;
    }
    return null;
  }

  import(extension: string, data: unknown, options?: Record<string, unknown>): unknown {
    const importer = this.find(extension);
    if (!importer) throw new PluginError("unknown-importer", "engine", `No importer registered for ".${normalizeExtension(extension)}"`);
    return importer.import(data, options);
  }

  list(): readonly PluginImporterDescriptor[] {
    return [...this.importers.values()].map((entry) => ({
      id: entry.importer.id,
      extensions: [...entry.importer.extensions],
      owner: entry.owner
    }));
  }

  countByOwner(owner: string): number {
    return [...this.importers.values()].filter((entry) => entry.owner === owner).length;
  }

  clear(): void {
    this.importers.clear();
  }
}

type PanelEntry = {
  panel: PluginPanel;
  owner: string;
  order: number;
  cleanup: (() => void) | null;
};

export class PanelRegistry {
  private panels = new Map<string, PanelEntry>();

  register(owner: string, panel: PluginPanel): void {
    if (typeof panel?.id !== "string" || panel.id.trim() === "") {
      throw new PluginError("invalid-manifest", owner, "Panel needs a non-empty id");
    }
    if (typeof panel.mount !== "function") {
      throw new PluginError("invalid-manifest", owner, `Panel "${panel.id}" needs a mount function`);
    }
    const existing = this.panels.get(panel.id);
    if (existing) {
      throw new PluginError("duplicate-panel", owner, `Panel "${panel.id}" is already registered by "${existing.owner}"`);
    }
    this.panels.set(panel.id, { panel, owner, order: panel.order ?? 100, cleanup: null });
  }

  removeOwner(owner: string): number {
    let removed = 0;
    for (const [id, entry] of [...this.panels]) {
      if (entry.owner !== owner) continue;
      if (entry.cleanup) {
        try {
          entry.cleanup();
        } catch (error) {
          void error;
        }
        entry.cleanup = null;
      }
      this.panels.delete(id);
      removed += 1;
    }
    return removed;
  }

  mount(id: string, parent: HTMLElement): boolean {
    const entry = this.panels.get(id);
    if (!entry) return false;
    if (entry.cleanup) return true;
    const cleanup = entry.panel.mount(parent);
    entry.cleanup = typeof cleanup === "function" ? cleanup : null;
    return true;
  }

  unmount(id: string): boolean {
    const entry = this.panels.get(id);
    if (!entry || !entry.cleanup) return false;
    entry.cleanup();
    entry.cleanup = null;
    return true;
  }

  list(): readonly PluginPanelDescriptor[] {
    return [...this.panels.values()]
      .map((entry) => ({ id: entry.panel.id, title: entry.panel.title, order: entry.order, owner: entry.owner }))
      .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order));
  }

  countByOwner(owner: string): number {
    return [...this.panels.values()].filter((entry) => entry.owner === owner).length;
  }

  clear(): void {
    for (const id of [...this.panels.keys()]) this.unmount(id);
    this.panels.clear();
  }
}
