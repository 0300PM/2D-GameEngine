import { Engine, type EngineOptions } from "./core/Engine";
import { createPhaserAdapter } from "./adapters/createPhaserAdapter";

export const createEngine = (options: EngineOptions): Engine => new Engine(options, createPhaserAdapter);
