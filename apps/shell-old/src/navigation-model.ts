import type { GlobalAvatarCatalogEntry, GlobalTerminalEntry } from "@agenter/client-sdk";

import { normalizeShellName } from "./argv";
import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_APP_ID } from "./app";
import type { CliShellSettings } from "./tui/settings";

export interface CliShellNavigationStore {
  listGlobalTerminals(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]>;
  hydrateGlobalAvatarCatalog(input?: { force?: boolean }): Promise<GlobalAvatarCatalogEntry[]>;
  createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry>;
}

export interface CliShellNavigationShellOption {
  kind: "shell";
  shellName: string;
  terminalId: string;
  title: string;
  processPhase: GlobalTerminalEntry["processPhase"];
  updatedAt: number;
  currentTitle?: string | null;
  currentPath?: string | null;
}

export interface CliShellNavigationNewShellOption {
  kind: "new-shell";
  shellName: string;
  title: string;
}

export type CliShellNavigationShellItem = CliShellNavigationShellOption | CliShellNavigationNewShellOption;

export interface CliShellNavigationAvatarOption {
  kind: "avatar";
  nickname: string;
  displayName: string;
  classify: GlobalAvatarCatalogEntry["classify"] | null;
  defaultAvatar: boolean;
}

export interface CliShellNavigationNewAvatarOption {
  kind: "new-avatar";
  nickname: null;
  displayName: string;
  classify: null;
  defaultAvatar: false;
}

export type CliShellNavigationAvatarItem = CliShellNavigationAvatarOption | CliShellNavigationNewAvatarOption;

export interface CliShellNavigationModel {
  shellItems: CliShellNavigationShellItem[];
  defaultShellIndex: number;
  avatarItems: CliShellNavigationAvatarItem[];
  defaultAvatarIndex: number;
}

const readStringMetadata = (metadata: Record<string, unknown> | undefined, key: string): string | null => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const canonicalShellRootPattern = /^shell-[1-9]\d*$/u;
const legacyTerminalBindingPattern = /^(shell-[1-9]\d*):terminal-[1-9]\d*$/u;

const readCanonicalShellRoot = (resourceKey: string): string | null => {
  const normalized = normalizeShellName(resourceKey);
  return canonicalShellRootPattern.test(normalized) ? normalized : null;
};

const readKnownShellRoot = (resourceKey: string): string | null => {
  const canonicalRoot = readCanonicalShellRoot(resourceKey);
  if (canonicalRoot) {
    return canonicalRoot;
  }
  const normalized = normalizeShellName(resourceKey);
  const legacyMatch = legacyTerminalBindingPattern.exec(normalized);
  return legacyMatch?.[1] ?? null;
};

const isCliShellTerminal = (terminal: GlobalTerminalEntry): boolean =>
  terminal.archivedAt == null &&
  terminal.processPhase === "running" &&
  terminal.metadata?.appId === CLI_SHELL_APP_ID &&
  terminal.metadata.ownerSystem === "terminal-system";

const readShellNameFromTerminal = (terminal: GlobalTerminalEntry): string | null => {
  if (!isCliShellTerminal(terminal)) {
    return null;
  }
  const resourceKey = readStringMetadata(terminal.metadata, "resourceKey");
  if (!resourceKey) {
    return null;
  }
  return readCanonicalShellRoot(resourceKey);
};

const readKnownCliShellResourceKey = (terminal: GlobalTerminalEntry): string | null => {
  if (terminal.metadata?.appId !== CLI_SHELL_APP_ID || terminal.metadata.ownerSystem !== "terminal-system") {
    return null;
  }
  const resourceKey = readStringMetadata(terminal.metadata, "resourceKey");
  return resourceKey ? readKnownShellRoot(resourceKey) : null;
};

const compareShellOptions = (left: CliShellNavigationShellOption, right: CliShellNavigationShellOption): number => {
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  return left.shellName.localeCompare(right.shellName);
};

