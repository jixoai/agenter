import type { ChatMessage } from "./types";
import { DEFAULT_MESSAGE_CHAT_ID } from "./session-chat-projection";

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

interface ChatVisibilityState {
  visible: boolean;
  focused: boolean;
}

const notificationKey = (sessionId: string, sourceType: SessionNotificationSourceType, sourceId?: string): string =>
  `${sessionId}:${sourceType}:${sourceId ?? "*"}`;

const bumpNestedCount = (
  target: Record<string, Record<string, number>>,
  sessionId: string,
  sourceId: string,
): void => {
  const nextSessionCounts = target[sessionId] ?? {};
  nextSessionCounts[sourceId] = (nextSessionCounts[sourceId] ?? 0) + 1;
  target[sessionId] = nextSessionCounts;
};

export class SessionNotificationRegistry {
  private readonly itemsByKey = new Map<string, SessionNotificationItem[]>();
  private readonly visibilityByKey = new Map<string, ChatVisibilityState>();

  private getVisibility(
    sessionId: string,
    sourceType: SessionNotificationSourceType,
    sourceId: string,
  ): ChatVisibilityState | undefined {
    return (
      this.visibilityByKey.get(notificationKey(sessionId, sourceType, sourceId)) ??
      this.visibilityByKey.get(notificationKey(sessionId, sourceType))
    );
  }

  snapshot(): SessionNotificationSnapshot {
    const items = [...this.itemsByKey.values()]
      .flat()
      .sort((left, right) => left.timestamp - right.timestamp);
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
  }

  setChatVisibility(input: {
    sessionId: string;
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }): SessionNotificationSnapshot | null {
    const key = notificationKey(input.sessionId, "chat", input.chatId);
    const previous = this.visibilityByKey.get(key);
    if (previous?.visible === input.visible && previous.focused === input.focused) {
      return null;
    }
    this.visibilityByKey.set(key, {
      visible: input.visible,
      focused: input.focused,
    });
    return this.snapshot();
  }

  setTerminalVisibility(input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }): SessionNotificationSnapshot | null {
    const key = notificationKey(input.sessionId, "terminal", input.terminalId);
    const previous = this.visibilityByKey.get(key);
    if (previous?.visible === input.visible && previous.focused === input.focused) {
      return null;
    }
    this.visibilityByKey.set(key, {
      visible: input.visible,
      focused: input.focused,
    });
    return this.snapshot();
  }

  noteAssistantReply(input: {
    sessionId: string;
    workspacePath: string;
    sessionName: string;
    message: ChatMessage;
  }): SessionNotificationSnapshot | null {
    if (input.message.role !== "assistant" || input.message.channel !== "to_user") {
      return null;
    }
    const chatId = input.message.chatId ?? DEFAULT_MESSAGE_CHAT_ID;
    const key = notificationKey(input.sessionId, "chat", chatId);
    const visibility = this.getVisibility(input.sessionId, "chat", chatId);
    if (visibility?.visible && visibility.focused) {
      return null;
    }
    const current = this.itemsByKey.get(key) ?? [];
    if (current.some((item) => item.messageId === input.message.id)) {
      return null;
    }
    current.push({
      id: `${key}:${input.message.id}`,
      sessionId: input.sessionId,
      sourceType: "chat",
      sourceId: chatId,
      chatId,
      workspacePath: input.workspacePath,
      sessionName: input.sessionName,
      messageId: input.message.id,
      messageSeq: toMessageSeq(input.message.id),
      content: input.message.content,
      timestamp: input.message.timestamp,
    });
    this.itemsByKey.set(key, current);
    return this.snapshot();
  }

  noteTerminalNotification(input: {
    sessionId: string;
    workspacePath: string;
    sessionName: string;
    terminalId: string;
    notificationId: string;
    content: string;
    timestamp: number;
  }): SessionNotificationSnapshot | null {
    const key = notificationKey(input.sessionId, "terminal", input.terminalId);
    const visibility = this.getVisibility(input.sessionId, "terminal", input.terminalId);
    if (visibility?.visible && visibility.focused) {
      return null;
    }
    const current = this.itemsByKey.get(key) ?? [];
    if (current.some((item) => item.id === `${key}:${input.notificationId}`)) {
      return null;
    }
    current.push({
      id: `${key}:${input.notificationId}`,
      sessionId: input.sessionId,
      sourceType: "terminal",
      sourceId: input.terminalId,
      terminalId: input.terminalId,
      workspacePath: input.workspacePath,
      sessionName: input.sessionName,
      content: input.content,
      timestamp: input.timestamp,
    });
    this.itemsByKey.set(key, current);
    return this.snapshot();
  }

  consume(input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToMessageId?: string | null;
  }): SessionNotificationSnapshot | null {
    const keys = input.chatId
      ? [notificationKey(input.sessionId, "chat", input.chatId)]
      : input.terminalId
        ? [notificationKey(input.sessionId, "terminal", input.terminalId)]
        : [...this.itemsByKey.keys()].filter((key) => key.startsWith(`${input.sessionId}:`));
    if (keys.length === 0) {
      return null;
    }
    const upToMessageId = input.upToMessageId ?? "";
    let changed = false;
    for (const key of keys) {
      const current = this.itemsByKey.get(key) ?? [];
      if (current.length === 0) {
        continue;
      }
      const next =
        input.chatId && upToMessageId.length > 0
          ? current.filter((item) => (item.messageSeq ?? 0) > toMessageSeq(upToMessageId))
          : [];
      if (next.length === current.length) {
        continue;
      }
      changed = true;
      if (next.length === 0) {
        this.itemsByKey.delete(key);
      } else {
        this.itemsByKey.set(key, next);
      }
    }
    if (!changed) {
      return null;
    }
    return this.snapshot();
  }

  removeSession(sessionId: string): SessionNotificationSnapshot | null {
    let hadItems = false;
    let hadVisibility = false;
    for (const key of [...this.itemsByKey.keys()]) {
      if (!key.startsWith(`${sessionId}:`)) {
        continue;
      }
      hadItems = this.itemsByKey.delete(key) || hadItems;
    }
    for (const key of [...this.visibilityByKey.keys()]) {
      if (!key.startsWith(`${sessionId}:`)) {
        continue;
      }
      hadVisibility = this.visibilityByKey.delete(key) || hadVisibility;
    }
    if (!hadItems && !hadVisibility) {
      return null;
    }
    return this.snapshot();
  }
}
