import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inlineScriptHashes, strictCsp } from "../../scripts/hosting-server.mjs";

const dir = (html: string): string => {
  const root = mkdtempSync(join(tmpdir(), "b2d-host-"));
  writeFileSync(join(root, "index.html"), html, "utf8");
  return root;
};

describe("hosting CSP", () => {
  it("hashes only inline scripts", () => {
    const root = dir(
      '<script src="./assets/index.js"></script><script>window.a=1;</script><script>window.b=2;</script>'
    );
    const hashes = inlineScriptHashes(root);
    expect(hashes).toHaveLength(2);
    expect(hashes.every((hash: string) => hash.startsWith("'sha256-"))).toBe(true);
  });

  it("skips empty inline scripts", () => {
    const root = dir("<script>   </script><script></script>");
    expect(inlineScriptHashes(root)).toEqual([]);
  });

  it("returns no hashes when index.html is missing", () => {
    expect(inlineScriptHashes(mkdtempSync(join(tmpdir(), "b2d-empty-")))).toEqual([]);
  });

  it("builds a policy without unsafe-inline scripts", () => {
    const policy = strictCsp(["'sha256-abc'"]);
    expect(policy).toContain("script-src 'self' 'sha256-abc'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
  });

  it("keeps data and blob sources for canvas and audio", () => {
    const policy = strictCsp([]);
    expect(policy).toContain("img-src 'self' data: blob:");
    expect(policy).toContain("media-src 'self' data: blob:");
  });
});