const nextShellName = (shellNames: readonly string[]): string => {
  const used = new Set(shellNames.map((name) => normalizeShellName(name)));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `shell-${index}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `shell-${Date.now()}`;
};

export const buildCliShellNavigationShellItems = (
  terminals: readonly GlobalTerminalEntry[],
  settings: CliShellSettings,
  allKnownTerminals: readonly GlobalTerminalEntry[] = terminals,
): { items: CliShellNavigationShellItem[]; defaultIndex: number } => {
  const byShellName = new Map<string, CliShellNavigationShellOption>();
  for (const terminal of terminals) {
    const shellName = readShellNameFromTerminal(terminal);
    if (!shellName) {
      continue;
    }
    const option: CliShellNavigationShellOption = {
      kind: "shell",
      shellName,
      terminalId: terminal.terminalId,
      title: terminal.configuredTitle ?? terminal.currentTitle ?? shellName,
      processPhase: terminal.processPhase,
      updatedAt: terminal.updatedAt,
      currentTitle: terminal.currentTitle ?? null,
      currentPath: terminal.currentPath ?? null,
    };
    const existing = byShellName.get(shellName);
    if (!existing || option.updatedAt > existing.updatedAt) {
      byShellName.set(shellName, option);
    }
  }
  const shellItems = [...byShellName.values()].sort(compareShellOptions);
  const createItem: CliShellNavigationNewShellOption = {
    kind: "new-shell",
    shellName: nextShellName(
      allKnownTerminals
        .map((terminal) => readKnownCliShellResourceKey(terminal))
        .filter((shellName): shellName is string => shellName !== null),
    ),
    title: "New Shell",
  };
  const items: CliShellNavigationShellItem[] = [createItem, ...shellItems];
  const lastShellName = settings.startup.lastShellName ? normalizeShellName(settings.startup.lastShellName) : null;
  const savedIndex = lastShellName
    ? items.findIndex((item) => item.kind === "shell" && item.shellName === lastShellName)
    : -1;
  return {
    items,
    defaultIndex: savedIndex >= 0 ? savedIndex : shellItems.length > 0 ? 1 : 0,
  };
};

export const buildCliShellNavigationAvatarItems = (
  avatars: readonly GlobalAvatarCatalogEntry[],
): { items: CliShellNavigationAvatarItem[]; defaultIndex: number } => {
  const avatarItems: CliShellNavigationAvatarOption[] = avatars
    .map((avatar) => ({
      kind: "avatar" as const,
      nickname: avatar.nickname,
      displayName: avatar.displayName?.trim() || avatar.nickname,
      classify: avatar.classify ?? null,
      defaultAvatar: avatar.defaultAvatar,
    }))
    .sort((left, right) => {
      if (left.nickname === CLI_SHELL_DEFAULT_AVATAR) {
        return -1;
      }
      if (right.nickname === CLI_SHELL_DEFAULT_AVATAR) {
        return 1;
      }
      return left.nickname.localeCompare(right.nickname);
    });
  if (!avatarItems.some((item) => item.nickname === CLI_SHELL_DEFAULT_AVATAR)) {
    avatarItems.unshift({
      kind: "avatar",
      nickname: CLI_SHELL_DEFAULT_AVATAR,
      displayName: "Shell Assistant",
      classify: "assistant",
      defaultAvatar: false,
    });
  }
  const items: CliShellNavigationAvatarItem[] = [
    {
      kind: "new-avatar",
      nickname: null,
      displayName: "New Avatar",
      classify: null,
      defaultAvatar: false,
    },
    ...avatarItems,
  ];
  const defaultIndex = Math.max(
    1,
    items.findIndex((item) => item.kind === "avatar" && item.nickname === CLI_SHELL_DEFAULT_AVATAR),
  );
  return { items, defaultIndex };
};

export const buildCliShellNavigationModel = async (
  store: Pick<
    CliShellNavigationStore,
    "listGlobalTerminals" | "listGlobalTerminalIndex" | "hydrateGlobalAvatarCatalog"
  >,
  settings: CliShellSettings,
): Promise<CliShellNavigationModel> => {
  const [terminals, terminalIndex, avatars] = await Promise.all([
    store.listGlobalTerminals(),
    store.listGlobalTerminalIndex(),
    store.hydrateGlobalAvatarCatalog({ force: true }),
  ]);
  const shell = buildCliShellNavigationShellItems(terminals, settings, terminalIndex);
  const avatar = buildCliShellNavigationAvatarItems(avatars);
  return {
    shellItems: shell.items,
    defaultShellIndex: shell.defaultIndex,
    avatarItems: avatar.items,
    defaultAvatarIndex: avatar.defaultIndex,
  };
};

export const normalizeNewAvatarNickname = (value: string): string => {
  const nickname = value.trim();
  if (nickname.length === 0) {
    throw new Error("avatar nickname cannot be empty");
  }
  if (nickname.startsWith("@")) {
    throw new Error("avatar nickname must not start with @");
  }
  if (/\s/u.test(nickname)) {
    throw new Error("avatar nickname must not contain whitespace");
  }
  return nickname;
};
