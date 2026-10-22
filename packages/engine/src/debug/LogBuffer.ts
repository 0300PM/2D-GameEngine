import type { LogEntry, LogLevel, LogSink } from "../systems/Logger";
import { isLevelAtLeast, LOG_LEVELS } from "../systems/Logger";

export type LogFilter = {
  minLevel?: LogLevel;
  levels?: readonly LogLevel[];
  context?: string;
  text?: string;
};

export type LogSummary = {
  total: number;
  dropped: number;
  counts: Record<LogLevel, number>;
};

const emptyCounts = (): Record<LogLevel, number> => ({ debug: 0, info: 0, warn: 0, error: 0 });

const searchText = (entry: LogEntry): string => {
  let rest = "";
  if (entry.data !== undefined) {
    try {
      rest = typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data) ?? "";
    } catch (error) {
      rest = String(entry.data);
    }
  }
  return `${entry.level} ${entry.context} ${entry.message} ${rest}`.toLowerCase();
};

export class LogBuffer {
  private entries: LogEntry[] = [];
  private capacity: number;
  private dropped = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(capacity = 300) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  readonly push: LogSink = (entry: LogEntry): void => {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
      this.dropped += 1;
    }
    this.version += 1;
    this.notify();
  };

  getVersion(): number {
    return this.version;
  }

  size(): number {
    return this.entries.length;
  }

  droppedCount(): number {
    return this.dropped;
  }

  getCapacity(): number {
    return this.capacity;
  }

  setCapacity(capacity: number): void {
    this.capacity = Math.max(1, Math.floor(capacity));
    if (this.entries.length > this.capacity) {
      this.dropped += this.entries.length - this.capacity;
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    this.version += 1;
    this.notify();
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  last(count = 1): LogEntry[] {
    return this.entries.slice(Math.max(0, this.entries.length - count));
  }

  counts(): Record<LogLevel, number> {
    const counts = emptyCounts();
    for (const entry of this.entries) counts[entry.level] += 1;
    return counts;
  }

  summary(): LogSummary {
    return { total: this.entries.length, dropped: this.dropped, counts: this.counts() };
  }

  filter(filter: LogFilter = {}): LogEntry[] {
    const levels = filter.levels && filter.levels.length > 0 ? new Set(filter.levels) : null;
    const minLevel = filter.minLevel ?? "debug";
    const context = filter.context?.trim().toLowerCase() ?? "";
    const text = filter.text?.trim().toLowerCase() ?? "";
    const result: LogEntry[] = [];
    for (const entry of this.entries) {
      if (!isLevelAtLeast(entry.level, minLevel)) continue;
      if (levels && !levels.has(entry.level)) continue;
      if (context && !entry.context.toLowerCase().includes(context)) continue;
      if (text && !searchText(entry).includes(text)) continue;
      result.push(entry);
    }
    return result;
  }

  clear(): void {
    this.entries = [];
    this.dropped = 0;
    this.version += 1;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  toJSON(): LogSummary & { entries: LogEntry[] } {
    return { ...this.summary(), entries: [...this.entries] };
  }

  static levels(): readonly LogLevel[] {
    return LOG_LEVELS;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        void error;
      }
    }
  }
}
