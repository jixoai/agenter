import type { KeyBinding, KeyEvent } from "@opentui/core";

import {
  defaultShellKeybindings,
  type ShellComposerBindingAction,
  type ShellKeybindings,
  type ShellPanelBindingAction,
  type ShellTextareaBindingAction,
} from "./settings";

type ShellTextareaNativeBindingAction = Extract<ShellTextareaBindingAction, "submit" | "newline" | "undo" | "redo">;

export interface ShellKeyChord {
  name: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  super?: boolean;
}

const normalizeChordToken = (value: string): string => {
  const token = value.trim().toLowerCase();
  if (token === "enter") {
    return "return";
  }
  if (token === "esc") {
    return "escape";
  }
  if (token === "cmd" || token === "command") {
    return "super";
  }
  if (token === "alt") {
    return "meta";
  }
  return token;
};

export const parseShellKeyChord = (value: string): ShellKeyChord | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith("/")) {
    return null;
  }
  const parts = trimmed.split("+").map(normalizeChordToken).filter(Boolean);
  const name = parts.at(-1);
  if (!name) {
    return null;
  }
  const chord: ShellKeyChord = { name };
  for (const token of parts.slice(0, -1)) {
    if (token === "ctrl") {
      chord.ctrl = true;
    } else if (token === "shift") {
      chord.shift = true;
    } else if (token === "meta") {
      chord.meta = true;
    } else if (token === "super") {
      chord.super = true;
    }
  }
  return chord;
};

export const matchShellKeyChord = (key: KeyEvent, chord: ShellKeyChord): boolean =>
  key.name === chord.name &&
  Boolean(key.ctrl) === Boolean(chord.ctrl) &&
  Boolean(key.shift) === Boolean(chord.shift) &&
  Boolean(key.meta) === Boolean(chord.meta) &&
  Boolean(key.super) === Boolean(chord.super);

const resolveTextareaBindingStrings = (
  keybindings: ShellKeybindings | undefined,
  action: ShellTextareaBindingAction,
): readonly string[] => keybindings?.textarea?.[action] ?? defaultShellKeybindings().textarea?.[action] ?? [];

const resolveComposerBindingStrings = (
  keybindings: ShellKeybindings | undefined,
  action: ShellComposerBindingAction,
): readonly string[] => keybindings?.composer?.[action] ?? defaultShellKeybindings().composer?.[action] ?? [];

const resolvePanelBindingStrings = (
  keybindings: ShellKeybindings | undefined,
  action: ShellPanelBindingAction,
): readonly string[] => keybindings?.panel?.[action] ?? defaultShellKeybindings().panel?.[action] ?? [];

const toTextareaActionKeyBindings = (
  keybindings: ShellKeybindings | undefined,
  action: ShellTextareaNativeBindingAction,
): KeyBinding[] =>
  resolveTextareaBindingStrings(keybindings, action)
    .map(parseShellKeyChord)
    .filter((chord): chord is ShellKeyChord => chord !== null)
    .map((chord) => ({
      name: chord.name,
      ctrl: chord.ctrl,
      shift: chord.shift,
      meta: chord.meta,
      super: chord.super,
      action,
    }));

export const buildShellTextareaKeyBindings = (keybindings: ShellKeybindings | undefined): KeyBinding[] => [
  ...toTextareaActionKeyBindings(keybindings, "submit"),
  ...toTextareaActionKeyBindings(keybindings, "newline"),
  ...toTextareaActionKeyBindings(keybindings, "undo"),
  ...toTextareaActionKeyBindings(keybindings, "redo"),
];

const matchBindings = (key: KeyEvent, values: readonly string[]): boolean =>
  values
    .map(parseShellKeyChord)
    .filter((chord): chord is ShellKeyChord => chord !== null)
    .some((chord) => matchShellKeyChord(key, chord));

export const matchesShellTextareaBinding = (
  keybindings: ShellKeybindings | undefined,
  action: ShellTextareaBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolveTextareaBindingStrings(keybindings, action));

export const matchesShellPanelBinding = (
  keybindings: ShellKeybindings | undefined,
  action: ShellPanelBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolvePanelBindingStrings(keybindings, action));

export const matchesShellComposerBinding = (
  keybindings: ShellKeybindings | undefined,
  action: ShellComposerBindingAction,
  key: KeyEvent,
): boolean =>
  matchBindings(
    key,
    resolveComposerBindingStrings(keybindings, action).filter((value) => !value.trim().startsWith("/")),
  );

export const resolveShellComposerSlashCommands = (
  keybindings: ShellKeybindings | undefined,
  action: ShellComposerBindingAction,
): readonly string[] =>
  resolveComposerBindingStrings(keybindings, action)
    .map((value) => value.trim())
    .filter((value) => value.startsWith("/"));
