import { describe, expect, it, vi } from "vitest";
import { LogBuffer } from "../../packages/engine/src/debug/LogBuffer";
import { Logger } from "../../packages/engine/src/systems/Logger";
import type { LogEntry } from "../../packages/engine/src/systems/Logger";

const entry = (level: LogEntry["level"], message: string, context = "Engine"): LogEntry => ({
  id: Math.random(),
  time: 0,
  level,
  context,
  message
});

describe("LogBuffer", () => {
  it("keeps the newest entries and counts drops", () => {
    const buffer = new LogBuffer(16);
    for (let index = 0; index < 20; index += 1) buffer.push(entry("info", `line ${index}`));
    expect(buffer.size()).toBe(16);
    expect(buffer.droppedCount()).toBe(4);
    expect(buffer.all()[15].message).toBe("line 19");
    expect(buffer.all()[0].message).toBe("line 4");
  });

  it("counts entries per level", () => {
    const buffer = new LogBuffer();
    buffer.push(entry("debug", "d"));
    buffer.push(entry("info", "i"));
    buffer.push(entry("warn", "w"));
    buffer.push(entry("error", "e"));
    buffer.push(entry("error", "e2"));
    expect(buffer.counts()).toEqual({ debug: 1, info: 1, warn: 1, error: 2 });
    expect(buffer.summary().total).toBe(5);
  });

  it("filters by minimum level", () => {
    const buffer = new LogBuffer();
    ["debug", "info", "warn", "error"].forEach((level) => buffer.push(entry(level as LogEntry["level"], level)));
    expect(buffer.filter({ minLevel: "warn" }).map((item) => item.message)).toEqual(["warn", "error"]);
    expect(buffer.filter({ minLevel: "debug" })).toHaveLength(4);
  });

  it("filters by explicit levels, context and text", () => {
    const buffer = new LogBuffer();
    buffer.push(entry("info", "Scene started", "Engine:SceneManager"));
    buffer.push(entry("warn", "Asset missing", "Engine:Assets"));
    buffer.push(entry("error", "Scene failed", "Engine:SceneManager"));
    expect(buffer.filter({ levels: ["error"] }).map((item) => item.message)).toEqual(["Scene failed"]);
    expect(buffer.filter({ context: "assets" })).toHaveLength(1);
    expect(buffer.filter({ text: "scene" }).map((item) => item.level)).toEqual(["info", "error"]);
  });

  it("searches inside attached data payloads", () => {
    const buffer = new LogBuffer();
    buffer.push({ ...entry("info", "payload"), data: { sceneId: "level-02" } });
    expect(buffer.filter({ text: "level-02" })).toHaveLength(1);
  });

  it("notifies subscribers and tracks a version", () => {
    const buffer = new LogBuffer();
    const spy = vi.fn();
    const off = buffer.subscribe(spy);
    buffer.push(entry("info", "one"));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(buffer.getVersion()).toBe(1);
    off();
    buffer.push(entry("info", "two"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("clears entries and keeps listeners", () => {
    const buffer = new LogBuffer();
    const spy = vi.fn();
    buffer.subscribe(spy);
    buffer.push(entry("info", "one"));
    buffer.clear();
    expect(buffer.size()).toBe(0);
    expect(buffer.droppedCount()).toBe(0);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("shrinks capacity while keeping the newest entries", () => {
    const buffer = new LogBuffer(20);
    for (let index = 0; index < 10; index += 1) buffer.push(entry("info", `line ${index}`));
    buffer.setCapacity(16);
    buffer.setCapacity(4);
    expect(buffer.size()).toBe(4);
    expect(buffer.all()[3].message).toBe("line 9");
    expect(buffer.getCapacity()).toBe(4);
    expect(buffer.droppedCount()).toBe(6);
  });
});

describe("Logger sinks", () => {
  it("forwards entries to every sink inside the level threshold", () => {
    const logger = new Logger("Engine", "info");
    const first: LogEntry[] = [];
    const second: LogEntry[] = [];
    logger.addSink((item) => first.push(item));
    logger.addSink((item) => second.push(item));

    logger.debug("hidden");
    logger.info("visible", { a: 1 });
    logger.error("boom");

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(first[0].level).toBe("info");
    expect(first[0].context).toBe("Engine");
    expect(first[0].data).toEqual({ a: 1 });
    expect(first[1].level).toBe("error");
    expect(first[0].id).toBeLessThan(first[1].id);
  });

  it("shares sinks with child loggers and prefixes their context", () => {
    const logger = new Logger("Engine", "debug");
    const entries: LogEntry[] = [];
    logger.addSink((item) => entries.push(item));
    const child = logger.child("Physics");
    child.warn("bad body");
    expect(entries).toHaveLength(1);
    expect(entries[0].context).toBe("Engine:Physics");
    expect(child.sinkCount()).toBe(1);
  });

  it("removes sinks and survives throwing sinks", () => {
    const logger = new Logger("Engine", "debug");
    const entries: LogEntry[] = [];
    const off = logger.addSink(() => {
      throw new Error("sink exploded");
    });
    logger.addSink((item) => entries.push(item));
    logger.info("still delivered");
    expect(entries).toHaveLength(1);
    off();
    expect(logger.sinkCount()).toBe(1);
  });

  it("exposes level helpers and changes the threshold at runtime", () => {
    const logger = new Logger("Engine", "error");
    const entries: LogEntry[] = [];
    logger.addSink((item) => entries.push(item));
    logger.warn("ignored");
    logger.setLevel("debug");
    logger.warn("kept");
    expect(entries).toHaveLength(1);
    expect(logger.getLevel()).toBe("debug");
    expect(logger.getContext()).toBe("Engine");
  });

  it("feeds a LogBuffer end to end", () => {
    const logger = new Logger("Engine", "debug");
    const buffer = new LogBuffer();
    logger.addSink(buffer.push);
    const child = logger.child("SceneManager");
    child.info("Registered scene \"menu\"");
    child.error("Boom", new Error("kaboom"));
    expect(buffer.size()).toBe(2);
    expect(buffer.filter({ text: "registered" })).toHaveLength(1);
    expect(buffer.counts().error).toBe(1);
  });
});
