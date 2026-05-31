import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type ShellChatDefaultLayout = "left" | "right" | "float";

export interface ShellSettings {
  chat: {
    defaultLayout: ShellChatDefaultLayout;
  };
  startup: {
    lastShellName: string | null;
    lastAvatarNickname: string | null;
  };
}

export interface ShellKeybindings {
  textarea?: Partial<Record<ShellTextareaBindingAction, readonly string[]>>;
  composer?: Partial<Record<ShellComposerBindingAction, readonly string[]>>;
  panel?: Partial<Record<ShellPanelBindingAction, readonly string[]>>;
}

export type ShellTextareaBindingAction = "submit" | "newline" | "undo" | "redo" | "copy" | "paste";

export type ShellComposerBindingAction = "history" | "avatar";

export type ShellPanelBindingAction = "confirm" | "cancel";

export const SHELL_SETTINGS_DIR = join(homedir(), ".agenter", "shell");
export const SHELL_SETTINGS_PATH = join(SHELL_SETTINGS_DIR, "settings.json");
export const SHELL_KEYBINDINGS_PATH = join(SHELL_SETTINGS_DIR, "keybindings.json");

export interface ShellSettingsStorageOptions {
  baseDir?: string;
  settingsPath?: string;
  keybindingsPath?: string;
}

const DEFAULT_SETTINGS: ShellSettings = {
  chat: {
    defaultLayout: "right",
  },
  startup: {
    lastShellName: null,
    lastAvatarNickname: null,
  },
};

const DEFAULT_KEYBINDINGS: ShellKeybindings = {
  textarea: {
    submit: ["return"],
    newline: ["shift+return", "linefeed"],
    undo: ["ctrl+-", "super+z"],
    redo: ["ctrl+.", "super+shift+z"],
    copy: ["super+c"],
    paste: ["super+v"],
  },
  composer: {
    history: ["/history"],
    avatar: ["/avatar"],
  },
  panel: {
    confirm: ["return"],
    cancel: ["escape"],
  },
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeLayout = (value: unknown): ShellChatDefaultLayout =>
  value === "left" || value === "right" || value === "float" ? value : DEFAULT_SETTINGS.chat.defaultLayout;

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const defaultShellSettings = (): ShellSettings => structuredClone(DEFAULT_SETTINGS);
export const defaultShellKeybindings = (): ShellKeybindings => structuredClone(DEFAULT_KEYBINDINGS);

const resolveStoragePaths = (
  options?: ShellSettingsStorageOptions,
): {
  dir: string;
  settingsPath: string;
  keybindingsPath: string;
} => {
  if (options?.settingsPath || options?.keybindingsPath) {
    const settingsPath = options.settingsPath ?? SHELL_SETTINGS_PATH;
    const keybindingsPath = options.keybindingsPath ?? SHELL_KEYBINDINGS_PATH;
    return {
      dir: options.baseDir ?? join(settingsPath, ".."),
      settingsPath,
      keybindingsPath,
    };
  }
  const dir = options?.baseDir ?? SHELL_SETTINGS_DIR;
  return {
    dir,
    settingsPath: join(dir, "settings.json"),
    keybindingsPath: join(dir, "keybindings.json"),
  };
};

export const parseShellSettings = (raw: string | null | undefined): ShellSettings => {
  if (!raw || raw.trim().length === 0) {
    return defaultShellSettings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultShellSettings();
    }
    const chat = isObject(parsed.chat) ? parsed.chat : {};
    const startup = isObject(parsed.startup) ? parsed.startup : {};
    return {
      chat: {
        defaultLayout: normalizeLayout(chat.defaultLayout),
      },
      startup: {
        lastShellName: normalizeOptionalText(startup.lastShellName),
        lastAvatarNickname: normalizeOptionalText(startup.lastAvatarNickname),
      },
    };
  } catch {
    return defaultShellSettings();
  }
};

const normalizeBindingsRecord = <T extends string>(
  value: unknown,
  allowedKeys: readonly T[],
): Partial<Record<T, readonly string[]>> => {
  if (!isObject(value)) {
    return {};
  }
  const next: Partial<Record<T, readonly string[]>> = {};
  for (const key of allowedKeys) {
    const entry = value[key];
    if (Array.isArray(entry)) {
      const keys = entry.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (keys.length > 0) {
        next[key] = keys;
      }
    }
  }
  return next;
};

export const parseShellKeybindings = (raw: string | null | undefined): ShellKeybindings => {
  if (!raw || raw.trim().length === 0) {
    return defaultShellKeybindings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultShellKeybindings();
    }
    return {
      textarea: {
        ...DEFAULT_KEYBINDINGS.textarea,
        ...normalizeBindingsRecord(parsed.textarea, ["submit", "newline", "undo", "redo", "copy", "paste"]),
      },
      composer: {
        ...DEFAULT_KEYBINDINGS.composer,
        ...normalizeBindingsRecord(parsed.composer, ["history", "avatar"]),
      },
      panel: {
        ...DEFAULT_KEYBINDINGS.panel,
        ...normalizeBindingsRecord(parsed.panel, ["confirm", "cancel"]),
      },
    };
  } catch {
    return defaultShellKeybindings();
  }
};

export const readShellSettings = async (options?: ShellSettingsStorageOptions): Promise<ShellSettings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseShellSettings(await readFile(paths.settingsPath, "utf8"));
  } catch {
    return defaultShellSettings();
  }
};

export const readShellKeybindings = async (options?: ShellSettingsStorageOptions): Promise<ShellKeybindings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseShellKeybindings(await readFile(paths.keybindingsPath, "utf8"));
  } catch {
    return defaultShellKeybindings();
  }
};

export const saveShellSettings = async (
  settings: ShellSettings,
  options?: ShellSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
};

export const saveShellKeybindings = async (
  keybindings: ShellKeybindings,
  options?: ShellSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.keybindingsPath, `${JSON.stringify(keybindings, null, 2)}\n`, "utf8");
};
