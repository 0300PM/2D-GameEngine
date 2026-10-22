import type { SaveStore } from "./SaveStore";

export type SqlDialect = "postgres" | "mysql";

export type SqlQueryResult<T> = {
  rows: T[];
  affectedRows?: number;
};

export interface SqlClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<SqlQueryResult<T>>;
}

export type SqlStoreOptions = {
  dialect: SqlDialect;
  table?: string;
};

const TABLE_PATTERN = /^[a-z][a-z0-9_]*$/;

const resolveTable = (table?: string): string => {
  const name = table ?? "b2d_entries";
  if (!TABLE_PATTERN.test(name)) throw new Error(`Invalid SQL table name "${name}"`);
  return name;
};

const placeholder = (dialect: SqlDialect, index: number): string => (dialect === "postgres" ? `$${index}` : "?");

export const sqlSchema = (options: SqlStoreOptions): string[] => {
  const table = resolveTable(options.table);
  if (options.dialect === "postgres") {
    return [
      `CREATE TABLE IF NOT EXISTS ${table} (entry_key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS ${table}_updated_idx ON ${table} (updated_at)`
    ];
  }
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (entry_key VARCHAR(191) PRIMARY KEY, value LONGTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE INDEX ${table}_updated_idx ON ${table} (updated_at)`
  ];
};

export const sqlGet = (options: SqlStoreOptions): string =>
  `SELECT value FROM ${resolveTable(options.table)} WHERE entry_key = ${placeholder(options.dialect, 1)}`;

export const sqlSet = (options: SqlStoreOptions): string => {
  const table = resolveTable(options.table);
  const first = placeholder(options.dialect, 1);
  const second = placeholder(options.dialect, 2);
  if (options.dialect === "postgres") {
    return `INSERT INTO ${table} (entry_key, value) VALUES (${first}, ${second}) ON CONFLICT (entry_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
  return `INSERT INTO ${table} (entry_key, value) VALUES (${first}, ${second}) ON DUPLICATE KEY UPDATE value = VALUES(value)`;
};

export const sqlDelete = (options: SqlStoreOptions): string =>
  `DELETE FROM ${resolveTable(options.table)} WHERE entry_key = ${placeholder(options.dialect, 1)}`;

export const sqlKeys = (options: SqlStoreOptions): string => `SELECT entry_key FROM ${resolveTable(options.table)} ORDER BY entry_key`;

export const sqlClear = (options: SqlStoreOptions): string => `DELETE FROM ${resolveTable(options.table)}`;

export class SqlSaveStore implements SaveStore {
  private options: SqlStoreOptions;

  constructor(
    private client: SqlClient,
    options: SqlStoreOptions
  ) {
    this.options = { ...options, table: resolveTable(options.table) };
  }

  async init(): Promise<void> {
    for (const statement of sqlSchema(this.options)) await this.client.query(statement);
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.query<{ value?: string }>(sqlGet(this.options), [key]);
    return result.rows[0]?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.query(sqlSet(this.options), [key, value]);
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.query(sqlDelete(this.options), [key]);
    return (result.affectedRows ?? 1) > 0;
  }

  async keys(): Promise<string[]> {
    const result = await this.client.query<{ entry_key?: string }>(sqlKeys(this.options));
    return result.rows.map((row) => String(row.entry_key ?? "")).filter(Boolean).sort();
  }

  async clear(): Promise<void> {
    await this.client.query(sqlClear(this.options));
  }
}
