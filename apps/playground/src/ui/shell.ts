import { currentLang, initLang, onLangChange, setLang, t } from "../i18n";
import { examples, findExample, type PlaygroundExample } from "../examples";

export type ShellOptions = {
  onRun: (example: PlaygroundExample) => void;
  onOpen: () => void;
  onClose: () => void;
};

export type Shell = {
  setStatus: (pl: string, en: string) => void;
  setExample: (example: PlaygroundExample) => void;
  openExamples: () => void;
  closeExamples: () => void;
  isModalOpen: () => boolean;
};

const THEME_KEY = "b2d-theme";

const pick = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

const readTheme = (): string | null => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
};

export const mountShell = (options: ShellOptions): Shell => {
  initLang();

  const modal = pick<HTMLDivElement>("#examples-modal");
  const list = pick<HTMLUListElement>("#example-list");
  const filter = pick<HTMLInputElement>("#example-filter");
  const activeTitle = pick<HTMLElement>("#active-example");
  const status = pick<HTMLElement>("#status");
  const frame = pick<HTMLElement>("#frame");
  const openButton = pick<HTMLButtonElement>("#open-examples");

  let statusPl = "";
  let statusEn = "";
  let query = "";
  let highlighted = 0;
  let activeExample: PlaygroundExample = examples[0];
  let lastFocused: Element | null = null;

  const renderStatus = (): void => {
    status.textContent = currentLang() === "pl" ? statusPl : statusEn;
  };

  const renderActive = (): void => {
    activeTitle.textContent = activeExample.title[currentLang()];
  };

  const visibleExamples = (): PlaygroundExample[] => {
    const term = query.trim().toLowerCase();
    if (!term) return examples;
    return examples.filter((example) =>
      [
        example.title.pl,
        example.title.en,
        example.description.pl,
        example.description.en,
        example.tags.join(" "),
        example.id
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  };

  const renderList = (): void => {
    const items = visibleExamples();
    if (!items.length) {
      list.innerHTML = `<li class="empty">${t("Brak przykładów dla tego filtra.", "No examples match this filter.")}</li>`;
      return;
    }
    highlighted = Math.min(Math.max(highlighted, 0), items.length - 1);
    list.innerHTML = items
      .map((example, index) => {
        const isReady = example.status === "ready";
        const state = isReady ? t("Gotowe", "Ready") : t("Wkrótce", "Planned");
        const action = isReady
          ? `<button type="button" class="btn run" data-run="${example.id}">${t("Uruchom", "Run")}</button>`
          : "";
        return `<li>
          <div class="row${index === highlighted ? " active" : ""}" data-id="${example.id}" role="button" tabindex="0">
            <span class="idx mono">${example.index}</span>
            <div class="body">
              <div class="title">${example.title[currentLang()]}
                <span class="state${isReady ? " ready" : ""}">${state}</span>
              </div>
              <div class="desc">${example.description[currentLang()]}</div>
              <div class="tags">${example.tags.map((tag) => `<i>${tag}</i>`).join("")}</div>
            </div>
            <div class="tail">${action}</div>
          </div>
        </li>`;
      })
      .join("");
  };

  const focusHighlighted = (): void => {
    const rows = list.querySelectorAll<HTMLElement>(".row");
    rows[highlighted]?.focus();
  };

  const run = (example: PlaygroundExample): void => {
    if (example.status !== "ready" || !example.scene) return;
    closeModal();
    options.onRun(example);
  };

  function openModal(): void {
    lastFocused = document.activeElement;
    query = "";
    filter.value = "";
    highlighted = Math.max(
      visibleExamples().findIndex((example) => example.id === activeExample.id),
      0
    );
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderList();
    filter.focus();
    options.onOpen();
  }

  function closeModal(): void {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    const target = lastFocused instanceof HTMLElement && lastFocused !== document.body ? lastFocused : openButton;
    target.focus();
    options.onClose();
  }

  const applyTheme = (theme: string): void => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      void error;
    }
  };

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.requestFullscreen();
    } catch (error) {
      void error;
    }
  };

  const syncLanguage = (): void => {
    document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((button) => {
      button.classList.toggle("on", button.dataset.setLang === currentLang());
    });
    filter.placeholder = t("Filtruj przykłady…", "Filter examples…");
    renderStatus();
    renderActive();
    if (!modal.hidden) renderList();
  };

  document.querySelectorAll<HTMLButtonElement>("[data-set-lang]").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.setLang === "en" ? "en" : "pl"));
  });

  pick<HTMLButtonElement>("#theme").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  openButton.addEventListener("click", openModal);
  pick<HTMLButtonElement>("#fullscreen").addEventListener("click", () => void toggleFullscreen());

  modal.querySelectorAll<HTMLElement>("[data-close]").forEach((element) => {
    element.addEventListener("click", () => closeModal());
  });

  filter.addEventListener("input", () => {
    query = filter.value;
    highlighted = 0;
    renderList();
  });

  list.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const runButton = target.closest<HTMLButtonElement>("[data-run]");
    const row = target.closest<HTMLElement>(".row");
    const example = findExample((runButton?.dataset.run ?? row?.dataset.id) ?? "");
    if (!example) return;
    if (example.status === "ready") {
      run(example);
      return;
    }
    highlighted = visibleExamples().findIndex((item) => item.id === example.id);
    renderList();
    focusHighlighted();
  });

  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = (event.target as HTMLElement).closest<HTMLElement>(".row");
    if (!row) return;
    event.preventDefault();
    const example = findExample(row.dataset.id ?? "");
    if (example) run(example);
  });

  document.addEventListener("keydown", (event) => {
    if (!modal.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = visibleExamples().length;
        highlighted =
          event.key === "ArrowDown"
            ? Math.min(highlighted + 1, items - 1)
            : Math.max(highlighted - 1, 0);
        renderList();
        focusHighlighted();
      }
      return;
    }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "");
    if (typing) return;
    if (event.code === "KeyE") {
      event.preventDefault();
      openModal();
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      void toggleFullscreen();
    }
  });

  onLangChange(syncLanguage);

  const storedTheme = readTheme();
  if (storedTheme) applyTheme(storedTheme);
  syncLanguage();

  return {
    setStatus: (pl, en) => {
      statusPl = pl;
      statusEn = en;
      renderStatus();
    },
    setExample: (example) => {
      activeExample = example;
      renderActive();
    },
    openExamples: openModal,
    closeExamples: closeModal,
    isModalOpen: () => !modal.hidden
  };
};
