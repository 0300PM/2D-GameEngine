import { describe, expect, it } from "vitest";
import { installTestCore } from "../helpers/native";
import { NativeCore, nativeCore } from "../../packages/engine/src/wasm/NativeCore";

const fakeInstance = (exports: Record<string, unknown>): WebAssembly.Instance =>
  ({ exports: { memory: new WebAssembly.Memory({ initial: 1 }), ...exports } }) as unknown as WebAssembly.Instance;

describe("NativeCore", () => {
  it("stays detached until a compatible module is attached", () => {
    const core = new NativeCore();
    expect(core.isReady()).toBe(false);
    expect(core.impl).toBe("typescript");
    expect(core.stats()).toEqual({ impl: "typescript", abi: 0, reason: null });
  });

  it("rejects modules without the ABI export", () => {
    const core = new NativeCore();
    expect(core.attach(fakeInstance({}))).toBe(false);
    expect(core.stats().reason).toBe("missing-abi");
  });

  it("rejects an unsupported ABI version", () => {
    const core = new NativeCore();
    expect(core.attach(fakeInstance({ b2d_abi_version: () => 99 }))).toBe(false);
    expect(core.stats().reason).toBe("unsupported-abi:99");
  });

  it("rejects modules without exported memory", () => {
    const core = new NativeCore();
    const instance = { exports: { b2d_abi_version: () => 1 } } as unknown as WebAssembly.Instance;
    expect(core.attach(instance)).toBe(false);
    expect(core.stats().reason).toBe("missing-memory");
  });

  it("attaches a compatible module and exposes the ABI", () => {
    const core = new NativeCore();
    expect(core.attach(fakeInstance({ b2d_abi_version: () => 1 }))).toBe(true);
    expect(core.isReady()).toBe(true);
    expect(core.impl).toBe("cpp");
    expect(core.abi).toBe(1);
    expect(core.stats()).toEqual({ impl: "cpp", abi: 1, reason: null });
    core.detach();
    expect(core.isReady()).toBe(false);
  });

  it("falls back to the provided default when an export is missing", () => {
    const core = new NativeCore();
    core.attach(fakeInstance({ b2d_abi_version: () => 1 }));
    expect(core.number("b2d_missing", 7, 1, 2)).toBe(7);
    expect(core.read(0, 4)).toEqual([]);
    expect(core.write([1, 2, 3])).toBe(0);
  });

  it("shares one instance across the engine", () => {
    installTestCore();
    expect(nativeCore.isReady()).toBe(true);
    expect(nativeCore.abi).toBe(1);
  });
});
