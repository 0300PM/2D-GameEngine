import type { LogBuffer, LogFilter } from "./LogBuffer";
import { LOG_LEVELS } from "../systems/Logger";
import type { LogEntry, LogLevel } from "../systems/Logger";

export type LogPanelLabels = {
  title: string;
  filter: string;
  clear: string;
  empty: string;
  context: string;
};

export type LogPanelOptions = {
  labels?: Partial<LogPanelLabels>;
  height?: number;
  width?: number;
  minLevel?: LogLevel;
};

const DEFAULT_LABELS: LogPanelLabels = {
  title: "Logs",
  filter: "Filter…",
  clear: "Clear",
  empty: "No entries match the filter",
  context: "All contexts"
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "#8b93a1",
  info: "#d7dbe2",
  warn: "#e2b714",
  error: "#ff6b6b"
};

const PANEL_STYLE: Partial<CSSStyleDeclaration> = {
  position: "absolute",
  left: "8px",
  bottom: "8px",
  zIndex: "9998",
  display: "none",
  flexDirection: "column",
  borderRadius: "8px",
  overflow: "hidden",
  background: "rgba(9, 10, 12, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  color: "#e8eaed",
  font: "11.5px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
};

let panelCounter = 0;

export class LogPanel {
  private element: HTMLDivElement | null = null;
  private list: HTMLDivElement | null = null;
  private search: HTMLInputElement | null = null;
  private contextLabel: HTMLButtonElement | null = null;
  private counters = new Map<LogLevel, HTMLButtonElement>();
  private buffer: LogBuffer;
  private labels: LogPanelLabels;
  private parent: HTMLElement | null = null;
  private filter: LogFilter;
  private levels = new Set<LogLevel>([...LOG_LEVELS]);
  private visible = false;
  private lastVersion = -1;
  private lastRefresh = 0;
  private unsubscribe: (() => void) | null = null;
  private dirty = true;
  private height: number;
  private width: number;
  private readonly id = ++panelCounter;

  constructor(buffer: LogBuffer, options: LogPanelOptions = {}) {
    this.buffer = buffer;
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.filter = { text: "", context: "" };
    this.height = options.height ?? 240;
    this.width = options.width ?? 520;
    this.unsubscribe = buffer.subscribe(() => {
      this.dirty = true;
    });
  }

  mount(parent: HTMLElement): void {
    this.parent = parent;
    this.ensureElement();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.ensureElement();
    if (!this.element) return;
    this.element.style.display = visible ? "flex" : "none";
    if (visible) this.refresh(true);
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setLabels(labels: Partial<LogPanelLabels>): void {
    this.labels = { ...this.labels, ...labels };
    if (this.search) this.search.placeholder = this.labels.filter;
    if (this.contextLabel) this.contextLabel.textContent = this.labels.context;
    this.dirty = true;
    this.refresh(true);
  }

  setFilter(filter: LogFilter): void {
    this.filter = { ...this.filter, ...filter };
    this.dirty = true;
    this.refresh(true);
  }

  toggleLevel(level: LogLevel): void {
    if (this.levels.has(level)) this.levels.delete(level);
    else this.levels.add(level);
    this.dirty = true;
    this.refresh(true);
  }

  update(timeMs: number): void {
    if (!this.visible || !this.element) return;
    if (timeMs - this.lastRefresh < 120 && !this.dirty) return;
    this.lastRefresh = timeMs;
    this.refresh(false);
  }

  refresh(force: boolean): void {
    if (!this.element || !this.list) return;
    const version = this.buffer.getVersion();
    if (!force && version === this.lastVersion && !this.dirty) return;
    this.lastVersion = version;
    this.dirty = false;

    const counts = this.buffer.counts();
    for (const [level, button] of this.counters) {
      const active = this.levels.has(level);
      button.style.opacity = active ? "1" : "0.45";
      button.style.borderColor = active ? LEVEL_COLORS[level] : "rgba(255,255,255,0.18)";
      button.textContent = `${level} ${counts[level]}`;
    }

    const entries = this.buffer.filter({
      ...this.filter,
      levels: this.levels.size === LOG_LEVELS.length || this.levels.size === 0 ? undefined : [...this.levels]
    });
    if (entries.length === 0) {
      this.list.innerHTML = `<div style="padding:10px;color:#8b93a1">${escapeHtml(this.labels.empty)}</div>`;
      return;
    }
    const atBottom = this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 24;
    const rows = entries.slice(-400).map((entry) => this.renderEntry(entry));
    this.list.innerHTML = rows.join("");
    if (atBottom) this.list.scrollTop = this.list.scrollHeight;
  }

  destroy(): void {
    this.visible = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
    this.element = null;
    this.list = null;
    this.search = null;
    this.counters.clear();
  }

  private renderEntry(entry: LogEntry): string {
    const seconds = (entry.time / 1000).toFixed(3);
    const context = truncate(entry.context, 26);
    const message = escapeHtml(entry.message);
    return `<div style="display:flex;gap:8px;padding:2px 8px;border-top:1px solid rgba(255,255,255,0.05)"><span style="color:#6b7280">${seconds}</span><span style="color:${LEVEL_COLORS[entry.level]};min-width:44px">${entry.level}</span><span style="color:#8b93a1;min-width:96px">${escapeHtml(context)}</span><span style="flex:1;white-space:pre-wrap;word-break:break-word">${message}</span></div>`;
  }

  private ensureElement(): void {
    if (this.element) return;
    const element = document.createElement("div");
    element.setAttribute("data-b2d-log-panel", String(this.id));
    Object.assign(element.style, PANEL_STYLE, {
      width: `min(${this.width}px, calc(100% - 16px))`,
      height: `${this.height}px`
    });

    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 8px",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)"
    });
    const title = document.createElement("strong");
    title.textContent = this.labels.title;
    title.style.fontWeight = "600";
    title.style.marginRight = "4px";
    head.appendChild(title);

