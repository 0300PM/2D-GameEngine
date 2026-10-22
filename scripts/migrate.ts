import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatMigrationSummary, migrateText } from "../packages/engine/src/project/MigrateTool";

const USAGE = `Migracja danych Browser2DEngine

  node scripts/migrate.mjs --kind=project --in=project.json --out=project.v2.json
  node scripts/migrate.mjs --kind=save --in=save.json --check
  node scripts/migrate.mjs --kind=project --stdio < project.json > project.out.json

Opcje:
  --kind=project|save     rodzaj danych (domyślnie project)
  --in=PLIK               plik wejściowy (albo dane ze standardowego wejścia)
  --out=PLIK              plik wyjściowy (bez tego wynik idzie na stdout)
  --check                 tylko sprawdź zgodność, nic nie zapisuj
  --require-licenses      odrzuć projekt z zasobem bez licencji
  --stdio                 czytaj ze standardowego wejścia
`;

const args = process.argv.slice(2);
const arg = (name: string, fallback: string | null = null): string | null => {
  const hit = args.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const kind = (arg("kind", "project") ?? "project") as "project" | "save";
const input = arg("in") ?? arg("input");
const output = arg("out");
const checkOnly = args.includes("--check");
const stdio = args.includes("--stdio");

if (!input && !stdio) {
  console.error(USAGE);
  process.exit(2);
}

if (kind !== "project" && kind !== "save") {
  console.error(`Nieznany rodzaj: ${kind} (dozwolone: project, save)`);
  process.exit(2);
}

const text = input ? readFileSync(resolve(input), "utf8") : readFileSync(0, "utf8");
const result = migrateText(text, kind, { requireLicenses: args.includes("--require-licenses") });

console.error(formatMigrationSummary(result));
for (const warning of result.warnings) console.error(`  ostrzeżenie: ${warning}`);

if (!result.ok || result.text === null) {
  for (const problem of result.errors) {
    console.error(`  ${problem.code}${problem.path ? ` @ ${problem.path}` : ""}: ${problem.message}`);
  }
  process.exit(1);
}

if (checkOnly) {
  console.error("OK: dane są zgodne z bieżącym formatem.");
  process.exit(0);
}

if (output) {
  writeFileSync(resolve(output), result.text, "utf8");
  console.error(`zapisano ${resolve(output)}`);
} else {
  process.stdout.write(result.text);
}
