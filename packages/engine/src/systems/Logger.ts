export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  id: number;
  time: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
};

export type LogSink = (entry: LogEntry) => void;

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let nextEntryId = 1;

export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export const levelRank = (level: LogLevel): number => levelOrder[level];

export const isLevelAtLeast = (level: LogLevel, min: LogLevel): boolean => levelOrder[level] >= levelOrder[min];

export class Logger {
  private minLevel: LogLevel;
  private context: string;
  private sinks: LogSink[];

  constructor(context = "Engine", minLevel: LogLevel = "info", sinks: LogSink[] = []) {
    this.context = context;
    this.minLevel = minLevel;
    this.sinks = sinks;
  }

  getContext(): string {
    return this.context;
  }

  getLevel(): LogLevel {
    return this.minLevel;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  addSink(sink: LogSink): () => void {
    this.sinks.push(sink);
    return () => {
      const index = this.sinks.indexOf(sink);
      if (index >= 0) this.sinks.splice(index, 1);
    };
  }

  sinkCount(): number {
    return this.sinks.length;
  }

  debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.minLevel, this.sinks);
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (!isLevelAtLeast(level, this.minLevel)) return;
    const entry: LogEntry = {
      id: nextEntryId++,
      time: typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now(),
      level,
      context: this.context,
      message,
      data
    };
    this.consoleWrite(level, message, data);
    for (const sink of this.sinks) {
      try {
        sink(entry);
      } catch (error) {
        this.consoleWrite("error", "Log sink failed", error);
      }
    }
  }

  private consoleWrite(level: LogLevel, message: string, data?: unknown): void {
    const formatted = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this.context}] ${message}`;
    const target = level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error;
    if (data !== undefined) target.call(console, formatted, data);
    else target.call(console, formatted);
  }
}
