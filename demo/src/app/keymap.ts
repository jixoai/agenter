import type { KeyEvent } from "@opentui/core";

export type FocusPanel = "terminal" | "chat" | "debug";

const ORDER: FocusPanel[] = ["terminal", "chat", "debug"];

export const nextPanel = (current: FocusPanel): FocusPanel => {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length] ?? "chat";
};

export interface KeyActions {
  submit: () => void;
  clearTerminal: () => void;
  exitApp: () => void;
  toggleRenderSource: () => void;
  focusNext: () => void;
  scrollDebug: (delta: number) => void;
  copySelection: () => void;
}

export const handleGlobalKey = (key: KeyEvent, focus: FocusPanel, actions: KeyActions): boolean => {
  if ((key.ctrl && key.shift && key.name === "c") || (key.meta && key.name === "c")) {
    actions.copySelection();
    return true;
  }
  if (key.ctrl && key.name === "c") {
    actions.exitApp();
    return true;
  }
  if (key.ctrl && key.name === "l") {
    actions.clearTerminal();
    return true;
  }
  if (key.ctrl && key.name === "t") {
    actions.toggleRenderSource();
    return true;
  }
  if (key.name === "tab" && !key.shift) {
    actions.focusNext();
    return true;
  }
  if (focus === "debug" && key.name === "up") {
    actions.scrollDebug(1);
    return true;
  }
  if (focus === "debug" && key.name === "down") {
    actions.scrollDebug(-1);
    return true;
  }
  return false;
};
