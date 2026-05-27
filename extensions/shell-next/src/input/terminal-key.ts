import type { KeyEvent } from "@opentui/core";

const CTRL_A_CODE = "a".charCodeAt(0);

const arrowMap: Record<string, string> = {
  up: "\u001b[A",
  down: "\u001b[B",
  right: "\u001b[C",
  left: "\u001b[D",
  home: "\x01",
  end: "\x05",
  delete: "\u001b[3~",
  pageup: "\u001b[5~",
  pagedown: "\u001b[6~",
};

const nativeSequence = (key: KeyEvent): string | null => {
  if (key.sequence.length > 0) {
    return key.sequence;
  }
  if (key.raw.length > 0) {
    return key.raw;
  }
  return null;
};

export interface ShellNextTerminalKeyEncodingOptions {
  homeEndFallback?: boolean;
}

export const encodeShellNextTerminalKey = (
  key: KeyEvent,
  options: ShellNextTerminalKeyEncodingOptions = {},
): string | null => {
  if (key.name === "return") {
    return "\r";
  }
  if (key.name === "linefeed") {
    return "\n";
  }
  if (key.name === "backspace") {
    return "\u007f";
  }
  if (key.name === "tab") {
    return "\t";
  }
  if (key.name === "space") {
    return " ";
  }
  if (key.name === "escape") {
    return "\u001b";
  }
  if ((key.name === "home" || key.name === "end") && nativeSequence(key)) {
    return nativeSequence(key);
  }
  if (arrowMap[key.name]) {
    if ((key.name === "home" || key.name === "end") && options.homeEndFallback === false) {
      return null;
    }
    return arrowMap[key.name];
  }
  if (key.ctrl && key.name.length === 1 && /^[a-z]$/i.test(key.name)) {
    const code = key.name.toLowerCase().charCodeAt(0) - CTRL_A_CODE + 1;
    return String.fromCharCode(code);
  }
  if (key.sequence && key.sequence.length > 0 && !key.meta) {
    return key.sequence;
  }
  if (key.raw && key.raw.length > 0 && !key.meta) {
    return key.raw;
  }
  return null;
};