    for (const level of LOG_LEVELS) {
      const button = document.createElement("button");
      button.type = "button";
      Object.assign(button.style, {
        font: "inherit",
        fontSize: "10.5px",
        padding: "1px 6px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "transparent",
        color: LEVEL_COLORS[level],
        cursor: "pointer"
      });
      button.addEventListener("click", () => this.toggleLevel(level));
      this.counters.set(level, button);
      head.appendChild(button);
    }

    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    head.appendChild(spacer);

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = this.labels.filter;
    search.autocomplete = "off";
    Object.assign(search.style, {
      width: "120px",
      height: "20px",
      font: "inherit",
      fontSize: "11px",
      color: "#e8eaed",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: "6px",
      padding: "0 6px",
      outline: "none"
    });
    search.addEventListener("input", () => {
      this.filter = { ...this.filter, text: search.value };
      this.dirty = true;
      this.refresh(true);
    });
    this.search = search;
    head.appendChild(search);

    const context = document.createElement("button");
    context.type = "button";
    Object.assign(context.style, {
      font: "inherit",
      fontSize: "10.5px",
      padding: "1px 6px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "transparent",
      color: "#8b93a1",
      cursor: "pointer"
    });
    context.textContent = this.labels.context;
    context.addEventListener("click", () => this.cycleContext());
    head.appendChild(context);
    this.contextLabel = context;

    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = this.labels.clear;
    Object.assign(clear.style, {
      font: "inherit",
      fontSize: "10.5px",
      padding: "1px 6px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "transparent",
      color: "#8b93a1",
      cursor: "pointer"
    });
    clear.addEventListener("click", () => {
      this.buffer.clear();
      this.refresh(true);
    });
    head.appendChild(clear);

    const list = document.createElement("div");
    Object.assign(list.style, {
      flex: "1",
      overflowY: "auto",
      padding: "4px 0"
    });

    element.appendChild(head);
    element.appendChild(list);
    this.element = element;
    this.list = list;
    const host = this.parent ?? document.body;
    host.appendChild(element);
    element.style.display = this.visible ? "flex" : "none";
    this.refresh(true);
  }

  private cycleContext(): void {
    const contexts = Array.from(new Set(this.buffer.all().map((entry) => entry.context))).sort();
    if (contexts.length === 0) return;
    const current = this.filter.context ?? "";
    const index = contexts.indexOf(current);
    const next = index + 1 >= contexts.length ? "" : contexts[index + 1];
    this.filter = { ...this.filter, context: next };
    if (this.contextLabel) this.contextLabel.textContent = next || this.labels.context;
    this.dirty = true;
    this.refresh(true);
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (char) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&quot;"));

const truncate = (value: string, max: number): string => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);
