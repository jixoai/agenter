import type { KeyEvent } from "@opentui/core";

const HANDLED_KEY_EVENT = Symbol.for("agenter.shell-next.key-event-handled");

export type ShellNextKeyScope = "top-layer" | "pane" | "global";

export interface ShellNextHandledKeyEvent extends KeyEvent {
  [HANDLED_KEY_EVENT]?: ShellNextKeyScope;
}

export const markShellNextKeyHandled = (key: KeyEvent, scope: ShellNextKeyScope): void => {
  const scoped = key as ShellNextHandledKeyEvent;
  scoped[HANDLED_KEY_EVENT] = scope;
  key.preventDefault();
};

export const isShellNextKeyHandled = (key: KeyEvent): boolean =>
  key.defaultPrevented || (key as ShellNextHandledKeyEvent)[HANDLED_KEY_EVENT] !== undefined;
