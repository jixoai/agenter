import type { KeyBinding, KeyEvent } from "@opentui/core";

import {
  defaultShellNextKeybindings,
  type ShellNextComposerBindingAction,
  type ShellNextKeybindings,
  type ShellNextPanelBindingAction,
  type ShellNextTextareaBindingAction,
} from "./settings";

type ShellNextTextareaNativeBindingAction = Extract<ShellNextTextareaBindingAction, "submit" | "newline" | "undo" | "redo">;

export interface ShellNextKeyChord {
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

export const parseShellNextKeyChord = (value: string): ShellNextKeyChord | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith("/")) {
    return null;
  }
  const parts = trimmed.split("+").map(normalizeChordToken).filter(Boolean);
  const name = parts.at(-1);
  if (!name) {
    return null;
  }
  const chord: ShellNextKeyChord = { name };
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

export const matchShellNextKeyChord = (key: KeyEvent, chord: ShellNextKeyChord): boolean =>
  key.name === chord.name &&
  Boolean(key.ctrl) === Boolean(chord.ctrl) &&
  Boolean(key.shift) === Boolean(chord.shift) &&
  Boolean(key.meta) === Boolean(chord.meta) &&
  Boolean(key.super) === Boolean(chord.super);

const resolveTextareaBindingStrings = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextTextareaBindingAction,
): readonly string[] => keybindings?.textarea?.[action] ?? defaultShellNextKeybindings().textarea?.[action] ?? [];

const resolveComposerBindingStrings = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextComposerBindingAction,
): readonly string[] => keybindings?.composer?.[action] ?? defaultShellNextKeybindings().composer?.[action] ?? [];

const resolvePanelBindingStrings = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextPanelBindingAction,
): readonly string[] => keybindings?.panel?.[action] ?? defaultShellNextKeybindings().panel?.[action] ?? [];

const toTextareaActionKeyBindings = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextTextareaNativeBindingAction,
): KeyBinding[] =>
  resolveTextareaBindingStrings(keybindings, action)
    .map(parseShellNextKeyChord)
    .filter((chord): chord is ShellNextKeyChord => chord !== null)
    .map((chord) => ({
      name: chord.name,
      ctrl: chord.ctrl,
      shift: chord.shift,
      meta: chord.meta,
      super: chord.super,
      action,
    }));

export const buildShellNextTextareaKeyBindings = (keybindings: ShellNextKeybindings | undefined): KeyBinding[] => [
  ...toTextareaActionKeyBindings(keybindings, "submit"),
  ...toTextareaActionKeyBindings(keybindings, "newline"),
  ...toTextareaActionKeyBindings(keybindings, "undo"),
  ...toTextareaActionKeyBindings(keybindings, "redo"),
];

const matchBindings = (key: KeyEvent, values: readonly string[]): boolean =>
  values
    .map(parseShellNextKeyChord)
    .filter((chord): chord is ShellNextKeyChord => chord !== null)
    .some((chord) => matchShellNextKeyChord(key, chord));

export const matchesShellNextTextareaBinding = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextTextareaBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolveTextareaBindingStrings(keybindings, action));

export const matchesShellNextPanelBinding = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextPanelBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolvePanelBindingStrings(keybindings, action));

export const matchesShellNextComposerBinding = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextComposerBindingAction,
  key: KeyEvent,
): boolean =>
  matchBindings(
    key,
    resolveComposerBindingStrings(keybindings, action).filter((value) => !value.trim().startsWith("/")),
  );

export const resolveShellNextComposerSlashCommands = (
  keybindings: ShellNextKeybindings | undefined,
  action: ShellNextComposerBindingAction,
): readonly string[] =>
  resolveComposerBindingStrings(keybindings, action)
    .map((value) => value.trim())
    .filter((value) => value.startsWith("/"));
