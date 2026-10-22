export type EasingName =
  | "linear"
  | "quadIn"
  | "quadOut"
  | "quadInOut"
  | "cubicIn"
  | "cubicOut"
  | "cubicInOut"
  | "quartIn"
  | "quartOut"
  | "quartInOut"
  | "sineIn"
  | "sineOut"
  | "sineInOut"
  | "expoIn"
  | "expoOut"
  | "expoInOut"
  | "circIn"
  | "circOut"
  | "circInOut"
  | "backIn"
  | "backOut"
  | "backInOut"
  | "elasticIn"
  | "elasticOut"
  | "elasticInOut"
  | "bounceIn"
  | "bounceOut"
  | "bounceInOut";

export type EasingFunction = (t: number) => number;

export type Easing = EasingName | EasingFunction;

const backOut = (t: number): number => {
  const c = 1.70158;
  const shifted = t - 1;
  return 1 + (c + 1) * shifted * shifted * shifted + c * shifted * shifted;
};

const bounceOut = (t: number): number => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) {
    const shifted = t - 1.5 / 2.75;
    return 7.5625 * shifted * shifted + 0.75;
  }
  if (t < 2.5 / 2.75) {
    const shifted = t - 2.25 / 2.75;
    return 7.5625 * shifted * shifted + 0.9375;
  }
  const shifted = t - 2.625 / 2.75;
  return 7.5625 * shifted * shifted + 0.984375;
};

export const EASINGS: Record<EasingName, EasingFunction> = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => t * (2 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  quartIn: (t) => t ** 4,
  quartOut: (t) => 1 - (1 - t) ** 4,
  quartInOut: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  sineIn: (t) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  expoIn: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  expoOut: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  expoInOut: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },
  circIn: (t) => 1 - Math.sqrt(1 - t * t),
  circOut: (t) => Math.sqrt(1 - (t - 1) ** 2),
  circInOut: (t) =>
    t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
  backIn: (t) => {
    const c = 1.70158;
    return (c + 1) * t * t * t - c * t * t;
  },
  backOut,
  backInOut: (t) => {
    const c = 1.70158 * 1.525;
    if (t < 0.5) return ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2;
    const shifted = 2 * t - 2;
    return (shifted * shifted * ((c + 1) * shifted + c) + 2) / 2;
  },
  elasticIn: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c = (2 * Math.PI) / 3;
    return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * c);
  },
  elasticOut: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
  elasticInOut: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
      : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
  },
  bounceIn: (t) => 1 - bounceOut(1 - t),
  bounceOut,
  bounceInOut: (t) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2)
};

export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

export const resolveEasing = (easing?: Easing): EasingFunction => {
  if (easing === undefined) return EASINGS.linear;
  if (typeof easing === "function") return easing;
  const resolved = EASINGS[easing];
  if (!resolved) throw new Error(`Unknown easing "${String(easing)}". Known: ${EASING_NAMES.join(", ")}`);
  return resolved;
};
