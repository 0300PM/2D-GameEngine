export interface SaveStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export class MemoryStore implements SaveStore {
  private entries = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.entries.keys()).sort();
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }
}

const detectLocalStorage = (): Storage | null => {
  try {
    if (typeof localStorage === "undefined") return null;
    localStorage.getItem("__b2d_probe__");
    return localStorage;
  } catch {
    return null;
  }
};

export class LocalStorageStore implements SaveStore {
  static isAvailable(): boolean {
    return detectLocalStorage() !== null;
  }

  constructor(
    private prefix = "b2d:",
    private storage: Storage | null = detectLocalStorage()
  ) {
    if (!this.storage) throw new Error("localStorage is not available in this environment");
  }

  async get(key: string): Promise<string | null> {
    return this.storage!.getItem(this.prefix + key);
  }

  async set(key: string, value: string): Promise<void> {
    this.storage!.setItem(this.prefix + key, value);
  }

  async delete(key: string): Promise<boolean> {
    const full = this.prefix + key;
    const existed = this.storage!.getItem(full) !== null;
    this.storage!.removeItem(full);
    return existed;
  }

  async keys(): Promise<string[]> {
    const storage = this.storage!;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(this.prefix)) keys.push(key.slice(this.prefix.length));
    }
    return keys.sort();
  }

  async clear(): Promise<void> {
    for (const key of await this.keys()) await this.delete(key);
  }
}

export type IndexedDbOptions = {
  database?: string;
  store?: string;
};

export class IndexedDbStore implements SaveStore {
  private database: string;
  private storeName: string;

  constructor(options: IndexedDbOptions = {}) {
    this.database = options.database ?? "browser2d";
    this.storeName = options.store ?? "entries";
    if (!IndexedDbStore.isAvailable()) throw new Error("IndexedDB is not available in this environment");
  }

  static isAvailable(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async get(key: string): Promise<string | null> {
    const record = await this.run<{ value?: string } | undefined>("readonly", (store) => store.get(key));
    return record?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.run("readwrite", (store) => store.put({ key, value }));
  }

  async delete(key: string): Promise<boolean> {
    const existing = await this.get(key);
    await this.run("readwrite", (store) => store.delete(key));
    return existing !== null;
  }

  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
    return (keys ?? []).map(String).sort();
  }

  async clear(): Promise<void> {
    await this.run("readwrite", (store) => store.clear());
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, mode);
      const request = action(transaction.objectStore(this.storeName));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    });
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.database, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) database.createObjectStore(this.storeName, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
  }
}

type FsModule = {
  mkdir(path: string, options: { recursive: boolean }): Promise<unknown>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
  readdir(path: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
};

export class FileSystemStore implements SaveStore {
  constructor(
    private baseDir: string,
    private fsLoader: () => Promise<FsModule> = () => import(/* @vite-ignore */ "node:fs/promises") as Promise<FsModule>
  ) {}

  async get(key: string): Promise<string | null> {
    const fs = await this.fsLoader();
    try {
      return await fs.readFile(this.path(key), "utf8");
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const fs = await this.fsLoader();
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.path(key), value, "utf8");
  }

  async delete(key: string): Promise<boolean> {
    const fs = await this.fsLoader();
    const existed = (await this.get(key)) !== null;
    try {
      await fs.unlink(this.path(key));
    } catch {
      return false;
    }
    return existed;
  }

  async keys(): Promise<string[]> {
    const fs = await this.fsLoader();
    try {
      const entries = await fs.readdir(this.baseDir);
      return entries.filter((entry) => entry.endsWith(".json")).map((entry) => decodeURIComponent(entry.slice(0, -5))).sort();
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    const fs = await this.fsLoader();
    await fs.rm(this.baseDir, { recursive: true, force: true });
  }

  private path(key: string): string {
    return `${this.baseDir.replace(/\/+$/, "")}/${encodeURIComponent(key)}.json`;
  }
}

export type HttpStoreOptions = {
  endpoint: string;
  token?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

export class HttpStore implements SaveStore {
  private endpoint: string;
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;

  constructor(options: HttpStoreOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
    if (options.token) this.headers["Authorization"] = `Bearer ${options.token}`;
    const impl = options.fetchImpl ?? (typeof fetch === "undefined" ? undefined : fetch);
    if (!impl) throw new Error("HttpStore needs a fetch implementation");
    this.fetchImpl = impl;
  }

  async get(key: string): Promise<string | null> {
    const response = await this.fetchImpl(this.url(key), { method: "GET", headers: this.headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HttpStore GET ${key} failed with ${response.status}`);
    const payload = (await response.json()) as { value?: string };
    return payload.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const response = await this.fetchImpl(this.url(key), {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`HttpStore PUT ${key} failed with ${response.status}`);
  }

  async delete(key: string): Promise<boolean> {
    const response = await this.fetchImpl(this.url(key), { method: "DELETE", headers: this.headers });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`HttpStore DELETE ${key} failed with ${response.status}`);
    return true;
  }

  async keys(): Promise<string[]> {
    const response = await this.fetchImpl(this.endpoint + "/v1/entries", { method: "GET", headers: this.headers });
    if (!response.ok) throw new Error(`HttpStore LIST failed with ${response.status}`);
    const payload = (await response.json()) as { keys?: string[] };
    return (payload.keys ?? []).sort();
  }

  async clear(): Promise<void> {
    for (const key of await this.keys()) await this.delete(key);
  }

  async health(): Promise<{ ok: boolean; backend?: string }> {
    const response = await this.fetchImpl(this.endpoint + "/v1/health", { method: "GET", headers: this.headers });
    if (!response.ok) return { ok: false };
    return (await response.json()) as { ok: boolean; backend?: string };
  }

  private url(key: string): string {
    return `${this.endpoint}/v1/entries/${encodeURIComponent(key)}`;
  }
}
