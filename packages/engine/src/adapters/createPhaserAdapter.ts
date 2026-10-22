import type { EngineConfig } from "../core/EngineConfig";
import type { AdapterDeps } from "../core/ports";
import { PhaserAdapter } from "./PhaserAdapter";

export const createPhaserAdapter = (config: EngineConfig, deps: AdapterDeps): PhaserAdapter => new PhaserAdapter(config, deps);
