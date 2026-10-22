export type Lang = "pl" | "en";

const STORAGE_KEY = "b2d-lang";
const CHANGE_EVENT = "playground:lang";

const readStored = (): Lang | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "pl" || value === "en" ? value : null;
  } catch (error) {
    return null;
  }
};

export const currentLang = (): Lang =>
  document.body.dataset.lang === "en" ? "en" : "pl";

export const t = (pl: string, en: string): string =>
  currentLang() === "pl" ? pl : en;

export const setLang = (lang: Lang): void => {
  document.body.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (error) {
    void error;
  }
  window.dispatchEvent(new CustomEvent<Lang>(CHANGE_EVENT, { detail: lang }));
};

export const onLangChange = (handler: (lang: Lang) => void): (() => void) => {
  const listener = (event: Event): void => {
    handler((event as CustomEvent<Lang>).detail);
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
};

export const initLang = (): void => {
  setLang(readStored() ?? "pl");
};
