import type {
  MessageTransportClientMessage,
  MessageTransportServerMessage,
  ReverseTimeCursor,
} from "@agenter/message-system/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WebChatChannel, WebChatChannelState, WebChatMessage, WebChatSocketFactory, WebChatSocketLike } from "./types";

const CONNECTING_READY_STATE = 0;
const OPEN_READY_STATE = 1;

const compareMessages = (left: WebChatMessage, right: WebChatMessage): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.rowId !== right.rowId) {
    return left.rowId - right.rowId;
  }
  return left.messageId.localeCompare(right.messageId);
};

const isBootstrapMessageId = (messageId: string): boolean => /^\d+$/.test(messageId);

const sameAttachmentSet = (left: WebChatMessage["attachments"], right: WebChatMessage["attachments"]): boolean => {
  if ((left?.length ?? 0) !== (right?.length ?? 0)) {
    return false;
  }
  return (left ?? []).every((attachment, index) => {
    const other = right?.[index];
    return (
      attachment.assetId === other?.assetId &&
      attachment.kind === other?.kind &&
      attachment.mimeType === other?.mimeType &&
      attachment.name === other?.name &&
      attachment.sizeBytes === other?.sizeBytes
    );
  });
};

const sameSemanticMessage = (left: WebChatMessage, right: WebChatMessage): boolean => {
  return (
    left.chatId === right.chatId &&
    left.from === right.from &&
    (left.to ?? null) === (right.to ?? null) &&
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    sameAttachmentSet(left.attachments, right.attachments)
  );
};

const messageAuthority = (message: WebChatMessage): number => {
  const metadataSize = Object.keys(message.metadata ?? {}).length;
  return (
    (isBootstrapMessageId(message.messageId) ? 0 : 100) +
    (message.rootId ? 10 : 0) +
    metadataSize +
    (message.attachments?.length ?? 0)
  );
};

const collapseSemanticDuplicates = (messages: WebChatMessage[]): WebChatMessage[] => {
  const deduped: WebChatMessage[] = [];
  for (const message of messages) {
    const duplicateIndex = deduped.findIndex((existing) => sameSemanticMessage(existing, message));
    if (duplicateIndex === -1) {
      deduped.push(message);
      continue;
    }
    if (messageAuthority(message) > messageAuthority(deduped[duplicateIndex]!)) {
      deduped.splice(duplicateIndex, 1, message);
    }
  }
  return deduped.sort(compareMessages);
};

const mergeMessages = (current: WebChatMessage[], incoming: WebChatMessage[]): WebChatMessage[] => {
  const byId = new Map<string, WebChatMessage>();
  for (const message of current) {
    byId.set(message.messageId, message);
  }
  for (const message of incoming) {
    byId.set(message.messageId, message);
  }
  return collapseSemanticDuplicates([...byId.values()]);
};

const parseServerMessage = (raw: unknown): MessageTransportServerMessage | null => {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as MessageTransportServerMessage;
  } catch {
    return null;
  }
};

const defaultSocketFactory: WebChatSocketFactory = (url) => new WebSocket(url);

const normalizeMessageRecord = (message: WebChatMessage): WebChatMessage => {
  const attentionState = message.attentionState ?? "loaded";
  const visibleAt = message.visibleAt ?? message.createdAt;
  return {
    ...message,
    attentionState,
    visibleAt,
    attentionLoadedAt: message.attentionLoadedAt ?? (attentionState === "loaded" ? visibleAt ?? message.createdAt : undefined),
    editable: message.editable ?? attentionState === "queued",
  };
};

const normalizeMessageRecords = (messages: WebChatMessage[]): WebChatMessage[] => messages.map(normalizeMessageRecord);

const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

const resolveUserSender = (channel: WebChatChannel): { from: string; to?: string } => {
  const currentParticipant = channel.participantId
    ? channel.participants.find((participant) => participant.id === channel.participantId)
    : undefined;
  const fallbackParticipant =
    currentParticipant ??
    channel.participants.find((participant) => (participant.label ?? fallbackActorLabel(participant.id)) !== channel.owner) ??
    channel.participants[0];
  return {
    from: fallbackParticipant?.label ?? (fallbackParticipant ? fallbackActorLabel(fallbackParticipant.id) : "User"),
    to: channel.owner,
  };
};

