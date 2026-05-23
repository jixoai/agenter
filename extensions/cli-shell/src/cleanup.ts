import type { GlobalRoomEntry, GlobalTerminalEntry, SessionEntry } from "@agenter/client-sdk";

import { CLI_SHELL_DEFAULT_AVATAR, CLI_SHELL_PRODUCT_ID } from "./product";

export interface CliShellCleanupStore {
  autoLogin(): Promise<{ ok: true; session: { token: string } } | { ok: false; reason: string; message: string }>;
  setAuthToken(token: string | null | undefined): void;
  listSessions(): Promise<SessionEntry[]>;
  deleteSession(sessionId: string): Promise<void>;
  listGlobalTerminals(): Promise<GlobalTerminalEntry[]>;
  deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }>;
  listGlobalRooms(input?: { includeArchived?: boolean }): Promise<GlobalRoomEntry[]>;
  deleteGlobalRoom(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomEntry>;
}

export interface CliShellCleanupOptions {
  shellName?: string;
  confirm?: boolean;
}

export interface CliShellCleanupTarget {
  shellName: string;
  terminalIds: string[];
  roomIds: string[];
}

export interface CliShellCleanupResult {
  confirmed: boolean;
  targets: CliShellCleanupTarget[];
  sessionIds: string[];
  deleted: {
    sessions: string[];
    terminals: string[];
    rooms: string[];
  };
  failed: {
    sessions: Array<{ sessionId: string; message: string }>;
    terminals: Array<{ terminalId: string; message: string }>;
    rooms: Array<{ roomId: string; message: string }>;
  };
}

const metadataMatches = (
  metadata: Record<string, unknown> | undefined,
  ownerSystem: "terminal-system" | "message-system",
): boolean => metadata?.productId === CLI_SHELL_PRODUCT_ID && metadata.ownerSystem === ownerSystem;

const readResourceKey = (metadata: Record<string, unknown> | undefined): string | null => {
  const resourceKey = metadata?.resourceKey;
  return typeof resourceKey === "string" && resourceKey.trim().length > 0 ? resourceKey : null;
};

const readShellNameFromTerminal = (terminal: GlobalTerminalEntry): string | null => {
  if (!metadataMatches(terminal.metadata, "terminal-system")) {
    return null;
  }
  const resourceKey = readResourceKey(terminal.metadata);
  if (resourceKey?.endsWith(":terminal-1") || resourceKey?.endsWith(":terminal-2")) {
    return resourceKey.replace(/:terminal-[12]$/u, "");
  }
  return resourceKey;
};

const readShellNameFromRoom = (room: GlobalRoomEntry): string | null => {
  if (!metadataMatches(room.metadata, "message-system")) {
    return null;
  }
  return readResourceKey(room.metadata);
};

const uniqueSorted = (values: Iterable<string>): string[] => [...new Set(values)].sort();

const addTargetValue = (
  targets: Map<string, CliShellCleanupTarget>,
  shellName: string,
  kind: "terminalIds" | "roomIds",
  value: string,
): void => {
  const target =
    targets.get(shellName) ??
    ({
      shellName,
      terminalIds: [],
      roomIds: [],
    } satisfies CliShellCleanupTarget);
  target[kind] = uniqueSorted([...target[kind], value]);
  targets.set(shellName, target);
};

const sessionLooksLikeShellAssistant = (session: SessionEntry): boolean =>
  session.avatar === CLI_SHELL_DEFAULT_AVATAR ||
  session.name === CLI_SHELL_DEFAULT_AVATAR ||
  session.name === "shell-assistant";

const resolveShellNameFilter = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isTransportInterrupted = (message: string): boolean =>
  message.includes("Unable to transform response from server") ||
  message.includes("fetch failed") ||
  message.includes("ECONNREFUSED") ||
  message.includes("Bad Gateway");

export const planCliShellCleanup = async (
  store: Pick<CliShellCleanupStore, "listSessions" | "listGlobalTerminals" | "listGlobalRooms">,
  options: CliShellCleanupOptions = {},
): Promise<{ targets: CliShellCleanupTarget[]; sessionIds: string[] }> => {
  const shellFilter = resolveShellNameFilter(options.shellName);
  const [sessions, terminals, rooms] = await Promise.all([
    store.listSessions(),
    store.listGlobalTerminals(),
    store.listGlobalRooms({ includeArchived: true }),
  ]);
  const targets = new Map<string, CliShellCleanupTarget>();

  for (const terminal of terminals) {
    const shellName = readShellNameFromTerminal(terminal);
    if (!shellName || (shellFilter && shellName !== shellFilter)) {
      continue;
    }
    addTargetValue(targets, shellName, "terminalIds", terminal.terminalId);
  }

  for (const room of rooms) {
    const shellName = readShellNameFromRoom(room);
    if (!shellName || (shellFilter && shellName !== shellFilter)) {
      continue;
    }
    addTargetValue(targets, shellName, "roomIds", room.chatId);
  }

  const sessionIds = shellFilter
    ? []
    : uniqueSorted(sessions.filter(sessionLooksLikeShellAssistant).map((session) => session.id));

  return {
    targets: [...targets.values()].sort((left, right) => left.shellName.localeCompare(right.shellName)),
    sessionIds,
  };
};

