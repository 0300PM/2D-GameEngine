import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assetUrl } from "../../apps/playground/src/assets";
import { readUrlState, writeUrlState } from "../../apps/playground/src/url-state";

const withBase = (base: string | null): void => {
  document.head.querySelectorAll('meta[name="b2d-base"]').forEach((node) => node.remove());
  if (base === null) return;
  const meta = document.createElement("meta");
  meta.name = "b2d-base";
  meta.content = base;
  document.head.appendChild(meta);
};

describe("playground asset URLs", () => {
  beforeEach(() => {
    withBase("./");
    delete (window as unknown as { __B2D_ASSETS__?: Record<string, string> }).__B2D_ASSETS__;
  });

  afterEach(() => {
    withBase(null);
    delete (window as unknown as { __B2D_ASSETS__?: Record<string, string> }).__B2D_ASSETS__;
  });

  it("prefers the inlined data URI when present", () => {
    (window as unknown as { __B2D_ASSETS__?: Record<string, string> }).__B2D_ASSETS__ = {
      player: "data:image/png;base64,AAA"
    };
    expect(assetUrl("player", "/assets/player.png")).toBe("data:image/png;base64,AAA");
  });

  it("falls back to a base-relative path", () => {
    expect(assetUrl("player", "/assets/player.png")).toBe("./assets/player.png");
  });

  it("keeps a subpath mount intact", () => {
    withBase("/game/");
    expect(assetUrl("coin", "/assets/coin.png")).toBe("/game/assets/coin.png");
  });

  it("normalises a base without a trailing slash", () => {
    withBase("./build");
    expect(assetUrl("tiles", "/assets/tiles.png")).toBe("./build/assets/tiles.png");
  });

  it("uses an absolute base when the meta is missing", () => {
    withBase(null);
    expect(assetUrl("spark", "/assets/spark.png")).toBe("/assets/spark.png");
  });
});

describe("playground URL state", () => {
  it("reads language and example", () => {
    expect(readUrlState("?example=menu&lang=en")).toEqual({ example: "menu", lang: "en" });
  });

  it("ignores unsupported languages", () => {
    expect(readUrlState("?lang=de").lang).toBeNull();
  });

  it("returns nulls for empty search", () => {
    expect(readUrlState("")).toEqual({ example: null, lang: null });
  });

  it("writes state without dropping existing params", () => {
    window.history.replaceState(null, "", "/?example=menu");
    writeUrlState({ lang: "en" });
    const params = new URLSearchParams(window.location.search);
    expect(params.get("example")).toBe("menu");
    expect(params.get("lang")).toBe("en");
  });

  it("skips empty values", () => {
    window.history.replaceState(null, "", "/");
    writeUrlState({ example: undefined });
    expect(window.location.search).toBe("");
  });
});
