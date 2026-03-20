import type { ChatMessage } from "./types";

const toMessageSeq = (messageId: string): number => {
  const value = Number(messageId);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

export interface SessionNotificationItem {
  id: string;
  sessionId: string;
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

export class SessionNotificationRegistry {
  private readonly itemsBySession = new Map<string, SessionNotificationItem[]>();
  private readonly visibilityBySession = new Map<string, ChatVisibilityState>();

  snapshot(): SessionNotificationSnapshot {
    const items = [...this.itemsBySession.values()]
      .flat()
      .sort((left, right) => left.timestamp - right.timestamp);
    const unreadBySession = Object.fromEntries(
      [...this.itemsBySession.entries()].map(([sessionId, sessionItems]) => [sessionId, sessionItems.length]),
    );
    return {
      items,
      unreadBySession,
    };
  }

  setChatVisibility(input: { sessionId: string; visible: boolean; focused: boolean }): SessionNotificationSnapshot | null {
    const previous = this.visibilityBySession.get(input.sessionId);
    if (previous?.visible === input.visible && previous.focused === input.focused) {
      return null;
    }
    this.visibilityBySession.set(input.sessionId, {
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
    const visibility = this.visibilityBySession.get(input.sessionId);
    if (visibility?.visible && visibility.focused) {
      return null;
    }
    const current = this.itemsBySession.get(input.sessionId) ?? [];
    if (current.some((item) => item.messageId === input.message.id)) {
      return null;
    }
    current.push({
      id: `${input.sessionId}:${input.message.id}`,
      sessionId: input.sessionId,
      workspacePath: input.workspacePath,
      sessionName: input.sessionName,
      messageId: input.message.id,
      messageSeq: toMessageSeq(input.message.id),
      content: input.message.content,
      timestamp: input.message.timestamp,
    });
    this.itemsBySession.set(input.sessionId, current);
    return this.snapshot();
  }

  consume(input: { sessionId: string; upToMessageId?: string | null }): SessionNotificationSnapshot | null {
    const current = this.itemsBySession.get(input.sessionId) ?? [];
    if (current.length === 0) {
      return null;
    }
    const upToMessageId = input.upToMessageId ?? "";
    const next =
      upToMessageId.length > 0
        ? current.filter((item) => item.messageSeq > toMessageSeq(upToMessageId))
        : [];
    if (next.length === current.length) {
      return null;
    }
    if (next.length === 0) {
      this.itemsBySession.delete(input.sessionId);
    } else {
      this.itemsBySession.set(input.sessionId, next);
    }
    return this.snapshot();
  }

  removeSession(sessionId: string): SessionNotificationSnapshot | null {
    const hadItems = this.itemsBySession.delete(sessionId);
    const hadVisibility = this.visibilityBySession.delete(sessionId);
    if (!hadItems && !hadVisibility) {
      return null;
    }
    return this.snapshot();
  }
}
