export type ScaleMode = "fit" | "fill" | "fixed" | "expand";

export type PhysicsConfig = {
  enabled: boolean;
  gravity: { x: number; y: number };
  debug: boolean;
};

export type InputActionMap = Record<string, string[]>;

export type FixedStepConfig = {
  hz: number;
  maxSteps?: number;
};

export type EngineConfig = {
  parent: string | HTMLElement;
  width: number;
  height: number;
  backgroundColor: string;
  scaleMode: ScaleMode;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  debug: boolean;
  pauseOnHidden: boolean;
  maxDeltaTime: number;
  physics: PhysicsConfig;
  inputMap: InputActionMap;
  seed?: number;
  fixedStep?: FixedStepConfig;
};

export const defaultInputMap: InputActionMap = {
  "move-up": ["ArrowUp", "KeyW"],
  "move-down": ["ArrowDown", "KeyS"],
  "move-left": ["ArrowLeft", "KeyA"],
  "move-right": ["ArrowRight", "KeyD"],
  "interact": ["Space", "KeyE"],
  "jump": ["Space"],
  "restart": ["KeyR"],
  "menu": ["KeyM", "Escape"],
  "pause": ["KeyP"],
  "time-slow": ["BracketLeft"],
  "time-fast": ["BracketRight"],
  "time-normal": ["Backslash"],
  "mute": ["KeyN"]
};

export const defaultEngineConfig: Omit<EngineConfig, "parent"> = {
  width: 1280,
  height: 720,
  backgroundColor: "#151515",
  scaleMode: "fit",
  debug: false,
  pauseOnHidden: true,
  maxDeltaTime: 0.1,
  seed: 1337,
  physics: {
    enabled: true,
    gravity: { x: 0, y: 0 },
    debug: false
  },
  inputMap: defaultInputMap
};

export function validateEngineConfig(config: Partial<EngineConfig>): string[] {
  const errors: string[] = [];
  if (config.width !== undefined && (typeof config.width !== "number" || config.width <= 0 || config.width > 8192)) {
    errors.push("width must be a positive number between 1 and 8192");
  }
  if (config.height !== undefined && (typeof config.height !== "number" || config.height <= 0 || config.height > 8192)) {
    errors.push("height must be a positive number between 1 and 8192");
  }
  if (config.backgroundColor !== undefined && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(config.backgroundColor)) {
    errors.push("backgroundColor must be a valid hex color like #151515");
  }
  if (config.scaleMode !== undefined && !["fit", "fill", "fixed", "expand"].includes(config.scaleMode)) {
    errors.push("scaleMode must be one of fit, fill, fixed, expand");
  }
  if (config.maxDeltaTime !== undefined && (typeof config.maxDeltaTime !== "number" || config.maxDeltaTime <= 0)) {
    errors.push("maxDeltaTime must be a positive number");
  }
  if (config.seed !== undefined && (!Number.isInteger(config.seed) || config.seed < 0)) {
    errors.push("seed must be a non-negative integer");
  }
  if (config.fixedStep !== undefined) {
    if (typeof config.fixedStep.hz !== "number" || config.fixedStep.hz <= 0 || config.fixedStep.hz > 480) {
      errors.push("fixedStep.hz must be a number between 1 and 480");
    }
    if (config.fixedStep.maxSteps !== undefined && (!Number.isInteger(config.fixedStep.maxSteps) || config.fixedStep.maxSteps < 1)) {
      errors.push("fixedStep.maxSteps must be a positive integer");
    }
  }
  if (config.parent === undefined || config.parent === null || (typeof config.parent === "string" && config.parent.trim() === "")) {
    errors.push("parent is required and must be a non-empty element id or HTMLElement");
  }
  return errors;
}

export function resolveEngineConfig(input: Partial<EngineConfig> & { parent: string | HTMLElement }): EngineConfig {
  const errors = validateEngineConfig(input);
  if (errors.length > 0) {
    throw new Error(`Invalid EngineConfig: ${errors.join("; ")}`);
  }
  return {
    ...defaultEngineConfig,
    ...input,
    physics: { ...defaultEngineConfig.physics, ...(input.physics ?? {}) },
    inputMap: { ...defaultEngineConfig.inputMap, ...(input.inputMap ?? {}) }
  };
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
