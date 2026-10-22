(function () {
  const pages = window.__DOCS__;
  const groups = window.__GROUPS__;
  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        return;
      }
    },
  };

  const byId = new Map(pages.map((page) => [page.id, page]));
  const root = document.getElementById("content");
  const side = document.getElementById("side");
  const toc = document.getElementById("toc");
  const input = document.getElementById("q");
  const hits = document.getElementById("hits");
  let current = null;
  let observer = null;

  const lang = () => document.body.dataset.lang || "pl";
  const title = (page) => page.title[lang()];
  const groupLabel = (key) => groups[key][lang() === "pl" ? 1 : 2];

  function slug(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\u0100-\u017f]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function renderNav() {
    const order = [];
    const bucket = {};
    pages.forEach((page) => {
      if (!bucket[page.group]) {
        bucket[page.group] = [];
        order.push(page.group);
      }
      bucket[page.group].push(page);
    });
    side.innerHTML = order
      .map((key) => {
        const links = bucket[key]
          .map((page) => `<a href="#${page.id}" data-id="${page.id}">${title(page)}</a>`)
          .join("");
        return `<div class="side-group"><h3>${groupLabel(key)}</h3>${links}</div>`;
      })
      .join("");
    side.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => side.classList.remove("open"));
    });
  }

  const headingText = (head) => {
    const localized = head.querySelector(`[data-${lang()}]`);
    if (localized) return localized.textContent.trim();
    const clone = head.cloneNode(true);
    clone.querySelectorAll("[data-pl], [data-en]").forEach((node) => node.remove());
    return (clone.textContent || head.textContent || "").trim();
  };

  function buildToc(section) {
    const heads = [...section.querySelectorAll("h2, h3")].filter(
      (head) => !head.hasAttribute(lang() === "pl" ? "data-en" : "data-pl")
    );
    if (!heads.length) {
      toc.innerHTML = "";
      return;
    }
    heads.forEach((head, index) => {
      if (!head.id) head.id = `s-${index}-${slug(headingText(head))}`;
    });
    const links = heads
      .map((head) => {
        const level = head.tagName === "H2" ? "lvl2" : "lvl3";
        return `<a href="#${current}" data-target="${head.id}" class="${level}">${headingText(head)}</a>`;
      })
      .join("");
    toc.innerHTML =
      '<h4 data-pl>Na tej stronie</h4><h4 data-en>On this page</h4>' + links;
    toc.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = section.querySelector('[id="' + link.dataset.target + '"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    if (observer) observer.disconnect();
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          toc.querySelectorAll("a").forEach((link) => {
            link.classList.toggle("on", link.dataset.target === entry.target.id);
          });
        });
      },
      { rootMargin: "-72px 0px -70% 0px" }
    );
    heads.forEach((head) => observer.observe(head));
  }

  function renderPager(section, page) {
    const index = pages.findIndex((item) => item.id === page.id);
    const prev = pages[index - 1];
    const next = pages[index + 1];
    const prevLabel = lang() === "pl" ? "Poprzednia" : "Previous";
    const nextLabel = lang() === "pl" ? "Następna" : "Next";
    const left = prev
      ? `<a href="#${prev.id}"><small>&larr; ${prevLabel}</small>${title(prev)}</a>`
      : "<span></span>";
    const right = next
      ? `<a class="next" href="#${next.id}"><small>${nextLabel} &rarr;</small>${title(next)}</a>`
      : "<span></span>";
    const pager = section.querySelector(".pager");
    if (pager) pager.innerHTML = left + right;
  }

  function go(id) {
    const page = byId.get(id) || pages[0];
    current = page.id;
    const section = root.querySelector('[data-page="' + page.id + '"]');
    root.querySelectorAll("[data-page]").forEach((item) => {
      item.classList.toggle("hide", item !== section);
    });
    side.querySelectorAll("a").forEach((link) => {
      link.classList.toggle("on", link.dataset.id === page.id);
    });
    const crumb = section.querySelector(".crumb-group");
    if (crumb) crumb.textContent = groupLabel(page.group);
    buildToc(section);
    renderPager(section, page);
    document.title = title(page) + " — Browser2DEngine";
    try {
      history.replaceState(null, "", "#" + page.id);
    } catch (error) {
      return;
    }
    try {
      window.scrollTo(0, 0);
    } catch (error) {
      return;
    }
  }

  function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.left = "-1000px";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        return legacyCopy(text);
      }
    }
    return legacyCopy(text);
  }

  async function copyCode(button) {
    const block = button.closest(".code");
    const codeEl = block ? block.querySelector("pre") : null;
    if (!codeEl) return;
    const text = (codeEl.textContent || "").trimEnd();
    const ok = await copyText(text);
    if (!ok) {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    button.dataset.busy = "1";
    button.textContent = ok
      ? lang() === "pl"
        ? "Skopiowano"
        : "Copied"
      : lang() === "pl"
      ? "Zaznaczono"
      : "Selected";
    button.classList.toggle("done", ok);
    setTimeout(() => {
      delete button.dataset.busy;
      button.textContent = lang() === "pl" ? button.dataset.labelPl : button.dataset.labelEn;
      button.classList.remove("done");
    }, 1400);
  }

  function syncCopyLabels() {
    document.querySelectorAll(".copy").forEach((button) => {
      if (button.dataset.busy) return;
      button.textContent = lang() === "pl" ? button.dataset.labelPl : button.dataset.labelEn;
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".copy");
    if (!button) return;
    event.preventDefault();
    copyCode(button);
  });

  const normalise = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0142/g, "l");

  function search(value) {
    const term = normalise(value.trim());
    if (!term) {
      hits.classList.remove("on");
      hits.innerHTML = "";
      return;
    }
    const scored = pages
      .map((page) => {
        const title = normalise(page.title.pl + " " + page.title.en);
        const keywords = normalise(page.keywords);
        const text = normalise(page.text || "");
        let score = 0;
        if (title.includes(term)) score += 6;
        if (keywords.includes(term)) score += 3;
        if (text.includes(term)) score += 1;
        return { page, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 8).map((entry) => entry.page);
    hits.innerHTML = results.length
      ? results
          .map(
            (page) =>
              `<a class="hit" href="#${page.id}">${title(page)}<small>${groupLabel(
                page.group
              )} · ${page.id}</small></a>`
          )
          .join("")
      : `<div class="hit">${lang() === "pl" ? "Brak wyników" : "No results"}</div>`;
    hits.classList.add("on");
    hits.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hits.classList.remove("on");
        input.value = "";
      });
    });
  }

  function setLang(next) {
    document.body.dataset.lang = next;
    document.documentElement.lang = next;
    store.set("b2d-lang", next);
    document.querySelectorAll("[data-set-lang]").forEach((button) => {
      button.classList.toggle("on", button.dataset.setLang === next);
    });
    input.placeholder = next === "pl" ? "Szukaj w dokumentacji" : "Search the docs";
    renderNav();
    syncCopyLabels();
    if (current) go(current);
  }

  function setTheme(next) {
    document.documentElement.dataset.theme = next;
    store.set("b2d-theme", next);
  }

  document.querySelectorAll("[data-set-lang]").forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.setLang));
  });

  document.getElementById("theme").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });

  document.getElementById("menu").addEventListener("click", () => side.classList.toggle("open"));

  input.addEventListener("input", () => search(input.value));
  input.addEventListener("blur", () => setTimeout(() => hits.classList.remove("on"), 120));

  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (event.key === "/" && !typing) {
      event.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (event.key === "Escape") {
      hits.classList.remove("on");
      side.classList.remove("open");
      input.blur();
      return;
    }
    if (typing) return;
    const index = pages.findIndex((page) => page.id === current);
    if (event.key === "ArrowLeft" && index > 0) go(pages[index - 1].id);
    if (event.key === "ArrowRight" && index < pages.length - 1) go(pages[index + 1].id);
  });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1).split("#")[0];
    if (byId.has(id) && id !== current) go(id);
  });

  const savedTheme = store.get("b2d-theme");
  if (savedTheme) setTheme(savedTheme);
  const savedLang = store.get("b2d-lang");
  renderNav();
  document.querySelectorAll("[data-set-lang]").forEach((button) => {
    button.classList.toggle("on", button.dataset.setLang === (savedLang || "pl"));
  });
  if (savedLang === "en") setLang("en");
  else input.placeholder = "Szukaj w dokumentacji";
  syncCopyLabels();
  const initial = location.hash.slice(1).split("#")[0];
  go(byId.has(initial) ? initial : pages[0].id);
})();
