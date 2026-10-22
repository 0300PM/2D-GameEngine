import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_LEVEL, ENGINE_VERSION } from "../../packages/engine/src/version";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "packages/engine/src/index.ts");
const FIXTURE = join(ROOT, "tests/fixtures/public-api.json");

type Snapshot = { apiLevel: number; version: string; symbols: string[] };

const collectSymbols = (source: string): string[] => {
  const symbols = new Set<string>();
  const block = /export\s+(?:type\s+)?\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(source))) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) symbols.add(name);
    }
  }
  const direct = /export\s+(?:declare\s+)?(?:class|const|function|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  while ((match = direct.exec(source))) symbols.add(match[1]);
  return [...symbols].sort();
};

const build = (): Snapshot => ({
  apiLevel: API_LEVEL,
  version: ENGINE_VERSION,
  symbols: collectSymbols(readFileSync(SOURCE, "utf8"))
});

describe("public API snapshot", () => {
  it("matches the checked-in snapshot", () => {
    const next = build();
    if (process.env.UPDATE_API_SNAPSHOT === "1" || !existsSync(FIXTURE)) {
      mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    }
    const previous = JSON.parse(readFileSync(FIXTURE, "utf8")) as Snapshot;

    const added = next.symbols.filter((name) => !previous.symbols.includes(name));
    const removed = previous.symbols.filter((name) => !next.symbols.includes(name));

    expect(removed, `Usunięte symbole publiczne: ${removed.join(", ")} — to jest zmiana łamiąca`).toEqual([]);
    expect(added, `Nowe symbole publiczne: ${added.join(", ")} — odśwież snapshot: UPDATE_API_SNAPSHOT=1`).toEqual([]);
    expect({ version: next.version, apiLevel: next.apiLevel }).toEqual({ version: previous.version, apiLevel: previous.apiLevel });
  });

  it("exposes a stable entry point with at least 150 symbols", () => {
    expect(build().symbols.length).toBeGreaterThan(150);
  });

  it("keeps the version constants in sync with package.json", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "packages/engine/package.json"), "utf8")) as { version: string };
    expect(pkg.version).toBe(ENGINE_VERSION);
    expect(API_LEVEL).toBeGreaterThanOrEqual(1);
  });
});
