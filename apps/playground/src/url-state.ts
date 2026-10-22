export type UrlState = {
  example: string | null;
  lang: "pl" | "en" | null;
};

export const readUrlState = (search: string = window.location.search): UrlState => {
  const params = new URLSearchParams(search);
  const lang = params.get("lang");
  return {
    example: params.get("example"),
    lang: lang === "pl" || lang === "en" ? lang : null
  };
};

export const writeUrlState = (patch: Record<string, string | undefined>): void => {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url.toString());
};
