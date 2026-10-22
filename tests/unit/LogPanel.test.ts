import { afterEach, describe, expect, it } from "vitest";
import { LogBuffer } from "../../packages/engine/src/debug/LogBuffer";
import { LogPanel } from "../../packages/engine/src/debug/LogPanel";
import type { LogEntry } from "../../packages/engine/src/systems/Logger";

let counter = 0;
const push = (buffer: LogBuffer, level: LogEntry["level"], message: string, context = "Engine"): void => {
  counter += 1;
  buffer.push({ id: counter, time: counter * 1000, level, context, message });
};

const host = (): HTMLDivElement => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return element;
};

const rows = (parent: HTMLElement): number =>
  parent.querySelectorAll("[data-b2d-log-panel] div[style*='display:flex']").length;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("LogPanel", () => {
  it("builds the panel lazily and toggles visibility", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);

    const element = parent.querySelector<HTMLElement>("[data-b2d-log-panel]");
    expect(element).not.toBeNull();
    expect(element?.style.display).toBe("none");

    expect(panel.toggle()).toBe(true);
    expect(panel.isVisible()).toBe(true);
    expect(element?.style.display).toBe("flex");

    panel.setVisible(false);
    expect(element?.style.display).toBe("none");
    expect(panel.isVisible()).toBe(false);
    panel.destroy();
  });

  it("renders entries with level, context and message", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);

    push(buffer, "info", "Engine started", "Engine");
    push(buffer, "warn", "Asset missing", "Engine:Assets");
    panel.refresh(true);

    const text = parent.querySelector("[data-b2d-log-panel]")?.textContent ?? "";
    expect(text).toContain("Engine started");
    expect(text).toContain("Asset missing");
    expect(text).toContain("Engine:Assets");
    expect(text).toContain("warn 1");
    expect(rows(parent)).toBe(2);
  });

  it("filters by text typed into the search field", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    push(buffer, "info", "Scene started");
    push(buffer, "error", "Scene failed");
    push(buffer, "info", "Audio unlocked");
    panel.refresh(true);

    const search = parent.querySelector<HTMLInputElement>("[data-b2d-log-panel] input")!;
    search.value = "scene";
    search.dispatchEvent(new Event("input"));
    expect(rows(parent)).toBe(2);

    search.value = "audio";
    search.dispatchEvent(new Event("input"));
    expect(rows(parent)).toBe(1);
  });

  it("toggles levels through the counter buttons", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    push(buffer, "debug", "debug line");
    push(buffer, "info", "info line");
    push(buffer, "error", "error line");
    panel.refresh(true);
    expect(rows(parent)).toBe(3);

    const buttons = parent.querySelectorAll<HTMLButtonElement>("[data-b2d-log-panel] button");
    const debugButton = Array.from(buttons).find((button) => button.textContent?.startsWith("debug"))!;
    debugButton.click();
    expect(rows(parent)).toBe(2);

    const errorButton = Array.from(buttons).find((button) => button.textContent?.startsWith("error"))!;
    errorButton.click();
    expect(rows(parent)).toBe(1);
  });

  it("cycles through contexts and clears the buffer", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    push(buffer, "info", "one", "Engine:A");
    push(buffer, "info", "two", "Engine:B");
    panel.refresh(true);

    const buttons = Array.from(parent.querySelectorAll<HTMLButtonElement>("[data-b2d-log-panel] button"));
    const contextButton = buttons.find((button) => button.textContent === "All contexts")!;
    contextButton.click();
    expect(contextButton.textContent).toBe("Engine:A");
    expect(rows(parent)).toBe(1);

    const clearButton = buttons.find((button) => button.textContent === "Clear")!;
    clearButton.click();
    expect(buffer.size()).toBe(0);
    expect(parent.textContent).toContain("No entries match the filter");
  });

  it("shows an empty state when nothing matches", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    push(buffer, "info", "only line");
    panel.setFilter({ text: "zzz" });
    expect(parent.textContent).toContain("No entries match the filter");
  });

  it("throttles refresh but reacts to buffer changes", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    panel.update(1000);
    push(buffer, "info", "fresh entry");
    panel.update(2000);
    expect(parent.textContent).toContain("fresh entry");
  });

  it("accepts custom labels", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer, {
      labels: { title: "Logi", filter: "Filtruj…", clear: "Wyczyść", empty: "Brak wpisów", context: "Wszystkie" }
    });
    panel.mount(parent);
    panel.setVisible(true);
    expect(parent.textContent).toContain("Logi");
    expect(parent.textContent).toContain("Wyczyść");
    expect(parent.querySelector<HTMLInputElement>("input")?.placeholder).toBe("Filtruj…");
  });

  it("escapes html in messages", () => {
    const parent = host();
    const buffer = new LogBuffer();
    const panel = new LogPanel(buffer);
    panel.mount(parent);
    panel.setVisible(true);
    push(buffer, "error", "<img src=x onerror=alert(1)>");
    panel.refresh(true);
    expect(parent.querySelector("img")).toBeNull();
    expect(parent.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
