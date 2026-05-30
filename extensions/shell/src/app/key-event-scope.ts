import type { KeyEvent } from "@opentui/core";

const HANDLED_KEY_EVENT = Symbol.for("agenter.shell.key-event-handled");

export type ShellKeyScope = "top-layer" | "pane" | "global";

export interface ShellHandledKeyEvent extends KeyEvent {
  [HANDLED_KEY_EVENT]?: ShellKeyScope;
}

export const markShellKeyHandled = (key: KeyEvent, scope: ShellKeyScope): void => {
  const scoped = key as ShellHandledKeyEvent;
  scoped[HANDLED_KEY_EVENT] = scope;
  key.preventDefault();
};

export const isShellKeyHandled = (key: KeyEvent): boolean =>
  key.defaultPrevented || (key as ShellHandledKeyEvent)[HANDLED_KEY_EVENT] !== undefined;
