import type { ChatMessage } from "./types";

const toMessageSeq = (messageId: string): number => {
  const value = Number(messageId);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

export interface SessionNotificationItem {
  id: string;
  sessionId: string;
  chatId?: string;
  workspacePath: string;
  sessionName: string;
  messageId: string;
  messageSeq: number;
  content: string;
  timestamp: number;
}

export interface SessionNotificationSnapshot {
  items: SessionNotificationItem[];
  unreadBySession: Record<string, number>;
}

interface ChatVisibilityState {
  visible: boolean;
  focused: boolean;
}

const notificationKey = (sessionId: string, chatId?: string): string => `${sessionId}:${chatId ?? "*"}`;

export class SessionNotificationRegistry {
  private readonly itemsByKey = new Map<string, SessionNotificationItem[]>();
  private readonly visibilityByKey = new Map<string, ChatVisibilityState>();

  snapshot(): SessionNotificationSnapshot {
    const items = [...this.itemsByKey.values()]
      .flat()
      .sort((left, right) => left.timestamp - right.timestamp);
    const unreadCounts = new Map<string, number>();
    for (const item of items) {
      unreadCounts.set(item.sessionId, (unreadCounts.get(item.sessionId) ?? 0) + 1);
    }
    return {
      items,
      unreadBySession: Object.fromEntries(unreadCounts),
    };
  }

  setChatVisibility(input: {
    sessionId: string;
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }): SessionNotificationSnapshot | null {
    const key = notificationKey(input.sessionId, input.chatId);
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
    const key = notificationKey(input.sessionId, input.message.chatId);
    const visibility = this.visibilityByKey.get(key);
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
      chatId: input.message.chatId,
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

  consume(input: {
    sessionId: string;
    chatId?: string;
    upToMessageId?: string | null;
  }): SessionNotificationSnapshot | null {
    const keys = input.chatId ? [notificationKey(input.sessionId, input.chatId)] : [...this.itemsByKey.keys()].filter((key) => key.startsWith(`${input.sessionId}:`));
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
        upToMessageId.length > 0
          ? current.filter((item) => item.messageSeq > toMessageSeq(upToMessageId))
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
