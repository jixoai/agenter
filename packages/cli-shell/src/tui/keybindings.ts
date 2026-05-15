import type { KeyEvent } from "@opentui/core";

export type CliShellShortcutId =
  | "quit"
  | "toggleManaged"
  | "openDialogue"
  | "closeDialogue"
  | "sendDialogue"
  | "placeLeft"
  | "placeRight"
  | "placeFloating";

export interface CliShellShortcut {
  id: CliShellShortcutId;
  key: string;
  command: boolean;
  ctrl: boolean;
  meta: boolean;
  super: boolean;
  alt: boolean;
  shift: boolean;
}

export interface CliShellTuiKeybindings {
  quit: CliShellShortcut;
  toggleManaged: CliShellShortcut;
  openDialogue: CliShellShortcut;
  closeDialogue: CliShellShortcut;
  sendDialogue: CliShellShortcut;
  placeLeft: CliShellShortcut;
  placeRight: CliShellShortcut;
  placeFloating: CliShellShortcut;
}

const KEY_ALIASES: Record<string, string> = {
  cmd: "command",
  command: "command",
  meta: "meta",
  super: "super",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  shift: "shift",
  enter: "return",
  return: "return",
  esc: "escape",
  escape: "escape",
  space: "space",
  left: "left",
  right: "right",
  up: "up",
  down: "down",
  backspace: "backspace",
  delete: "delete",
  home: "home",
  end: "end",
  pageup: "pageup",
  pagedown: "pagedown",
  tab: "tab",
};

const DISPLAY_KEY_LABELS: Record<string, string> = {
  return: "Enter",
  escape: "Esc",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
  tab: "Tab",
};

const defaultShortcut = (id: CliShellShortcutId, value: string): CliShellShortcut => ({
  id,
  ...parseShortcutValue(value, id),
});

const normalizeKeyName = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new Error("shortcut key cannot be empty");
  }
  return KEY_ALIASES[trimmed] ?? trimmed;
};

const parseShortcutValue = (value: string, id: CliShellShortcutId): Omit<CliShellShortcut, "id"> => {
  const parts = value
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  let key = "";
  let command = false;
  let ctrl = false;
  let meta = false;
  let superModifier = false;
  let alt = false;
  let shift = false;

  for (const part of parts) {
    const normalized = normalizeKeyName(part);
    if (normalized === "ctrl") {
      ctrl = true;
      continue;
    }
    if (normalized === "meta") {
      meta = true;
      continue;
    }
    if (normalized === "super") {
      superModifier = true;
      continue;
    }
    if (normalized === "command") {
      command = true;
      continue;
    }
    if (normalized === "alt") {
      alt = true;
      continue;
    }
    if (normalized === "shift") {
      shift = true;
      continue;
    }
    key = normalized;
  }

  if (key.length === 0) {
    throw new Error(`shortcut ${id} is missing a key`);
  }

  return {
    key,
    command,
    ctrl,
    meta,
    super: superModifier,
    alt,
    shift,
  };
};

const DEFAULT_KEYBINDINGS: CliShellTuiKeybindings = {
  quit: defaultShortcut("quit", "Ctrl+Q"),
  toggleManaged: defaultShortcut("toggleManaged", "Meta+M"),
  openDialogue: defaultShortcut("openDialogue", "Meta+J"),
  closeDialogue: defaultShortcut("closeDialogue", "Escape"),
  sendDialogue: defaultShortcut("sendDialogue", "Enter"),
  placeLeft: defaultShortcut("placeLeft", "Meta+L"),
  placeRight: defaultShortcut("placeRight", "Meta+R"),
  placeFloating: defaultShortcut("placeFloating", "Meta+F"),
};

const readShortcutOverride = (settingsContent: string | null | undefined, id: CliShellShortcutId): string | null => {
  const trimmed = settingsContent?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      cliShell?: {
        shortcuts?: Partial<Record<CliShellShortcutId, unknown>>;
      };
    };
    const value = parsed.cliShell?.shortcuts?.[id];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
};

export const resolveCliShellTuiKeybindings = (
  settingsContent: string | null | undefined,
): CliShellTuiKeybindings => {
  const next: Partial<CliShellTuiKeybindings> = {};
  const entries = Object.entries(DEFAULT_KEYBINDINGS) as Array<[keyof CliShellTuiKeybindings, CliShellShortcut]>;
  for (const [id, shortcut] of entries) {
    const override = readShortcutOverride(settingsContent, id);
    next[id] = override
      ? {
          id,
          ...parseShortcutValue(override, id),
        }
      : shortcut;
  }
  return next as CliShellTuiKeybindings;
};

export const matchCliShellShortcut = (key: KeyEvent, shortcut: CliShellShortcut): boolean => {
  const keyName = key.name.trim().toLowerCase();
  if (keyName !== shortcut.key) {
    return false;
  }
  if (Boolean(key.ctrl) !== shortcut.ctrl) {
    return false;
  }
  if (Boolean(key.shift) !== shortcut.shift) {
    return false;
  }
  if (Boolean(key.option) !== shortcut.alt) {
    return false;
  }
  if (shortcut.command) {
    return Boolean(key.meta || key.super);
  }
  if (shortcut.meta || shortcut.super) {
    return Boolean(key.meta) === shortcut.meta && Boolean(key.super) === shortcut.super;
  }
  return !key.meta && !key.super;
};

export const formatCliShellShortcut = (shortcut: CliShellShortcut): string => {
  const parts: string[] = [];
  if (shortcut.ctrl) {
    parts.push("⌃");
  }
  if (shortcut.alt) {
    parts.push("⌥");
  }
  if (shortcut.shift) {
    parts.push("⇧");
  }
  if (shortcut.command) {
    parts.push("⌘");
  }
  if (shortcut.meta) {
    parts.push("M-");
  }
  if (shortcut.super) {
    parts.push("Super-");
  }
  const label = DISPLAY_KEY_LABELS[shortcut.key] ?? shortcut.key.toUpperCase();
  return `${parts.join("")}${label}`;
};
