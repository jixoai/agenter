import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type ShellNextChatDefaultLayout = "left" | "right" | "float";

export interface ShellNextSettings {
  chat: {
    defaultLayout: ShellNextChatDefaultLayout;
  };
  startup: {
    lastShellName: string | null;
    lastAvatarNickname: string | null;
  };
}

export interface ShellNextKeybindings {
  textarea?: Partial<Record<ShellNextTextareaBindingAction, readonly string[]>>;
  composer?: Partial<Record<ShellNextComposerBindingAction, readonly string[]>>;
  panel?: Partial<Record<ShellNextPanelBindingAction, readonly string[]>>;
}

export type ShellNextTextareaBindingAction =
  | "submit"
  | "newline"
  | "undo"
  | "redo"
  | "copy"
  | "paste";

export type ShellNextComposerBindingAction = "history";

export type ShellNextPanelBindingAction = "confirm" | "cancel";

export const SHELL_NEXT_SETTINGS_DIR = join(homedir(), ".agenter", "shell-next");
export const SHELL_NEXT_SETTINGS_PATH = join(SHELL_NEXT_SETTINGS_DIR, "settings.json");
export const SHELL_NEXT_KEYBINDINGS_PATH = join(SHELL_NEXT_SETTINGS_DIR, "keybindings.json");

export interface ShellNextSettingsStorageOptions {
  baseDir?: string;
  settingsPath?: string;
  keybindingsPath?: string;
}

const DEFAULT_SETTINGS: ShellNextSettings = {
  chat: {
    defaultLayout: "right",
  },
  startup: {
    lastShellName: null,
    lastAvatarNickname: null,
  },
};

const DEFAULT_KEYBINDINGS: ShellNextKeybindings = {
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
  },
  panel: {
    confirm: ["return"],
    cancel: ["escape"],
  },
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeLayout = (value: unknown): ShellNextChatDefaultLayout =>
  value === "left" || value === "right" || value === "float" ? value : DEFAULT_SETTINGS.chat.defaultLayout;

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const defaultShellNextSettings = (): ShellNextSettings => structuredClone(DEFAULT_SETTINGS);
export const defaultShellNextKeybindings = (): ShellNextKeybindings => structuredClone(DEFAULT_KEYBINDINGS);

const resolveStoragePaths = (options?: ShellNextSettingsStorageOptions): {
  dir: string;
  settingsPath: string;
  keybindingsPath: string;
} => {
  if (options?.settingsPath || options?.keybindingsPath) {
    const settingsPath = options.settingsPath ?? SHELL_NEXT_SETTINGS_PATH;
    const keybindingsPath = options.keybindingsPath ?? SHELL_NEXT_KEYBINDINGS_PATH;
    return {
      dir: options.baseDir ?? join(settingsPath, ".."),
      settingsPath,
      keybindingsPath,
    };
  }
  const dir = options?.baseDir ?? SHELL_NEXT_SETTINGS_DIR;
  return {
    dir,
    settingsPath: join(dir, "settings.json"),
    keybindingsPath: join(dir, "keybindings.json"),
  };
};

export const parseShellNextSettings = (raw: string | null | undefined): ShellNextSettings => {
  if (!raw || raw.trim().length === 0) {
    return defaultShellNextSettings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultShellNextSettings();
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
    return defaultShellNextSettings();
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

export const parseShellNextKeybindings = (raw: string | null | undefined): ShellNextKeybindings => {
  if (!raw || raw.trim().length === 0) {
    return defaultShellNextKeybindings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultShellNextKeybindings();
    }
    return {
      textarea: {
        ...DEFAULT_KEYBINDINGS.textarea,
        ...normalizeBindingsRecord(parsed.textarea, ["submit", "newline", "undo", "redo", "copy", "paste"]),
      },
      composer: {
        ...DEFAULT_KEYBINDINGS.composer,
        ...normalizeBindingsRecord(parsed.composer, ["history"]),
      },
      panel: {
        ...DEFAULT_KEYBINDINGS.panel,
        ...normalizeBindingsRecord(parsed.panel, ["confirm", "cancel"]),
      },
    };
  } catch {
    return defaultShellNextKeybindings();
  }
};

export const readShellNextSettings = async (options?: ShellNextSettingsStorageOptions): Promise<ShellNextSettings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseShellNextSettings(await readFile(paths.settingsPath, "utf8"));
  } catch {
    return defaultShellNextSettings();
  }
};

export const readShellNextKeybindings = async (options?: ShellNextSettingsStorageOptions): Promise<ShellNextKeybindings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseShellNextKeybindings(await readFile(paths.keybindingsPath, "utf8"));
  } catch {
    return defaultShellNextKeybindings();
  }
};

export const saveShellNextSettings = async (
  settings: ShellNextSettings,
  options?: ShellNextSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
};

export const saveShellNextKeybindings = async (
  keybindings: ShellNextKeybindings,
  options?: ShellNextSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.keybindingsPath, `${JSON.stringify(keybindings, null, 2)}\n`, "utf8");
};