const requireAutoLogin = async (store: Pick<CliShellCleanupStore, "autoLogin" | "setAuthToken">): Promise<void> => {
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`cli-shell cleanup auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};

export const cleanupCliShellResources = async (
  store: CliShellCleanupStore,
  options: CliShellCleanupOptions = {},
): Promise<CliShellCleanupResult> => {
  await requireAutoLogin(store);
  const plan = await planCliShellCleanup(store, options);
  const result: CliShellCleanupResult = {
    confirmed: options.confirm === true,
    targets: plan.targets,
    sessionIds: plan.sessionIds,
    deleted: {
      sessions: [],
      terminals: [],
      rooms: [],
    },
    failed: {
      sessions: [],
      terminals: [],
      rooms: [],
    },
  };
  if (!options.confirm) {
    return result;
  }

  for (const target of plan.targets) {
    for (const roomId of target.roomIds) {
      try {
        await store.deleteGlobalRoom({ chatId: roomId });
        result.deleted.rooms.push(roomId);
      } catch (error) {
        result.failed.rooms.push({ roomId, message: errorMessage(error) });
      }
    }
  }
  for (const sessionId of plan.sessionIds) {
    try {
      await store.deleteSession(sessionId);
      result.deleted.sessions.push(sessionId);
    } catch (error) {
      result.failed.sessions.push({ sessionId, message: errorMessage(error) });
    }
  }
  let terminalDeletionInterrupted = false;
  for (const target of plan.targets) {
    for (const terminalId of target.terminalIds) {
      if (terminalDeletionInterrupted) {
        result.failed.terminals.push({
          terminalId,
          message: "cleanup interrupted after terminal deletion disconnected the daemon; rerun cleanup after daemon restart",
        });
        continue;
      }
      try {
        const deleted = await store.deleteGlobalTerminal({ terminalId });
        if (deleted.ok) {
          result.deleted.terminals.push(terminalId);
        } else {
          result.failed.terminals.push({ terminalId, message: deleted.message });
        }
      } catch (error) {
        const message = errorMessage(error);
        result.failed.terminals.push({ terminalId, message });
        terminalDeletionInterrupted = isTransportInterrupted(message);
      }
    }
  }

  result.deleted.sessions = uniqueSorted(result.deleted.sessions);
  result.deleted.terminals = uniqueSorted(result.deleted.terminals);
  result.deleted.rooms = uniqueSorted(result.deleted.rooms);
  result.failed.sessions = result.failed.sessions.sort((left, right) =>
    left.sessionId.localeCompare(right.sessionId),
  );
  result.failed.terminals = result.failed.terminals.sort((left, right) =>
    left.terminalId.localeCompare(right.terminalId),
  );
  result.failed.rooms = result.failed.rooms.sort((left, right) => left.roomId.localeCompare(right.roomId));
  return result;
};

export const hasCliShellCleanupFailures = (result: CliShellCleanupResult): boolean =>
  result.failed.sessions.length > 0 || result.failed.terminals.length > 0 || result.failed.rooms.length > 0;

export const formatCliShellCleanupResult = (result: CliShellCleanupResult): string => {
  const lines = [
    result.confirmed
      ? hasCliShellCleanupFailures(result)
        ? "cli-shell cleanup incomplete"
        : "cli-shell cleanup executed"
      : "cli-shell cleanup dry-run",
    `targets: ${result.targets.length}`,
  ];
  for (const target of result.targets) {
    lines.push(
      `- ${target.shellName}: terminals=${target.terminalIds.length} rooms=${target.roomIds.length}`,
    );
    if (target.terminalIds.length > 0) {
      lines.push(`  terminals: ${target.terminalIds.join(", ")}`);
    }
    if (target.roomIds.length > 0) {
      lines.push(`  rooms: ${target.roomIds.join(", ")}`);
    }
  }
  if (result.sessionIds.length > 0) {
    lines.push(`sessions: ${result.sessionIds.join(", ")}`);
  }
  if (result.confirmed) {
    lines.push(
      `deleted: terminals=${result.deleted.terminals.length} rooms=${result.deleted.rooms.length} sessions=${result.deleted.sessions.length}`,
    );
    if (hasCliShellCleanupFailures(result)) {
      lines.push(
        `failed: terminals=${result.failed.terminals.length} rooms=${result.failed.rooms.length} sessions=${result.failed.sessions.length}`,
      );
      for (const failure of result.failed.terminals) {
        lines.push(`  terminal ${failure.terminalId}: ${failure.message}`);
      }
      for (const failure of result.failed.rooms) {
        lines.push(`  room ${failure.roomId}: ${failure.message}`);
      }
      for (const failure of result.failed.sessions) {
        lines.push(`  session ${failure.sessionId}: ${failure.message}`);
      }
    }
  } else {
    lines.push("pass --confirm to delete these cli-shell resources");
  }
  return `${lines.join("\n")}\n`;
};
