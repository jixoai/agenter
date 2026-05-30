import type { GlobalAvatarCatalogEntry, GlobalTerminalEntry } from "@agenter/client-sdk";

import { normalizeShellName } from "../app-runtime/argv";
import { SHELL_DEFAULT_AVATAR, SHELL_APP_ID } from "../app-runtime/app";
import type { ShellSettings } from "../app-room/settings";

export interface ShellNavigationStore {
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

export interface ShellNavigationShellOption {
  kind: "shell";
  shellName: string;
  terminalId: string;
  title: string;
  processPhase: GlobalTerminalEntry["processPhase"];
  updatedAt: number;
  currentTitle?: string | null;
  currentPath?: string | null;
}

export interface ShellNavigationNewShellOption {
  kind: "new-shell";
  shellName: string;
  title: string;
}

export type ShellNavigationShellItem = ShellNavigationShellOption | ShellNavigationNewShellOption;

export interface ShellNavigationAvatarOption {
  kind: "avatar";
  nickname: string;
  displayName: string;
  classify: GlobalAvatarCatalogEntry["classify"] | null;
  defaultAvatar: boolean;
}

export interface ShellNavigationNewAvatarOption {
  kind: "new-avatar";
  nickname: null;
  displayName: string;
  classify: null;
  defaultAvatar: false;
}

export type ShellNavigationAvatarItem = ShellNavigationAvatarOption | ShellNavigationNewAvatarOption;

export interface ShellNavigationModel {
  shellItems: ShellNavigationShellItem[];
  defaultShellIndex: number;
  avatarItems: ShellNavigationAvatarItem[];
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

const isShellTerminal = (terminal: GlobalTerminalEntry): boolean =>
  terminal.archivedAt == null &&
  terminal.processPhase === "running" &&
  terminal.metadata?.appId === SHELL_APP_ID &&
  terminal.metadata.ownerSystem === "terminal-system";

const readShellNameFromTerminal = (terminal: GlobalTerminalEntry): string | null => {
  if (!isShellTerminal(terminal)) {
    return null;
  }
  const resourceKey = readStringMetadata(terminal.metadata, "resourceKey");
  if (!resourceKey) {
    return null;
  }
  return readCanonicalShellRoot(resourceKey);
};

const readKnownShellResourceKey = (terminal: GlobalTerminalEntry): string | null => {
  if (terminal.metadata?.appId !== SHELL_APP_ID || terminal.metadata.ownerSystem !== "terminal-system") {
    return null;
  }
  const resourceKey = readStringMetadata(terminal.metadata, "resourceKey");
  return resourceKey ? readKnownShellRoot(resourceKey) : null;
};

const compareShellOptions = (left: ShellNavigationShellOption, right: ShellNavigationShellOption): number => {
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

export const buildShellNavigationShellItems = (
  terminals: readonly GlobalTerminalEntry[],
  settings: ShellSettings,
  allKnownTerminals: readonly GlobalTerminalEntry[] = terminals,
): { items: ShellNavigationShellItem[]; defaultIndex: number } => {
  const byShellName = new Map<string, ShellNavigationShellOption>();
  for (const terminal of terminals) {
    const shellName = readShellNameFromTerminal(terminal);
    if (!shellName) {
      continue;
    }
    const option: ShellNavigationShellOption = {
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
  const createItem: ShellNavigationNewShellOption = {
    kind: "new-shell",
    shellName: nextShellName(
      allKnownTerminals
        .map((terminal) => readKnownShellResourceKey(terminal))
        .filter((shellName): shellName is string => shellName !== null),
    ),
    title: "New Shell",
  };
  const items: ShellNavigationShellItem[] = [createItem, ...shellItems];
  const lastShellName = settings.startup.lastShellName ? normalizeShellName(settings.startup.lastShellName) : null;
  const savedIndex = lastShellName
    ? items.findIndex((item) => item.kind === "shell" && item.shellName === lastShellName)
    : -1;
  return {
    items,
    defaultIndex: savedIndex >= 0 ? savedIndex : shellItems.length > 0 ? 1 : 0,
  };
};

export const buildShellNavigationAvatarItems = (
  avatars: readonly GlobalAvatarCatalogEntry[],
): { items: ShellNavigationAvatarItem[]; defaultIndex: number } => {
  const avatarItems: ShellNavigationAvatarOption[] = avatars
    .map((avatar) => ({
      kind: "avatar" as const,
      nickname: avatar.nickname,
      displayName: avatar.displayName?.trim() || avatar.nickname,
      classify: avatar.classify ?? null,
      defaultAvatar: avatar.defaultAvatar,
    }))
    .sort((left, right) => {
      if (left.nickname === SHELL_DEFAULT_AVATAR) {
        return -1;
      }
      if (right.nickname === SHELL_DEFAULT_AVATAR) {
        return 1;
      }
      return left.nickname.localeCompare(right.nickname);
    });
  if (!avatarItems.some((item) => item.nickname === SHELL_DEFAULT_AVATAR)) {
    avatarItems.unshift({
      kind: "avatar",
      nickname: SHELL_DEFAULT_AVATAR,
      displayName: "Shell Assistant",
      classify: "assistant",
      defaultAvatar: false,
    });
  }
  const items: ShellNavigationAvatarItem[] = [
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
    items.findIndex((item) => item.kind === "avatar" && item.nickname === SHELL_DEFAULT_AVATAR),
  );
  return { items, defaultIndex };
};

export const buildShellNavigationModel = async (
  store: Pick<
    ShellNavigationStore,
    "listGlobalTerminals" | "listGlobalTerminalIndex" | "hydrateGlobalAvatarCatalog"
  >,
  settings: ShellSettings,
): Promise<ShellNavigationModel> => {
  const [terminals, terminalIndex, avatars] = await Promise.all([
    store.listGlobalTerminals(),
    store.listGlobalTerminalIndex(),
    store.hydrateGlobalAvatarCatalog({ force: true }),
  ]);
  const shell = buildShellNavigationShellItems(terminals, settings, terminalIndex);
  const avatar = buildShellNavigationAvatarItems(avatars);
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
