import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { repoRoot } from "./paths";

const compactStamp = (iso: string): string => iso.replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");

export const buildMeta = (options: { base: string; mode: string }): Plugin => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string };
  const builtAt = new Date().toISOString();
  const id = `${pkg.version}+${compactStamp(builtAt)}`;

  return {
    name: "b2d-build-meta",
    transformIndexHtml() {
      return {
        html: "",
        tags: [
          { tag: "meta", attrs: { name: "b2d-build", content: id }, injectTo: "head-prepend" },
          { tag: "meta", attrs: { name: "b2d-built-at", content: builtAt }, injectTo: "head-prepend" },
          { tag: "meta", attrs: { name: "b2d-base", content: options.base }, injectTo: "head-prepend" },
          { tag: "meta", attrs: { name: "b2d-mode", content: options.mode }, injectTo: "head-prepend" }
        ]
      };
    }
  };
};

export const buildId = (): string => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { version: string };
  return pkg.version;
};
