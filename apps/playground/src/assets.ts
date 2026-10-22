type AssetMap = Record<string, string>;

const inline = (name: string): string | undefined => {
  const map = (window as unknown as { __B2D_ASSETS__?: AssetMap }).__B2D_ASSETS__;
  return map?.[name];
};

const basePath = (): string => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="b2d-base"]');
  const value = meta?.content?.trim() || "/";
  return value.endsWith("/") ? value : `${value}/`;
};

export const assetUrl = (name: string, path: string): string =>
  inline(name) ?? `${basePath()}${path.replace(/^\/+/, "")}`;
