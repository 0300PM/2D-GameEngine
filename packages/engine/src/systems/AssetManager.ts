import type { AssetBackend } from "../core/ports";
import {
  AssetManifest,
  formatBytes,
  type AssetAnimation,
  type AssetDescriptor,
  type AssetReferenceMap,
  type AssetIssue,
  type AssetSizeLimits,
  type AssetSizeReport,
  type AssetType
} from "../assets/AssetManifest";

export type { AssetDescriptor, AssetType };

export type AssetLoadProgress = {
  total: number;
  loaded: number;
  percent: number;
  currentId: string;
};

export type AssetStatus = "idle" | "queued" | "loading" | "ready" | "failed";

export type AssetPipelineReport = {
  issues: AssetIssue[];
  errors: AssetIssue[];
  warnings: AssetIssue[];
  failures: { id: string; src: string; message: string }[];
  counts: { total: number; ready: number; pending: number; failed: number };
  sizes: AssetSizeReport;
};

export type AssetDiagnostics = {
  registered: string[];
  unused: string[];
  missing: string[];
  failed: string[];
  unlicensed: string[];
  heaviest: { id: string; bytes: number | null }[];
};

export class AssetError extends Error {
  constructor(
    message: string,
    public assetId: string,
    public src: string
  ) {
    super(message);
    this.name = "AssetError";
  }
}

export class AssetManager {
  private manifest = new AssetManifest();
  private loadedIds = new Set<string>();
  private statuses = new Map<string, AssetStatus>();
  private failures = new Map<string, AssetError>();
  private holds = new Map<string, Set<string>>();
  private retains = new Map<string, number>();
  private backend: AssetBackend | null = null;
  private progressHandlers = new Set<(progress: AssetLoadProgress) => void>();
  private errorHandlers = new Set<(error: AssetError) => void>();
  private loadedHandlers = new Set<(id: string) => void>();

  register(descriptor: AssetDescriptor): void {
    const existing = this.manifest.get(descriptor.id);
    if (existing) {
      if (AssetManager.sameDescriptor(existing, descriptor)) return;
      throw new AssetError(`Duplicate asset id "${descriptor.id}"`, descriptor.id, descriptor.src);
    }
    try {
      this.manifest.register(descriptor);
    } catch (error) {
      throw new AssetError((error as Error).message, descriptor.id, descriptor.src);
    }
    this.statuses.set(descriptor.id, "idle");
  }

  registerMany(descriptors: readonly AssetDescriptor[]): void {
    for (const descriptor of descriptors) this.register(descriptor);
  }

  setManifest(manifest: AssetManifest): void {
    this.manifest = manifest;
    this.statuses.clear();
    this.loadedIds.clear();
    this.failures.clear();
    for (const id of manifest.ids()) this.statuses.set(id, "idle");
  }

  getManifest(): AssetManifest {
    return this.manifest;
  }

  has(id: string): boolean {
    return this.manifest.has(id);
  }

  isLoaded(id: string): boolean {
    return this.loadedIds.has(id);
  }

  hasTexture(id: string): boolean {
    return this.backend?.hasTexture(id) ?? this.loadedIds.has(id);
  }

  get(id: string): AssetDescriptor | undefined {
    return this.manifest.get(id);
  }

  getAll(): AssetDescriptor[] {
    return this.manifest.all();
  }

  pending(): AssetDescriptor[] {
    return this.manifest.all().filter((descriptor) => !this.loadedIds.has(descriptor.id));
  }

  count(): number {
    return this.manifest.count();
  }

  status(id: string): AssetStatus {
    return this.statuses.get(id) ?? "idle";
  }

  animations(): { assetId: string; key: string; animation: AssetAnimation }[] {
    return this.manifest.animations();
  }

  attachBackend(backend: AssetBackend): void {
    this.backend = backend;
  }

  detachBackend(): void {
    this.backend = null;
  }

  queue(): void {
    this.load();
  }

