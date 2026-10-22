const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGIT_NAMES = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];

const NAMED_CODES: Record<string, number> = {
  BACKSPACE: 8,
  TAB: 9,
  ENTER: 13,
  SHIFT: 16,
  CTRL: 17,
  ALT: 18,
  CAPS_LOCK: 20,
  ESC: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  INSERT: 45,
  DELETE: 46,
  META: 91,
  MINUS: 189,
  PLUS: 187,
  OPEN_BRACKET: 219,
  CLOSED_BRACKET: 221,
  BACK_SLASH: 220,
  SEMICOLON: 186,
  QUOTES: 222,
  COMMA: 188,
  PERIOD: 190,
  FORWARD_SLASH: 191,
  BACKTICK: 192
};

const CODE_ALIASES: Record<string, string> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  Space: "SPACE",
  Escape: "ESC",
  Enter: "ENTER",
  NumpadEnter: "ENTER",
  Tab: "TAB",
  Backspace: "BACKSPACE",
  Delete: "DELETE",
  Insert: "INSERT",
  Home: "HOME",
  End: "END",
  PageUp: "PAGE_UP",
  PageDown: "PAGE_DOWN",
  ShiftLeft: "SHIFT",
  ShiftRight: "SHIFT",
  ControlLeft: "CTRL",
  ControlRight: "CTRL",
  AltLeft: "ALT",
  AltRight: "ALT",
  MetaLeft: "META",
  MetaRight: "META",
  CapsLock: "CAPS_LOCK",
  Comma: "COMMA",
  Period: "PERIOD",
  Slash: "FORWARD_SLASH",
  Semicolon: "SEMICOLON",
  Quote: "QUOTES",
  BracketLeft: "OPEN_BRACKET",
  BracketRight: "CLOSED_BRACKET",
  Backslash: "BACK_SLASH",
  Minus: "MINUS",
  Equal: "PLUS",
  Backquote: "BACKTICK"
};

const byName = (name: string): number | null => {
  const named = NAMED_CODES[name];
  if (named !== undefined) return named;
  if (name.length === 1 && LETTERS.includes(name)) return name.charCodeAt(0);
  const digitIndex = DIGIT_NAMES.indexOf(name);
  if (digitIndex >= 0) return 48 + digitIndex;
  const numpad = name.startsWith("NUMPAD_") ? DIGIT_NAMES.indexOf(name.slice(7)) : -1;
  if (numpad >= 0) return 96 + numpad;
  const fn = /^F([1-9]|1[0-2])$/.exec(name);
  if (fn) return 111 + Number(fn[1]);
  return null;
};

export const resolveKeyCode = (code: string): number | null => {
  const alias = CODE_ALIASES[code];
  if (alias) return byName(alias);
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return 48 + Number(code.slice(5));
  if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code.slice(6));
  if (/^F([1-9]|1[0-2])$/.test(code)) return byName(code);
  if (code.length === 1) return code.toUpperCase().charCodeAt(0);
  return null;
};
