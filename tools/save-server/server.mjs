import http from "node:http";
import path from "node:path";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import {
  clearStatement,
  deleteStatement,
  keysStatement,
  schemaStatements,
  selectStatement,
  upsertStatement
} from "./sql.mjs";

const KEY_PATTERN = /^[A-Za-z0-9:._~-]{1,191}$/;

const createFileBackend = (directory) => {
  const fileFor = (key) => path.join(directory, `${encodeURIComponent(key)}.json`);
  const ensure = async () => {
    await mkdir(directory, { recursive: true });
  };
  return {
    kind: "file",
    async get(key) {
      try {
        const payload = JSON.parse(await readFile(fileFor(key), "utf8"));
        return typeof payload.value === "string" ? payload.value : null;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await ensure();
      await writeFile(fileFor(key), JSON.stringify({ key, value }), "utf8");
    },
    async delete(key) {
      try {
        await unlink(fileFor(key));
        return true;
      } catch {
        return false;
      }
    },
    async keys() {
      await ensure();
      const entries = await readdir(directory);
      return entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => decodeURIComponent(entry.slice(0, -5)))
        .sort();
    },
    async clear() {
      for (const key of await this.keys()) await this.delete(key);
    }
  };
};

const createSqlBackend = async (dialect, table, connection) => {
  let client;
  let close;
  if (dialect === "postgres") {
    const { Client } = await import("pg");
    client = new Client(connection);
    await client.connect();
    close = () => client.end();
  } else {
    const mysql = await import("mysql2/promise");
    client = mysql.createPool({ ...connection, namedPlaceholders: false });
    close = () => client.end();
  }
  const run = async (sql, params = []) => {
    const result = await client.query(sql, params);
    return dialect === "postgres" ? result : result[0];
  };
  for (const statement of schemaStatements(dialect, table)) await run(statement);
  return {
    kind: dialect,
    close,
    async get(key) {
      const result = await run(selectStatement(dialect, table), [key]);
      const rows = dialect === "postgres" ? result.rows : result;
      return rows?.[0]?.value ?? null;
    },
    async set(key, value) {
      await run(upsertStatement(dialect, table), [key, value]);
    },
    async delete(key) {
      const result = await run(deleteStatement(dialect, table), [key]);
      const affected = dialect === "postgres" ? result.rowCount : result.affectedRows;
      return (affected ?? 1) > 0;
    },
    async keys() {
      const result = await run(keysStatement(dialect, table));
      const rows = dialect === "postgres" ? result.rows : result;
      return (rows ?? []).map((row) => String(row.entry_key)).sort();
    },
    async clear() {
      await run(clearStatement(dialect, table));
    }
  };
};

const json = (response, status, payload) => {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
};

const readBody = async (request, limit) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

export const createServer = async (options = {}) => {
  const backendName = options.backend ?? process.env.SAVE_BACKEND ?? "file";
  const dialect = options.dialect ?? process.env.SAVE_DIALECT ?? "postgres";
  const table = options.table ?? process.env.SAVE_TABLE ?? "b2d_entries";
  const directory = options.directory ?? process.env.SAVE_DIR ?? path.join(process.cwd(), "tools/save-server/data");
  const token = options.token ?? process.env.SAVE_TOKEN ?? "";
  const origin = options.origin ?? process.env.SAVE_ORIGIN ?? "*";
  const maxBody = Number(options.maxBody ?? process.env.SAVE_MAX_BODY ?? 512 * 1024);

  const backend =
    backendName === "file"
      ? createFileBackend(directory)
      : await createSqlBackend(dialect, table, options.connection ?? {});

  const handler = async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (token) {
      const header = request.headers.authorization ?? "";
      if (header !== `Bearer ${token}`) {
        json(response, 401, { error: "unauthorized" });
        return;
      }
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] !== "v1") {
      json(response, 404, { error: "not found" });
      return;
    }
    if (parts[1] === "health" && request.method === "GET") {
      json(response, 200, { ok: true, backend: backend.kind });
      return;
    }
    if (parts[1] !== "entries") {
      json(response, 404, { error: "not found" });
      return;
    }

    if (parts.length === 2 && request.method === "GET") {
      json(response, 200, { keys: await backend.keys() });
      return;
    }
    if (parts.length !== 3) {
      json(response, 404, { error: "not found" });
      return;
    }

    const key = decodeURIComponent(parts[2]);
    if (!KEY_PATTERN.test(key)) {
      json(response, 400, { error: "invalid key" });
      return;
    }

    try {
      if (request.method === "GET") {
        const value = await backend.get(key);
        if (value === null) json(response, 404, { error: "not found" });
        else json(response, 200, { key, value });
        return;
      }
      if (request.method === "PUT") {
        const body = await readBody(request, maxBody);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          json(response, 400, { error: "body must be JSON" });
          return;
        }
        if (typeof parsed.value !== "string") {
          json(response, 400, { error: "body needs a string value" });
          return;
        }
        await backend.set(key, parsed.value);
        json(response, 200, { key, bytes: parsed.value.length });
        return;
      }
      if (request.method === "DELETE") {
        const removed = await backend.delete(key);
        json(response, removed ? 200 : 404, { key, removed });
        return;
      }
      json(response, 405, { error: "method not allowed" });
    } catch (cause) {
      json(response, 500, { error: String(cause?.message ?? cause) });
    }
  };

  const server = http.createServer((request, response) => {
    handler(request, response).catch((cause) => json(response, 500, { error: String(cause?.message ?? cause) }));
  });

  return { server, backend, close: async () => backend.close?.() };
};

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMain) {
  const argument = process.argv.find((entry) => entry.startsWith("--print-schema"));
  if (argument) {
    const dialect = argument.includes("=") ? argument.split("=")[1] : process.env.SAVE_DIALECT ?? "postgres";
    process.stdout.write(schemaStatements(dialect, process.env.SAVE_TABLE ?? "b2d_entries").join(";\n") + ";\n");
    process.exit(0);
  }
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "0.0.0.0";
  const { server, backend } = await createServer();
  server.listen(port, host, () => {
    process.stdout.write(`save-server listening on http://${host}:${port} (backend: ${backend.kind})\n`);
  });
}