export const useWebChatChannel = (input: {
  channel: WebChatChannel | null;
  initialMessages?: WebChatMessage[];
  socketFactory?: WebChatSocketFactory;
}): WebChatChannelState => {
  const socketFactory = input.socketFactory ?? defaultSocketFactory;
  const socketRef = useRef<WebChatSocketLike | null>(null);
  const nextBeforeRef = useRef<ReverseTimeCursor | null>(null);
  const [messages, setMessages] = useState<WebChatMessage[]>(normalizeMessageRecords(input.initialMessages ?? []));
  const [connectionState, setConnectionState] = useState<WebChatChannelState["connectionState"]>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const channelId = input.channel?.chatId ?? null;
  const transportUrl = input.channel?.transportUrl ?? null;

  useEffect(() => {
    setFocused(input.channel?.focused ?? false);
  }, [channelId, input.channel?.focused]);

  useEffect(() => {
    setMessages(normalizeMessageRecords(input.initialMessages ?? []));
    setHasMoreBefore(false);
    nextBeforeRef.current = null;
    setErrorMessage(null);
    setLoadingMore(false);
    if (!input.channel) {
      setLoadingInitial(false);
      setConnectionState("idle");
      return;
    }
    if (!transportUrl) {
      setLoadingInitial(false);
      setConnectionState("closed");
      return;
    }

    setLoadingInitial(true);
    setConnectionState("connecting");
    let disposed = false;
    let socket: WebChatSocketLike | null = null;
    let releaseSocket = () => {};

    queueMicrotask(() => {
      if (disposed) {
        return;
      }
      socket = socketFactory(transportUrl);
      socketRef.current = socket;
      const isCurrentSocket = () => socketRef.current === socket;

      const handleOpen = () => {
        if (!isCurrentSocket()) {
          return;
        }
        setConnectionState("connected");
      };

      const handleMessage = (event: Event | MessageEvent) => {
        if (!isCurrentSocket()) {
          return;
        }
        const serverMessage = parseServerMessage(event instanceof MessageEvent ? event.data : null);
        if (!serverMessage) {
          return;
        }
        if (serverMessage.type === "snapshot") {
          setMessages(normalizeMessageRecords(serverMessage.snapshot.items));
          nextBeforeRef.current = serverMessage.snapshot.nextBefore;
          setHasMoreBefore(serverMessage.snapshot.hasMoreBefore);
          setFocused(serverMessage.snapshot.channel.focused);
          setLoadingInitial(false);
          setLoadingMore(false);
          setErrorMessage(null);
          return;
        }
        if (serverMessage.type === "messages") {
          setMessages((current) => mergeMessages(current, normalizeMessageRecords(serverMessage.items)));
          return;
        }
        if (serverMessage.type === "page") {
          nextBeforeRef.current = serverMessage.page.nextBefore;
          setHasMoreBefore(serverMessage.page.hasMoreBefore);
          setMessages((current) => mergeMessages(current, normalizeMessageRecords(serverMessage.page.items)));
          setLoadingMore(false);
          return;
        }
        if (serverMessage.type === "focus") {
          setFocused(serverMessage.focused);
          return;
        }
        setErrorMessage(serverMessage.message);
        setLoadingInitial(false);
        setLoadingMore(false);
        setConnectionState("error");
      };

      const handleClose = () => {
        if (!isCurrentSocket()) {
          return;
        }
        setLoadingInitial(false);
        setLoadingMore(false);
        setConnectionState("closed");
      };

      const handleError = () => {
        if (!isCurrentSocket()) {
          return;
        }
        setLoadingInitial(false);
        setLoadingMore(false);
        setConnectionState("error");
        setErrorMessage("chat transport failed");
      };

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);

      releaseSocket = () => {
        socket?.removeEventListener("open", handleOpen);
        socket?.removeEventListener("message", handleMessage);
        socket?.removeEventListener("close", handleClose);
        socket?.removeEventListener("error", handleError);
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (!socket) {
          return;
        }
        if (socket.readyState === CONNECTING_READY_STATE) {
          const settle = () => {
            socket?.removeEventListener("open", closeAfterOpen);
            socket?.removeEventListener("close", settle);
            socket?.removeEventListener("error", settle);
          };
          const closeAfterOpen = () => {
            socket?.close();
            settle();
          };
          socket.addEventListener("open", closeAfterOpen);
          socket.addEventListener("close", settle);
          socket.addEventListener("error", settle);
          return;
        }
        if (socket.readyState === OPEN_READY_STATE) {
          socket.close();
        }
      };
    });

    return () => {
      disposed = true;
      releaseSocket();
    };
  }, [channelId, socketFactory, transportUrl]);

  useEffect(() => {
    if (!input.initialMessages || input.initialMessages.length === 0) {
      return;
    }
    setMessages((current) => mergeMessages(current, input.initialMessages ?? []));
  }, [channelId, input.initialMessages]);

  const loadOlder = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== OPEN_READY_STATE || !nextBeforeRef.current || loadingMore) {
      return;
    }
    setLoadingMore(true);
    const payload: MessageTransportClientMessage = {
      type: "page",
      before: nextBeforeRef.current,
      limit: 80,
    };
    socket.send(JSON.stringify(payload));
  }, [loadingMore]);

  const sendText = useCallback(
    async (text: string) => {
      const socket = socketRef.current;
      const channel = input.channel;
      if (!socket || socket.readyState !== OPEN_READY_STATE || !channel) {
        throw new Error("chat transport is not connected");
      }
      const normalized = text.trim();
      if (normalized.length === 0) {
        return;
      }
      const sender = resolveUserSender(channel);
      const payload: MessageTransportClientMessage = {
        type: "send",
        message: {
          from: sender.from,
          to: sender.to,
          content: normalized,
        },
      };
      socket.send(JSON.stringify(payload));
    },
    [input.channel],
  );

  const editMessage = useCallback(async (messageId: string, text: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== OPEN_READY_STATE) {
      throw new Error("chat transport is not connected");
    }
    const normalized = text.trim();
    if (normalized.length === 0) {
      return;
    }
    const payload: MessageTransportClientMessage = {
      type: "edit",
      messageId,
      content: normalized,
    };
    socket.send(JSON.stringify(payload));
  }, []);

  const transcriptMessages = useMemo(() => [...messages].sort(compareMessages), [messages]);

  return useMemo(
    () => ({
      connectionState,
      messages,
      transcriptMessages,
      focused,
      hasMoreBefore,
      loadingInitial,
      loadingMore,
      errorMessage,
      loadOlder,
      sendText,
      editMessage,
    }),
    [
      connectionState,
      editMessage,
      errorMessage,
      focused,
      hasMoreBefore,
      loadOlder,
      loadingInitial,
      loadingMore,
      messages,
      sendText,
      transcriptMessages,
    ],
  );
};