  load(ids?: readonly string[]): void {
    if (!this.backend) return;
    const requested = ids ? ids.filter((id) => this.manifest.has(id)) : this.manifest.ids();
    const descriptors = requested
      .map((id) => this.manifest.get(id))
      .filter((descriptor): descriptor is AssetDescriptor => {
        if (!descriptor || this.loadedIds.has(descriptor.id)) return false;
        const status = this.statuses.get(descriptor.id);
        return status !== "loading" && status !== "queued";
      });
    if (descriptors.length === 0) return;
    for (const descriptor of descriptors) this.statuses.set(descriptor.id, "queued");
    this.backend.queue(descriptors);
  }

  markLoading(id: string): void {
    if (!this.manifest.has(id)) return;
    this.statuses.set(id, "loading");
  }

  cancel(): boolean {
    const cancelled = this.backend?.cancel?.() ?? false;
    if (!cancelled) return false;
    for (const [id, status] of this.statuses) {
      if (status === "queued" || status === "loading") {
        if (this.loadedIds.has(id)) this.statuses.set(id, "ready");
        else this.statuses.set(id, "idle");
      }
    }
    return true;
  }

  retry(ids?: readonly string[]): number {
    const targets = ids ? ids.filter((id) => this.manifest.has(id)) : Array.from(this.failures.keys());
    if (targets.length === 0) return 0;
    for (const id of targets) {
      this.failures.delete(id);
      if (this.loadedIds.has(id)) this.statuses.set(id, "ready");
      else this.statuses.set(id, "idle");
    }
    this.load(targets);
    return targets.length;
  }

  failuresList(): { id: string; src: string; message: string }[] {
    return Array.from(this.failures.values()).map((error) => ({ id: error.assetId, src: error.src, message: error.message }));
  }

  hold(owner: string, ids: readonly string[]): void {
    const known = ids.filter((id) => this.manifest.has(id));
    const current = this.holds.get(owner) ?? new Set<string>();
    for (const id of known) current.add(id);
    this.holds.set(owner, current);
  }

  releaseOwner(owner: string): number {
    const held = this.holds.get(owner);
    if (!held) return 0;
    this.holds.delete(owner);
    return held.size;
  }

  retain(id: string): void {
    this.retains.set(id, (this.retains.get(id) ?? 0) + 1);
  }

  release(id: string): boolean {
    const count = this.retains.get(id) ?? 0;
    if (count > 0) {
      this.retains.set(id, count - 1);
      return false;
    }
    if (!this.loadedIds.has(id)) return false;
    this.unload(id);
    return true;
  }

  releaseGroup(group: string): string[] {
    const released: string[] = [];
    for (const descriptor of this.manifest.byGroup(group)) {
      this.retains.delete(descriptor.id);
      if (this.loadedIds.has(descriptor.id)) {
        this.unload(descriptor.id);
        released.push(descriptor.id);
      }
    }
    return released;
  }

  isRetained(id: string): boolean {
    if ((this.retains.get(id) ?? 0) > 0) return true;
    for (const held of this.holds.values()) if (held.has(id)) return true;
    return false;
  }

  gc(): string[] {
    const unloaded: string[] = [];
    for (const id of Array.from(this.loadedIds)) {
      if (this.isRetained(id)) continue;
      this.unload(id);
      unloaded.push(id);
    }
    return unloaded;
  }

  unload(id: string): void {
    this.backend?.unload(id);
    this.loadedIds.delete(id);
    this.failures.delete(id);
    if (this.manifest.has(id)) this.statuses.set(id, "idle");
  }

  markLoaded(id: string): void {
    if (!this.manifest.has(id)) return;
    this.loadedIds.add(id);
    this.failures.delete(id);
    this.statuses.set(id, "ready");
    for (const handler of this.loadedHandlers) handler(id);
  }

  reportFailure(error: AssetError): void {
    if (this.manifest.has(error.assetId)) this.statuses.set(error.assetId, "failed");
    this.failures.set(error.assetId, error);
    for (const handler of this.errorHandlers) handler(error);
  }

  reportProgress(loaded: number, total: number, currentId = ""): void {
    if (this.progressHandlers.size === 0) return;
    const percent = total === 0 ? 100 : Math.round((loaded / total) * 100);
    const progress: AssetLoadProgress = { total, loaded, percent, currentId };
    for (const handler of this.progressHandlers) handler(progress);
  }

