export type WasmModuleState = "idle" | "loading" | "ready" | "failed";

export type WasmBridgeOptions = {
  wasmUrl?: string;
  required: boolean;
};

export class WasmBridge {
  private state: WasmModuleState = "idle";
  private instance: WebAssembly.Instance | null = null;
  private error: Error | null = null;
  private url: string | undefined;
  private required: boolean;

  constructor(options: WasmBridgeOptions = { required: false }) {
    this.url = options.wasmUrl;
    this.required = options.required;
  }

  getState(): WasmModuleState {
    return this.state;
  }

  getError(): Error | null {
    return this.error;
  }

  isReady(): boolean {
    return this.state === "ready";
  }

  async load(): Promise<void> {
    if (!this.url) {
      this.state = "idle";
      return;
    }
    this.state = "loading";
    try {
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`Failed to fetch WASM at ${this.url}: ${response.statusText}`);
      const bytes = await response.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, {
        env: { memory: new WebAssembly.Memory({ initial: 256 }) }
      });
      this.instance = result.instance;
      this.state = "ready";
    } catch (e) {
      this.error = e as Error;
      this.state = "failed";
      if (this.required) throw e;
    }
  }

  getInstance(): WebAssembly.Instance | null {
    return this.instance;
  }

  call<T>(name: string, ...args: unknown[]): T | null {
    if (!this.instance) return null;
    const fn = (this.instance.exports as Record<string, unknown>)[name];
    if (typeof fn !== "function") return null;
    return (fn as (...a: unknown[]) => T)(...args);
  }

  reset(): void {
    this.state = "idle";
    this.instance = null;
    this.error = null;
  }
}
