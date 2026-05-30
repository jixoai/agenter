import type { KeyBinding, KeyEvent } from "@opentui/core";

import {
  defaultCliShellKeybindings,
  type CliShellComposerBindingAction,
  type CliShellKeybindings,
  type CliShellPanelBindingAction,
  type CliShellTextareaBindingAction,
} from "./settings";

type CliShellTextareaNativeBindingAction = Extract<CliShellTextareaBindingAction, "submit" | "newline" | "undo" | "redo">;

export interface CliShellKeyChord {
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

export const parseCliShellKeyChord = (value: string): CliShellKeyChord | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith("/")) {
    return null;
  }
  const parts = trimmed.split("+").map(normalizeChordToken).filter(Boolean);
  const name = parts.at(-1);
  if (!name) {
    return null;
  }
  const chord: CliShellKeyChord = { name };
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

export const matchCliShellKeyChord = (key: KeyEvent, chord: CliShellKeyChord): boolean =>
  key.name === chord.name &&
  Boolean(key.ctrl) === Boolean(chord.ctrl) &&
  Boolean(key.shift) === Boolean(chord.shift) &&
  Boolean(key.meta) === Boolean(chord.meta) &&
  Boolean(key.super) === Boolean(chord.super);

const resolveTextareaBindingStrings = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellTextareaBindingAction,
): readonly string[] => keybindings?.textarea?.[action] ?? defaultCliShellKeybindings().textarea?.[action] ?? [];

const resolveComposerBindingStrings = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellComposerBindingAction,
): readonly string[] => keybindings?.composer?.[action] ?? defaultCliShellKeybindings().composer?.[action] ?? [];

const resolvePanelBindingStrings = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellPanelBindingAction,
): readonly string[] => keybindings?.panel?.[action] ?? defaultCliShellKeybindings().panel?.[action] ?? [];

const toTextareaActionKeyBindings = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellTextareaNativeBindingAction,
): KeyBinding[] =>
  resolveTextareaBindingStrings(keybindings, action)
    .map(parseCliShellKeyChord)
    .filter((chord): chord is CliShellKeyChord => chord !== null)
    .map((chord) => ({
      name: chord.name,
      ctrl: chord.ctrl,
      shift: chord.shift,
      meta: chord.meta,
      super: chord.super,
      action,
    }));

export const buildCliShellTextareaKeyBindings = (keybindings: CliShellKeybindings | undefined): KeyBinding[] => [
  ...toTextareaActionKeyBindings(keybindings, "submit"),
  ...toTextareaActionKeyBindings(keybindings, "newline"),
  ...toTextareaActionKeyBindings(keybindings, "undo"),
  ...toTextareaActionKeyBindings(keybindings, "redo"),
];

const matchBindings = (key: KeyEvent, values: readonly string[]): boolean =>
  values
    .map(parseCliShellKeyChord)
    .filter((chord): chord is CliShellKeyChord => chord !== null)
    .some((chord) => matchCliShellKeyChord(key, chord));

export const matchesCliShellTextareaBinding = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellTextareaBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolveTextareaBindingStrings(keybindings, action));

export const matchesCliShellPanelBinding = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellPanelBindingAction,
  key: KeyEvent,
): boolean => matchBindings(key, resolvePanelBindingStrings(keybindings, action));

export const matchesCliShellComposerBinding = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellComposerBindingAction,
  key: KeyEvent,
): boolean =>
  matchBindings(
    key,
    resolveComposerBindingStrings(keybindings, action).filter((value) => !value.trim().startsWith("/")),
  );

export const resolveCliShellComposerSlashCommands = (
  keybindings: CliShellKeybindings | undefined,
  action: CliShellComposerBindingAction,
): readonly string[] =>
  resolveComposerBindingStrings(keybindings, action)
    .map((value) => value.trim())
    .filter((value) => value.startsWith("/"));
