import { formatMemory, readMemory } from "./Memory";
import type { MemoryInfo } from "./Memory";

export type OverlayProfileEntry = {
  name: string;
  ms: number;
};

export type OverlayStats = {
  deltaTime?: number;
  realDeltaTime?: number;
  objects?: number;
  bodies?: number;
  colliders?: number;
  timeScale?: number;
  paused?: boolean;
  audio?: string;
  profile?: OverlayProfileEntry[];
  extra?: string[];
};

export type OverlayLabels = {
  objects: string;
  bodies: string;
  pairs: string;
  memory: string;
  scene: string;
  paused: string;
};

const DEFAULT_LABELS: OverlayLabels = {
  objects: "objects",
  bodies: "bodies",
  pairs: "pairs",
  memory: "memory",
  scene: "scene",
  paused: "paused"
};

const OVERLAY_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  top: "8px",
  left: "8px",
  zIndex: "9999",
  display: "none",
  padding: "8px 10px",
  borderRadius: "8px",
  background: "rgba(9, 10, 12, 0.82)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#e8eaed",
  font: "11.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  whiteSpace: "pre",
  pointerEvents: "none",
  letterSpacing: "0"
};

const formatMs = (value: number): string => `${value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} ms`;

export class DebugOverlay {
  private element: HTMLDivElement | null = null;
  private enabled: boolean;
  private parent: HTMLElement | null = null;
  private activeScene = "";
  private extraLines: string[] = [];
  private stats: OverlayStats = {};
  private labels: OverlayLabels;
  private memory: MemoryInfo | null = null;
  private memoryTick = 0;
  private fps = 0;
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(enabled = false, labels: Partial<OverlayLabels> = {}) {
    this.enabled = enabled;
    this.labels = { ...DEFAULT_LABELS, ...labels };
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;
    if (!this.enabled) return;
    this.ensureElement();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.ensureElement();
    else this.unmount();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setActiveScene(name: string): void {
    this.activeScene = name;
    this.render();
  }

  setExtra(lines: string[]): void {
    this.extraLines = [...lines];
    this.render();
  }

  setStats(stats: OverlayStats): void {
    this.stats = { ...stats };
  }

  setLabels(labels: Partial<OverlayLabels>): void {
    this.labels = { ...this.labels, ...labels };
    this.render();
  }

  update(timeMs: number): void {
    if (!this.enabled) return;
    this.frameCount += 1;
    if (this.lastFpsTime === 0) {
      this.lastFpsTime = timeMs;
    } else {
      const elapsed = timeMs - this.lastFpsTime;
      if (elapsed >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastFpsTime = timeMs;
      }
    }
    this.render();
  }

  getFps(): number {
    return this.fps;
  }

  getMemory(): MemoryInfo | null {
    return this.memory;
  }

  getLines(): string[] {
    const stats = this.stats;
    const gameMs = stats.deltaTime ?? 0;
    const realMs = stats.realDeltaTime ?? gameMs;
    const scale = stats.timeScale ?? 1;
    const lines: string[] = [];
    const state = stats.paused ? ` · ${this.labels.paused}` : "";
    lines.push(`${this.fps.toString().padStart(3, " ")} fps · ${formatMs(realMs)}${state}`);
    lines.push(`frame ${formatMs(realMs)} → ${formatMs(gameMs)} · x${scale.toFixed(2)}`);
    lines.push(
      `${this.labels.scene} ${this.activeScene || "-"} · ${stats.objects ?? 0} ${this.labels.objects} · ${stats.bodies ?? 0} ${this.labels.bodies} · ${stats.colliders ?? 0} ${this.labels.pairs}`
    );
    lines.push(`${this.labels.memory} ${formatMemory(this.memory)}`);
    if (stats.audio) lines.push(`audio ${stats.audio}`);
    if (stats.profile && stats.profile.length > 0) {
      lines.push(`prof ${stats.profile.map((entry) => `${entry.name} ${formatMs(entry.ms)}`).join(" · ")}`);
    }
    for (const line of stats.extra ?? []) lines.push(line);
    for (const line of this.extraLines) lines.push(line);
    return lines;
  }

  unmount(): void {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
    this.element = null;
  }

  destroy(): void {
    this.unmount();
    this.parent = null;
    this.enabled = false;
    this.stats = {};
    this.extraLines = [];
    this.memory = null;
  }

  private ensureElement(): void {
    if (this.element) return;
    const element = document.createElement("div");
    element.setAttribute("data-b2d-overlay", "1");
    Object.assign(element.style, OVERLAY_STYLE);
    this.element = element;
    const host = this.parent ?? document.body;
    host.appendChild(element);
    this.render();
  }

  private render(): void {
    if (!this.enabled || !this.element) return;
    this.memoryTick += 1;
    if (this.memoryTick % 30 === 1) this.memory = readMemory();
    this.element.textContent = this.getLines().join("\n");
    this.element.style.display = "block";
  }
}
