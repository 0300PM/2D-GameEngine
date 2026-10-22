const TABLE_PATTERN = /^[a-z][a-z0-9_]*$/;

export const resolveTable = (table = "b2d_entries") => {
  if (!TABLE_PATTERN.test(table)) throw new Error(`Invalid SQL table name "${table}"`);
  return table;
};

const placeholder = (dialect, index) => (dialect === "postgres" ? `$${index}` : "?");

export const schemaStatements = (dialect, tableInput) => {
  const table = resolveTable(tableInput);
  if (dialect === "postgres") {
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

export const selectStatement = (dialect, tableInput) =>
  `SELECT value FROM ${resolveTable(tableInput)} WHERE entry_key = ${placeholder(dialect, 1)}`;

export const upsertStatement = (dialect, tableInput) => {
  const table = resolveTable(tableInput);
  const first = placeholder(dialect, 1);
  const second = placeholder(dialect, 2);
  if (dialect === "postgres") {
    return `INSERT INTO ${table} (entry_key, value) VALUES (${first}, ${second}) ON CONFLICT (entry_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
  return `INSERT INTO ${table} (entry_key, value) VALUES (${first}, ${second}) ON DUPLICATE KEY UPDATE value = VALUES(value)`;
};

export const deleteStatement = (dialect, tableInput) =>
  `DELETE FROM ${resolveTable(tableInput)} WHERE entry_key = ${placeholder(dialect, 1)}`;

export const keysStatement = (dialect, tableInput) => `SELECT entry_key FROM ${resolveTable(tableInput)} ORDER BY entry_key`;

export const clearStatement = (dialect, tableInput) => `DELETE FROM ${resolveTable(tableInput)}`;
