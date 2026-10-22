export declare const MIME: Record<string, string>;

export type HostingOptions = {
  root?: string;
  mount?: string;
  host?: string;
  port?: number;
  csp?: "none" | "strict" | "report-only";
  cache?: "none" | "immutable" | "aggressive";
  fallback?: "index" | "404";
  https?: { key: Buffer | string; cert: Buffer | string };
};

export type HostingServer = {
  server: unknown;
  url: string;
  origin: string;
  mount: string;
  close: () => Promise<void>;
};

export declare const inlineScriptHashes: (root: string) => string[];
export declare const strictCsp: (hashes: string[]) => string;
export declare const createHostingServer: (options?: HostingOptions) => Promise<HostingServer>;
