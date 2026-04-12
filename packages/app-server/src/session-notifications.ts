import type {
  AttentionCommit,
  AttentionContextSnapshot,
  AttentionFocusState,
  AttentionSystemSnapshot,
} from "@agenter/attention-system";

const toMessageSeq = (messageId: string): number => {
  const value = Number(messageId);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

export type SessionNotificationSourceType = "chat" | "terminal";

export interface SessionNotificationItem {
  id: string;
  sessionId: string;
  sourceType: SessionNotificationSourceType;
  sourceId: string;
  attentionContextId: string;
  attentionCommitId: string;
  chatId?: string;
  terminalId?: string;
  workspacePath: string;
  sessionName: string;
  messageId?: string;
  messageSeq?: number;
  content: string;
  timestamp: number;
}

export interface SessionNotificationSnapshot {
  items: SessionNotificationItem[];
  unreadBySession: Record<string, number>;
  unreadByChat: Record<string, Record<string, number>>;
  unreadByTerminal: Record<string, Record<string, number>>;
}

const EMPTY_SNAPSHOT: SessionNotificationSnapshot = {
  items: [],
  unreadBySession: {},
  unreadByChat: {},
  unreadByTerminal: {},
};

const bumpNestedCount = (
  target: Record<string, Record<string, number>>,
  sessionId: string,
  sourceId: string,
): void => {
  const nextSessionCounts = target[sessionId] ?? {};
  nextSessionCounts[sourceId] = (nextSessionCounts[sourceId] ?? 0) + 1;
  target[sessionId] = nextSessionCounts;
};

const isCommitConsumed = (
  context: AttentionContextSnapshot,
  commit: AttentionCommit,
  focusState: AttentionFocusState,
): boolean => {
  if (context.consumedPushCommitIds.includes(commit.commitId)) {
    return true;
  }
  if (commit.ingressType !== "push") {
    return false;
  }
  return focusState === "focused";
};

const resolveSource = (
  context: AttentionContextSnapshot,
  commit: AttentionCommit,
):
  | {
      sourceType: SessionNotificationSourceType;
      sourceId: string;
      chatId?: string;
      terminalId?: string;
      messageId?: string;
      messageSeq?: number;
    }
  | null => {
  const systemId = typeof commit.meta.systemId === "string" ? commit.meta.systemId : undefined;
  if (systemId === "message") {
    const chatId =
      typeof commit.meta.channelId === "string" && commit.meta.channelId.length > 0
        ? commit.meta.channelId
        : context.contextId.startsWith("ctx-")
          ? context.contextId.slice(4)
          : undefined;
    if (!chatId) {
      return null;
    }
    const messageId =
      typeof commit.meta.subjectId === "string" && commit.meta.subjectId.length > 0 ? commit.meta.subjectId : undefined;
    return {
      sourceType: "chat",
      sourceId: chatId,
      chatId,
      messageId,
      messageSeq: messageId ? toMessageSeq(messageId) : undefined,
    };
  }
  if (systemId === "terminal") {
    const terminalId =
      typeof commit.meta.subjectId === "string" && commit.meta.subjectId.length > 0
        ? commit.meta.subjectId
        : context.contextId.startsWith("ctx-terminal-")
          ? context.contextId.slice("ctx-terminal-".length)
          : undefined;
    if (!terminalId) {
      return null;
    }
    return {
      sourceType: "terminal",
      sourceId: terminalId,
      terminalId,
    };
  }
  return null;
};

const resolveNotificationContent = (commit: AttentionCommit): string => {
  if (commit.summary.trim().length > 0) {
    return commit.summary;
  }
  if (commit.change.type === "clean") {
    return "";
  }
  return commit.change.value;
};

export const projectSessionNotificationSnapshot = (input: {
  sessionId: string;
  workspacePath: string;
  sessionName: string;
  attention: AttentionSystemSnapshot;
}): SessionNotificationSnapshot => {
  const items: SessionNotificationItem[] = [];
  for (const context of input.attention.contexts) {
    for (const commit of context.commits) {
      if (commit.ingressType !== "push") {
        continue;
      }
      if (isCommitConsumed(context, commit, context.focusState)) {
        continue;
      }
      const source = resolveSource(context, commit);
      if (!source) {
        continue;
      }
      items.push({
        id: `${input.sessionId}:${context.contextId}:${commit.commitId}`,
        sessionId: input.sessionId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        attentionContextId: context.contextId,
        attentionCommitId: commit.commitId,
        chatId: source.chatId,
        terminalId: source.terminalId,
        workspacePath: input.workspacePath,
        sessionName: input.sessionName,
        messageId: source.messageId,
        messageSeq: source.messageSeq,
        content: resolveNotificationContent(commit),
        timestamp: Date.parse(commit.createdAt),
      });
    }
  }

  items.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  if (items.length === 0) {
    return EMPTY_SNAPSHOT;
  }

  const unreadCounts = new Map<string, number>();
  const unreadByChat: Record<string, Record<string, number>> = {};
  const unreadByTerminal: Record<string, Record<string, number>> = {};
  for (const item of items) {
    unreadCounts.set(item.sessionId, (unreadCounts.get(item.sessionId) ?? 0) + 1);
    if (item.sourceType === "chat" && item.chatId) {
      bumpNestedCount(unreadByChat, item.sessionId, item.chatId);
    }
    if (item.sourceType === "terminal" && item.terminalId) {
      bumpNestedCount(unreadByTerminal, item.sessionId, item.terminalId);
    }
  }

  return {
    items,
    unreadBySession: Object.fromEntries(unreadCounts),
    unreadByChat,
    unreadByTerminal,
  };
};

export const mergeSessionNotificationSnapshots = (
  snapshots: readonly SessionNotificationSnapshot[],
): SessionNotificationSnapshot => {
  if (snapshots.length === 0) {
    return EMPTY_SNAPSHOT;
  }
  const items = snapshots.flatMap((snapshot) => snapshot.items).sort((left, right) => left.timestamp - right.timestamp);
  const unreadBySession: Record<string, number> = {};
  const unreadByChat: Record<string, Record<string, number>> = {};
  const unreadByTerminal: Record<string, Record<string, number>> = {};

  for (const snapshot of snapshots) {
    for (const [sessionId, count] of Object.entries(snapshot.unreadBySession)) {
      unreadBySession[sessionId] = (unreadBySession[sessionId] ?? 0) + count;
    }
    for (const [sessionId, byChat] of Object.entries(snapshot.unreadByChat)) {
      for (const [chatId, count] of Object.entries(byChat)) {
        bumpNestedCount(unreadByChat, sessionId, chatId);
        unreadByChat[sessionId]![chatId] = (unreadByChat[sessionId]![chatId] ?? 0) + count - 1;
      }
    }
    for (const [sessionId, byTerminal] of Object.entries(snapshot.unreadByTerminal)) {
      for (const [terminalId, count] of Object.entries(byTerminal)) {
        bumpNestedCount(unreadByTerminal, sessionId, terminalId);
        unreadByTerminal[sessionId]![terminalId] = (unreadByTerminal[sessionId]![terminalId] ?? 0) + count - 1;
      }
    }
  }

  return {
    items,
    unreadBySession,
    unreadByChat,
    unreadByTerminal,
  };
};

export const toAttentionFocusStateFromVisibility = (input: {
  visible: boolean;
  focused: boolean;
}): AttentionFocusState => {
  if (input.focused) {
    return "focused";
  }
  if (input.visible) {
    return "background";
  }
  return "muted";
};
