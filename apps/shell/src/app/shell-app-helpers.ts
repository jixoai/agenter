import type { KeyEvent } from "@opentui/core";

import type { FocusDirection } from "../renderable-mux/layout";
import type { ShellStatusbarState } from "../renderable-mux/statusbar";
import { isShellKeyHandled } from "./key-event-scope";

export const readShellKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

export const shouldShellSkipKey = (key: KeyEvent): boolean => isShellKeyHandled(key);

export const focusDirectionFromShiftArrow = (key: KeyEvent): FocusDirection | null => {
  if (!key.shift) {
    return null;
  }
  if (key.name === "left" || key.name === "right" || key.name === "up" || key.name === "down") {
    return key.name;
  }
  return null;
};

export const defaultShellStatusbarState: ShellStatusbarState = {
  runtime: { label: "Idle" },
  attention: { focused: 0, background: 0, muted: 0 },
  actions: ["Help", "Chat"],
};
