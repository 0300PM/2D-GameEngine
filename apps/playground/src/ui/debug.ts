import type { Engine } from "@engine";
import { t } from "../i18n";

type ViewKey = "colliders" | "grid" | "axes" | "cameraBounds";

export type DebugPanelOptions = {
  isBlocked?: () => boolean;
};

export type DebugPanel = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  sync: () => void;
};

const pick = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

export const mountDebugPanel = (engine: Engine, options: DebugPanelOptions = {}): DebugPanel => {
  const toggleButton = pick<HTMLButtonElement>("#debug-toggle");
  const panel = pick<HTMLDivElement>("#debug-panel");
  const supportNote = pick<HTMLParagraphElement>("#debug-support");
  const statusNote = pick<HTMLParagraphElement>("#debug-status");
  const pluginsSection = pick<HTMLDivElement>("#debug-plugins");
  const pluginPanels = pick<HTMLDivElement>("#plugin-panels");
  const pluginSummary = pick<HTMLParagraphElement>("#debug-plugin-summary");
  const boxes = new Map<string, HTMLInputElement>();
  panel.querySelectorAll<HTMLInputElement>("[data-debug]").forEach((box) => {
    if (box.dataset.debug) boxes.set(box.dataset.debug, box);
  });

  const overlay = engine.getDebugOverlay();
  const logs = engine.getLogPanel();
  const views = engine.getDebugViews();

  let statusTimer: number | null = null;

  const setStatus = (pl: string, en: string): void => {
    statusNote.hidden = false;
    statusNote.textContent = t(pl, en);
    if (statusTimer !== null) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      statusNote.hidden = true;
      statusTimer = null;
    }, 4000);
  };

  const syncSupport = (): void => {
    const support = views.getSupport();
    const unsupported = (Object.keys(support) as ViewKey[]).filter((key) => !support[key]);
    if (unsupported.length === 0) {
      supportNote.hidden = true;
      return;
    }
    supportNote.hidden = false;
    supportNote.classList.add("warn");
    supportNote.textContent = t(
      `Backend nie rysuje: ${unsupported.join(", ")}`,
      `Backend cannot draw: ${unsupported.join(", ")}`
    );
  };

  const applyOverlay = (enabled: boolean): void => {
    overlay.setEnabled(enabled);
    engine.getProfiler().setEnabled(enabled);
  };

  const applyView = (key: ViewKey, enabled: boolean): void => {
    const state = views.get();
    views.set({ ...state, [key]: enabled });
    syncSupport();
  };

  const sync = (): void => {
    const state = views.get();
    boxes.get("overlay")?.toggleAttribute("checked", overlay.isEnabled());
    if (boxes.has("overlay")) boxes.get("overlay")!.checked = overlay.isEnabled();
    boxes.get("logs")!.checked = logs.isVisible();
    boxes.get("colliders")!.checked = state.colliders;
    boxes.get("grid")!.checked = state.grid;
    boxes.get("axes")!.checked = state.axes;
    boxes.get("cameraBounds")!.checked = state.cameraBounds;
    syncSupport();
  };

  const mountPlugins = (): void => {
    const host = engine.getPlugins();
    const panels = host.getPanels().list();
    const summary = host.summary();
    pluginsSection.hidden = panels.length === 0;
    pluginSummary.hidden = panels.length === 0;
    pluginSummary.textContent = t(
      `Aktywne: ${summary.active}/${summary.total} · panele: ${summary.panels}`,
      `Active: ${summary.active}/${summary.total} · panels: ${summary.panels}`
    );
    pluginPanels.replaceChildren();
    for (const descriptor of panels) host.getPanels().mount(descriptor.id, pluginPanels);
  };

  const unmountPlugins = (): void => {
    for (const descriptor of engine.getPlugins().getPanels().list()) engine.getPlugins().getPanels().unmount(descriptor.id);
    pluginPanels.replaceChildren();
  };

  const open = (): void => {
    panel.hidden = false;
    toggleButton.setAttribute("aria-expanded", "true");
    sync();
    mountPlugins();
  };

  const close = (): void => {
    panel.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
    unmountPlugins();
  };

  const toggle = (): void => {
    if (panel.hidden) open();
    else close();
  };

  toggleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });

  panel.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => {
    if (!panel.hidden) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      close();
      return;
    }
  });

  boxes.get("overlay")?.addEventListener("change", (event) => {
    applyOverlay((event.target as HTMLInputElement).checked);
  });

  boxes.get("logs")?.addEventListener("change", (event) => {
    logs.setVisible((event.target as HTMLInputElement).checked);
  });

  (["colliders", "grid", "axes", "cameraBounds"] as const).forEach((key) => {
    boxes.get(key)?.addEventListener("change", (event) => {
      applyView(key, (event.target as HTMLInputElement).checked);
    });
  });

  pick<HTMLButtonElement>("#debug-export").addEventListener("click", () => {
    const ok = engine.getDiagnostics().download();
    setStatus(ok ? "Raport zapisany" : "Eksport niedostępny", ok ? "Report saved" : "Export unavailable");
  });

  pick<HTMLButtonElement>("#debug-copy").addEventListener("click", () => {
    void engine
      .getDiagnostics()
      .copy()
      .then((ok) => setStatus(ok ? "Raport w schowku" : "Brak dostępu do schowka", ok ? "Report copied" : "Clipboard unavailable"));
  });

  const shortcuts: Record<string, () => void> = {
    KeyU: () => {
      applyOverlay(!overlay.isEnabled());
      sync();
    },
    KeyL: () => {
      logs.toggle();
      sync();
    },
    KeyK: () => {
      applyView("colliders", !views.get().colliders);
      sync();
    },
    KeyG: () => {
      applyView("grid", !views.get().grid);
      sync();
    },
    KeyX: () => {
      applyView("axes", !views.get().axes);
      sync();
    },
    KeyB: () => {
      applyView("cameraBounds", !views.get().cameraBounds);
      sync();
    },
    KeyY: () => {
      const ok = engine.getDiagnostics().download();
      setStatus(ok ? "Raport zapisany" : "Eksport niedostępny", ok ? "Report saved" : "Export unavailable");
    }
  };

  document.addEventListener("keydown", (event) => {
    if (options.isBlocked?.()) return;
    const element = document.activeElement?.tagName ?? "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(element)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = shortcuts[event.code];
    if (!action) return;
    event.preventDefault();
    action();
  });

  sync();

  return { open, close, toggle, isOpen: () => !panel.hidden, sync };
};
