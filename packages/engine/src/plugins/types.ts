import type { Logger } from "../systems/Logger";
import type { PluginManifest, PluginPermission } from "./manifest";

export type PluginLogger = Pick<Logger, "debug" | "info" | "warn" | "error" | "child">;

export type PluginSystemHandler = (deltaTime: number) => void;

export type PluginSystemOptions = {
  order?: number;
  maxFailures?: number;
};

export type PluginSystemDescriptor = {
  name: string;
  order: number;
  owner: string;
  failures: number;
  disabled: boolean;
};

export type PluginImporter<T = unknown> = {
  id: string;
  extensions: readonly string[];
  import(data: unknown, options?: Record<string, unknown>): T;
};

export type PluginImporterDescriptor = {
  id: string;
  extensions: readonly string[];
  owner: string;
};

export type PluginPanel = {
  id: string;
  title: string;
  order?: number;
  mount(parent: HTMLElement): void | (() => void);
};

export type PluginPanelDescriptor = {
  id: string;
  title: string;
  order: number;
  owner: string;
};

export type PluginEventApi = {
  on<T>(event: string, handler: (payload: T) => void): () => void;
  emit<T>(event: string, payload: T): void;
};

export type PluginSceneApi = {
  list(): string[];
  activeId(): string | null;
};

export type PluginAssetApi = {
  ids(): string[];
  isLoaded(id: string): boolean;
};

export type PluginStorageApi = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
  clear(): void;
};

export type PluginSystemApi = {
  register(name: string, handler: PluginSystemHandler, options?: PluginSystemOptions): void;
};

export type PluginImporterApi = {
  register(importer: PluginImporter): void;
};

export type PluginPanelApi = {
  register(panel: PluginPanel): void;
};

export type PluginContext = {
  readonly manifest: PluginManifest;
  readonly engineVersion: string;
  readonly logger: PluginLogger;
  readonly systems: PluginSystemApi;
  readonly importers: PluginImporterApi;
  readonly panels: PluginPanelApi;
  readonly events: PluginEventApi;
  readonly scenes: PluginSceneApi;
  readonly assets: PluginAssetApi;
  readonly storage: PluginStorageApi;
  onDispose(disposer: () => void): void;
};

export type PluginDefinition = {
  manifest: PluginManifest;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
};

export type PluginState = "installed" | "active" | "inactive" | "failed";

export type PluginStatus = {
  id: string;
  name: string;
  version: string;
  state: PluginState;
  permissions: readonly PluginPermission[];
  dependencies: readonly string[];
  systems: number;
  importers: number;
  panels: number;
  failures: number;
  lastError: string | null;
};

export type PluginAuditEntry = {
  id: string;
  version: string;
  state: PluginState;
  permissions: readonly string[];
  dependencies: readonly string[];
};

export type PluginSummary = {
  total: number;
  active: number;
  failed: number;
  systems: number;
  importers: number;
  panels: number;
  audit: PluginAuditEntry[];
};
