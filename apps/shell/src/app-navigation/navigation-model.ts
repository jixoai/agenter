import type {
  AuthSessionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomEntry,
  GlobalTerminalEntry,
} from "@agenter/client-sdk";
import { parseColor, StyledText, type TextChunk } from "@opentui/core";

import { padShellRoomText } from "../app-room/room-model";
import type { ShellSettings } from "../app-room/settings";
import { SHELL_APP_ID, SHELL_DEFAULT_AVATAR } from "../app-runtime/app";
import { normalizeShellName } from "../app-runtime/argv";

export interface ShellNavigationStore {
  listGlobalTerminals(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]>;
  listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]>;
  listGlobalRooms(input?: { includeArchived?: boolean }): Promise<GlobalRoomEntry[]>;
  getAuthSession?(): Promise<AuthSessionOutput | null>;
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
  roomId: string | null;
  avatarNickname: string;
  peopleMentions: string[];
  rowFields: ShellNavigationTerminalRowFields;
}

export interface ShellNavigationNewShellOption {
  kind: "new-shell";
  shellName: string;
  title: string;
}

export type ShellNavigationShellItem = ShellNavigationShellOption | ShellNavigationNewShellOption;

export interface ShellNavigationTerminalRowFields {
  key: string;
  status: string;
  title: string;
  detail: string;
  people: string;
}

export interface ShellNavigationRenderedRow {
  plainText: string;
  content: string | StyledText;
}

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
const readCanonicalShellRoot = (resourceKey: string): string | null => {
  const normalized = normalizeShellName(resourceKey);
  return canonicalShellRootPattern.test(normalized) ? normalized : null;
};

const readKnownShellRoot = (resourceKey: string): string | null => {
  // Unsupported legacy keys are intentionally not repaired during entry selection.
  const canonicalRoot = readCanonicalShellRoot(resourceKey);
  if (canonicalRoot) {
    return canonicalRoot;
  }
  return null;
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

const readShellNameFromRoom = (room: GlobalRoomEntry): string | null => {
  if (
    room.archivedAt != null ||
    room.metadata?.appId !== SHELL_APP_ID ||
    room.metadata.ownerSystem !== "message-system"
  ) {
    return null;
  }
  const resourceKey = readStringMetadata(room.metadata, "resourceKey");
  return resourceKey ? readCanonicalShellRoot(resourceKey) : null;
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

const currentSuperadminActorId = (auth: AuthSessionOutput | null | undefined): string | null => {
  const authId = auth?.claims.authId?.trim();
  return authId && auth?.claims.superadmin === true ? `auth:${authId}` : null;
};

const mentionFromParticipant = (participant: { id: string; label?: string }): string => {
  const raw = participant.label?.trim() || participant.id.split(":").at(-1) || participant.id;
  return raw.startsWith("@") ? raw : `@${raw}`;
};

const peopleMentionsForRoom = (
  room: GlobalRoomEntry | undefined,
  auth: AuthSessionOutput | null | undefined,
): string[] => {
  if (!room) {
    return [];
  }
  const excluded = currentSuperadminActorId(auth);
  return room.participants
    .filter((participant) => participant.id !== excluded)
    .map(mentionFromParticipant)
    .filter((mention, index, mentions) => mentions.indexOf(mention) === index);
};

const rowFieldsForTerminal = (input: {
  shellName: string;
  terminal: GlobalTerminalEntry;
  room: GlobalRoomEntry | undefined;
  auth: AuthSessionOutput | null | undefined;
}): ShellNavigationTerminalRowFields => {
  const title = input.terminal.currentTitle?.trim() || input.terminal.configuredTitle?.trim() || input.shellName;
  const detail = input.terminal.currentPath?.trim() || input.terminal.terminalId;
  const peopleMentions = peopleMentionsForRoom(input.room, input.auth);
  return {
    key: input.shellName,
    status: input.terminal.processPhase,
    title,
    detail,
    people: peopleMentions.join(" "),
  };
};

const chunk = (text: string, fg: string): TextChunk => ({
  __isChunk: true,
  text,
  fg: parseColor(fg),
});

const styledRow = (chunks: TextChunk[]): StyledText => new StyledText(chunks);

export const buildShellNavigationTerminalRow = (
  item: ShellNavigationShellItem,
  width: number,
): ShellNavigationRenderedRow => {
  if (item.kind === "new-shell") {
    const plainText = `+ ${item.title} (${item.shellName})`;
    return { plainText, content: padShellRoomText(plainText, width) };
  }
  const fields = item.rowFields;
  const plainText = [fields.key, fields.status, fields.title, fields.detail, fields.people]
    .filter((part) => part.length > 0)
    .join("  ");
  return {
    plainText,
    content: styledRow([
      chunk(fields.key, "#38bdf8"),
      chunk("  ", "#64748b"),
      chunk(fields.status, "#facc15"),
      chunk("  ", "#64748b"),
      chunk(fields.title, "#f8fafc"),
      chunk("  ", "#64748b"),
      chunk(fields.detail, "#94a3b8"),
      ...(fields.people ? [chunk("  ", "#64748b"), chunk(fields.people, "#a78bfa")] : []),
    ]),
  };
};

export const buildShellNavigationShellItems = (
  terminals: readonly GlobalTerminalEntry[],
  settings: ShellSettings,
  allKnownTerminals: readonly GlobalTerminalEntry[] = terminals,
  rooms: readonly GlobalRoomEntry[] = [],
  auth: AuthSessionOutput | null = null,
): { items: ShellNavigationShellItem[]; defaultIndex: number } => {
  const byShellName = new Map<string, ShellNavigationShellOption>();
  const roomsByShellName = new Map<string, GlobalRoomEntry>();
  for (const room of rooms) {
    const shellName = readShellNameFromRoom(room);
    if (shellName) {
      roomsByShellName.set(shellName, room);
    }
  }
  for (const terminal of terminals) {
    const shellName = readShellNameFromTerminal(terminal);
    if (!shellName) {
      continue;
    }
    const room = roomsByShellName.get(shellName);
    const rowFields = rowFieldsForTerminal({ shellName, terminal, room, auth });
    const option: ShellNavigationShellOption = {
      kind: "shell",
      shellName,
      terminalId: terminal.terminalId,
      title: rowFields.title,
      processPhase: terminal.processPhase,
      updatedAt: terminal.updatedAt,
      currentTitle: terminal.currentTitle ?? null,
      currentPath: terminal.currentPath ?? null,
      roomId: room?.chatId ?? null,
      avatarNickname: settings.startup.lastAvatarNickname ?? SHELL_DEFAULT_AVATAR,
      peopleMentions: rowFields.people.length > 0 ? rowFields.people.split(" ") : [],
      rowFields,
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
    title: "New Terminal",
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
    | "listGlobalTerminals"
    | "listGlobalTerminalIndex"
    | "listGlobalRooms"
    | "getAuthSession"
    | "hydrateGlobalAvatarCatalog"
  >,
  settings: ShellSettings,
): Promise<ShellNavigationModel> => {
  const [terminals, terminalIndex, avatars] = await Promise.all([
    store.listGlobalTerminals(),
    store.listGlobalTerminalIndex(),
    store.hydrateGlobalAvatarCatalog({ force: true }),
  ]);
  const [rooms, auth] = await Promise.all([store.listGlobalRooms(), store.getAuthSession?.() ?? Promise.resolve(null)]);
  const shell = buildShellNavigationShellItems(terminals, settings, terminalIndex, rooms, auth);
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
