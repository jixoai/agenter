import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type CliShellChatDefaultLayout = "left" | "right" | "cover";

export interface CliShellSettings {
  chat: {
    defaultLayout: CliShellChatDefaultLayout;
  };
  startup: {
    lastShellName: string | null;
    lastAvatarNickname: string | null;
  };
}

export interface CliShellKeybindings {
  textarea?: Partial<Record<CliShellTextareaBindingAction, readonly string[]>>;
  composer?: Partial<Record<CliShellComposerBindingAction, readonly string[]>>;
  panel?: Partial<Record<CliShellPanelBindingAction, readonly string[]>>;
}

export type CliShellTextareaBindingAction =
  | "submit"
  | "newline"
  | "undo"
  | "redo"
  | "copy"
  | "paste";

export type CliShellComposerBindingAction = "history";

export type CliShellPanelBindingAction = "confirm" | "cancel";

export const CLI_SHELL_SETTINGS_DIR = join(homedir(), ".agenter", "cli-shell");
export const CLI_SHELL_SETTINGS_PATH = join(CLI_SHELL_SETTINGS_DIR, "settings.json");
export const CLI_SHELL_KEYBINDINGS_PATH = join(CLI_SHELL_SETTINGS_DIR, "keybindings.json");

export interface CliShellSettingsStorageOptions {
  baseDir?: string;
  settingsPath?: string;
  keybindingsPath?: string;
}

const DEFAULT_SETTINGS: CliShellSettings = {
  chat: {
    defaultLayout: "cover",
  },
  startup: {
    lastShellName: null,
    lastAvatarNickname: null,
  },
};

const DEFAULT_KEYBINDINGS: CliShellKeybindings = {
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

const normalizeLayout = (value: unknown): CliShellChatDefaultLayout =>
  value === "left" || value === "right" || value === "cover" ? value : DEFAULT_SETTINGS.chat.defaultLayout;

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const defaultCliShellSettings = (): CliShellSettings => structuredClone(DEFAULT_SETTINGS);
export const defaultCliShellKeybindings = (): CliShellKeybindings => structuredClone(DEFAULT_KEYBINDINGS);

const resolveStoragePaths = (options?: CliShellSettingsStorageOptions): {
  dir: string;
  settingsPath: string;
  keybindingsPath: string;
} => {
  if (options?.settingsPath || options?.keybindingsPath) {
    const settingsPath = options.settingsPath ?? CLI_SHELL_SETTINGS_PATH;
    const keybindingsPath = options.keybindingsPath ?? CLI_SHELL_KEYBINDINGS_PATH;
    return {
      dir: options.baseDir ?? join(settingsPath, ".."),
      settingsPath,
      keybindingsPath,
    };
  }
  const dir = options?.baseDir ?? CLI_SHELL_SETTINGS_DIR;
  return {
    dir,
    settingsPath: join(dir, "settings.json"),
    keybindingsPath: join(dir, "keybindings.json"),
  };
};

export const parseCliShellSettings = (raw: string | null | undefined): CliShellSettings => {
  if (!raw || raw.trim().length === 0) {
    return defaultCliShellSettings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultCliShellSettings();
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
    return defaultCliShellSettings();
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

export const parseCliShellKeybindings = (raw: string | null | undefined): CliShellKeybindings => {
  if (!raw || raw.trim().length === 0) {
    return defaultCliShellKeybindings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return defaultCliShellKeybindings();
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
    return defaultCliShellKeybindings();
  }
};

export const readCliShellSettings = async (options?: CliShellSettingsStorageOptions): Promise<CliShellSettings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseCliShellSettings(await readFile(paths.settingsPath, "utf8"));
  } catch {
    return defaultCliShellSettings();
  }
};

export const readCliShellKeybindings = async (options?: CliShellSettingsStorageOptions): Promise<CliShellKeybindings> => {
  const paths = resolveStoragePaths(options);
  try {
    return parseCliShellKeybindings(await readFile(paths.keybindingsPath, "utf8"));
  } catch {
    return defaultCliShellKeybindings();
  }
};

export const saveCliShellSettings = async (
  settings: CliShellSettings,
  options?: CliShellSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
};

export const saveCliShellKeybindings = async (
  keybindings: CliShellKeybindings,
  options?: CliShellSettingsStorageOptions,
): Promise<void> => {
  const paths = resolveStoragePaths(options);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.keybindingsPath, `${JSON.stringify(keybindings, null, 2)}\n`, "utf8");
};