  reportError(error: AssetError): void {
    this.reportFailure(error);
  }

  onProgress(handler: (progress: AssetLoadProgress) => void): () => void {
    this.progressHandlers.add(handler);
    return () => this.progressHandlers.delete(handler);
  }

  onError(handler: (error: AssetError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onLoaded(handler: (id: string) => void): () => void {
    this.loadedHandlers.add(handler);
    return () => this.loadedHandlers.delete(handler);
  }

  validate(options: { requireLicenses?: boolean; limits?: Partial<AssetSizeLimits> } = {}): AssetIssue[] {
    return this.measuredManifest().validate(options);
  }

  sizeReport(limits: Partial<AssetSizeLimits> = {}): AssetSizeReport {
    return this.measuredManifest().sizeReport(limits);
  }

  private measuredManifest(): AssetManifest {
    const backend = this.backend;
    if (!backend?.sizeOf) return this.manifest;
    let measured = false;
    const descriptors = this.manifest.all().map((descriptor) => {
      if (typeof descriptor.bytes === "number") return descriptor;
      const bytes = backend.sizeOf?.(descriptor.id) ?? null;
      if (bytes === null) return descriptor;
      measured = true;
      return { ...descriptor, bytes };
    });
    return measured ? new AssetManifest(descriptors) : this.manifest;
  }

  report(options: { requireLicenses?: boolean; limits?: Partial<AssetSizeLimits> } = {}): AssetPipelineReport {
    const issues = this.validate(options);
    for (const failure of this.failures.values()) {
      issues.push({
        code: "load-failed",
        severity: "error",
        message: `Failed to load "${failure.assetId}": ${failure.message}`,
        id: failure.assetId,
        path: failure.src
      });
    }
    const errors = issues.filter((entry) => entry.severity === "error");
    const warnings = issues.filter((entry) => entry.severity === "warning");
    const ready = Array.from(this.loadedIds).length;
    return {
      issues,
      errors,
      warnings,
      failures: this.failuresList(),
      counts: {
        total: this.manifest.count(),
        ready,
        pending: this.manifest.count() - ready - this.failures.size,
        failed: this.failures.size
      },
      sizes: this.sizeReport(options.limits)
    };
  }

  diagnose(options: { usedIds?: Iterable<string>; references?: AssetReferenceMap } = {}): AssetDiagnostics {
    const registered = this.manifest.all().map((descriptor) => descriptor.id);
    const issues = this.validate({ requireLicenses: true });
    const missing = options.references
      ? Array.from(new Set(this.manifest.checkReferences(options.references).map((issue) => issue.id ?? "unknown")))
      : [];
    const unlicensed = Array.from(new Set(issues.filter((issue) => issue.code === "missing-license").map((issue) => issue.id ?? "unknown")));
    const failed = this.failuresList().map((failure) => failure.id);
    const used = options.usedIds ? new Set(options.usedIds) : null;
    const unused = used ? registered.filter((id) => !used.has(id)) : [];
    const sizes = this.sizeReport().assets
      .slice()
      .sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1))
      .slice(0, 5)
      .map((entry) => ({ id: entry.id, bytes: entry.bytes }));
    return { registered, unused, missing, failed, unlicensed, heaviest: sizes };
  }

  formatSizes(limits: Partial<AssetSizeLimits> = {}): string[] {
    const report = this.sizeReport(limits);
    return report.assets.map((entry) => `${entry.id} (${entry.type}): ${entry.bytes === null ? "unknown" : formatBytes(entry.bytes)}`);
  }

  clear(): void {
    this.manifest = new AssetManifest();
    this.loadedIds.clear();
    this.statuses.clear();
    this.failures.clear();
    this.holds.clear();
    this.retains.clear();
    this.progressHandlers.clear();
    this.errorHandlers.clear();
    this.loadedHandlers.clear();
    this.backend = null;
  }

  private static sameDescriptor(a: AssetDescriptor, b: AssetDescriptor): boolean {
    return (
      a.type === b.type &&
      a.src === b.src &&
      a.atlasJson === b.atlasJson &&
      a.frameWidth === b.frameWidth &&
      a.frameHeight === b.frameHeight &&
      a.group === b.group
    );
  }
}
