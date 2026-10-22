export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  raw: string;
};

const PART_PATTERN = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

export const parseVersion = (input: string): ParsedVersion | null => {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (value === "") return null;
  const match = PART_PATTERN.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: match[2] === undefined ? 0 : Number(match[2]),
    patch: match[3] === undefined ? 0 : Number(match[3]),
    prerelease: match[4] ?? "",
    raw: value
  };
};

const hasPart = (input: string, index: 1 | 2 | 3): boolean => {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(input.trim());
  if (!match) return false;
  return match[index] !== undefined;
};

const comparePrerelease = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return a < b ? -1 : 1;
};

export const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error(`Cannot compare versions "${a}" and "${b}"`);
  if (left.major !== right.major) return left.major < right.major ? -1 : 1;
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;
  return comparePrerelease(left.prerelease, right.prerelease);
};

const bumpMajor = (version: ParsedVersion): string => `${version.major + 1}.0.0`;
const bumpMinor = (version: ParsedVersion): string => `${version.major}.${version.minor + 1}.0`;

const caretRange = (raw: string): string[] => {
  const version = parseVersion(raw);
  if (!version) return [];
  if (!hasPart(raw, 1)) return [];
  if (version.major > 0) return [`>=${raw}`, `<${bumpMajor(version)}`];
  if (hasPart(raw, 2) && version.minor > 0) return [`>=${raw}`, `<${bumpMinor(version)}`];
  if (hasPart(raw, 3) && version.patch > 0) return [`>=${raw}`, `<0.0.${version.patch + 1}`];
  return [`>=${raw}`, `<0.1.0`];
};

const tildeRange = (raw: string): string[] => {
  const version = parseVersion(raw);
  if (!version) return [];
  if (!hasPart(raw, 2)) return [`>=${raw}`, `<${version.major + 1}.0.0`];
  return [`>=${raw}`, `<${bumpMinor(version)}`];
};

const comparatorList = (range: string): string[] => {
  const trimmed = range.trim();
  if (trimmed === "" || trimmed === "*" || trimmed === "x" || trimmed === "X") return [];
  const comparators: string[] = [];
  for (const token of trimmed.split(/\s+/)) {
    if (token === "") continue;
    if (token.startsWith("^")) comparators.push(...caretRange(token.slice(1)));
    else if (token.startsWith("~")) comparators.push(...tildeRange(token.slice(1)));
    else if (token.startsWith("=")) comparators.push(token.slice(1));
    else comparators.push(token);
  }
  return comparators;
};

const matchesComparator = (version: string, comparator: string): boolean => {
  if (comparator === "") return true;
  if (comparator.startsWith(">=")) return compareVersions(version, comparator.slice(2)) >= 0;
  if (comparator.startsWith("<=")) return compareVersions(version, comparator.slice(2)) <= 0;
  if (comparator.startsWith(">")) return compareVersions(version, comparator.slice(1)) > 0;
  if (comparator.startsWith("<")) return compareVersions(version, comparator.slice(1)) < 0;
  const exact = parseVersion(comparator);
  if (!exact) return false;
  if (!hasPart(comparator, 2)) return parseVersion(version)?.major === exact.major;
  if (!hasPart(comparator, 3)) {
    const target = parseVersion(version);
    return target ? target.major === exact.major && target.minor === exact.minor : false;
  }
  return compareVersions(version, comparator) === 0;
};

const matchesRange = (version: string, range: string): boolean => {
  const comparators = comparatorList(range);
  return comparators.every((comparator) => matchesComparator(version, comparator));
};

const isValidComparator = (comparator: string): boolean => {
  if (comparator === "") return true;
  const body = comparator.replace(/^(>=|<=|>|<|=)/, "");
  return parseVersion(body) !== null;
};

export const isValidRange = (range: string): boolean => {
  if (typeof range !== "string" || range.trim() === "") return false;
  return range.split("||").every((alternative) => {
    const trimmed = alternative.trim();
    if (trimmed === "" || trimmed === "*" || trimmed === "x" || trimmed === "X") return true;
    return trimmed.split(/\s+/).every((token) => {
      if (token.startsWith("^") || token.startsWith("~")) return parseVersion(token.slice(1)) !== null;
      return isValidComparator(token.startsWith("=") ? token.slice(1) : token);
    });
  });
};

export const satisfiesRange = (version: string, range: string): boolean => {
  if (!parseVersion(version)) return false;
  if (!isValidRange(range)) return false;
  return range.split("||").some((alternative) => matchesRange(version, alternative));
};
