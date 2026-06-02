import type { MessageContactId } from "@agenter/message-system/types";

import type { WebChatChannel, WebChatMessage, WebChatMessageInput } from "./types";

export interface WebChatTranscriptRenderModel {
  message: WebChatMessage;
  groupFirst: boolean;
  groupLast: boolean;
  groupTail: boolean;
}

const hasViewKey = (message: WebChatMessageInput): message is WebChatMessage =>
  "viewKey" in message && typeof message.viewKey === "string";

export const resolveMessageIdentityKey = (message: WebChatMessage): string =>
  typeof message.messageId === "number" ? `durable:${message.messageId}` : `view:${message.viewKey}`;

export const toWebChatMessage = (message: WebChatMessageInput): WebChatMessage => {
  const normalized = hasViewKey(message)
    ? message
    : {
        ...message,
        viewKey: String(message.messageId),
        messageId: typeof message.messageId === "number" ? message.messageId : undefined,
      };
  return {
    ...normalized,
    visibleAt: normalized.visibleAt ?? normalized.createdAt,
  };
};

export const toWebChatMessages = (messages: readonly WebChatMessageInput[]): WebChatMessage[] =>
  messages.map(toWebChatMessage);

export const compareMessages = (left: WebChatMessage, right: WebChatMessage): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.rowId !== right.rowId) {
    return left.rowId - right.rowId;
  }
  return left.viewKey.localeCompare(right.viewKey);
};

const sameAttachmentSet = (
  left: WebChatMessage["attachments"],
  right: WebChatMessage["attachments"],
): boolean => {
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
    (left.senderContactId ?? null) === (right.senderContactId ?? null) &&
    left.from === right.from &&
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    sameAttachmentSet(left.attachments, right.attachments)
  );
};

const messageAuthority = (message: WebChatMessage): number => {
  const metadataSize = Object.keys(message.metadata ?? {}).length;
  return (
    (typeof message.messageId === "number" ? 1_000 : 0) +
    (message.ref ? 10 : 0) +
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

export const mergeMessages = (current: WebChatMessage[], incoming: WebChatMessage[]): WebChatMessage[] => {
  const byId = new Map<string, WebChatMessage>();
  for (const message of current) {
    byId.set(resolveMessageIdentityKey(message), message);
  }
  for (const message of incoming) {
    byId.set(resolveMessageIdentityKey(message), message);
  }
  return collapseSemanticDuplicates([...byId.values()]);
};

export const normalizeMessageRecord = (message: WebChatMessageInput): WebChatMessage => toWebChatMessage(message);

export const normalizeMessageRecords = (messages: readonly WebChatMessageInput[]): WebChatMessage[] => {
  return messages.map(normalizeMessageRecord);
};

export const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

const normalizeActorLabel = (value: string | null | undefined): string =>
  value?.trim().toLocaleLowerCase() ?? "";

const resolveParticipantMatchByLabel = (
  channel: WebChatChannel,
  label: string | null | undefined,
): WebChatChannel["participants"][number] | undefined => {
  const normalizedLabel = normalizeActorLabel(label);
  if (normalizedLabel.length === 0) {
    return undefined;
  }
  return channel.participants.find((participant) => {
    if (normalizeActorLabel(participant.id) === normalizedLabel) {
      return true;
    }
    const participantLabel = normalizeActorLabel(participant.label);
    if (participantLabel.length > 0 && participantLabel === normalizedLabel) {
      return true;
    }
    return normalizeActorLabel(fallbackActorLabel(participant.id)) === normalizedLabel;
  });
};

export const resolveViewerActorId = (
  channel: WebChatChannel | null,
  viewerActorId?: string | null,
): string | null => {
  if (viewerActorId) {
    return viewerActorId;
  }
  return channel?.participantId ?? null;
};

export const resolveUserSender = (
  channel: WebChatChannel,
  viewerActorId?: string | null,
): { from?: string; senderContactId?: MessageContactId } => {
  const effectiveViewerActorId = resolveViewerActorId(channel, viewerActorId);
  const currentParticipant = effectiveViewerActorId
    ? channel.participants.find((participant) => participant.id === effectiveViewerActorId)
    : undefined;
  const fallbackParticipant =
    currentParticipant ??
    channel.participants.find((participant) => participant.id !== channel.owner) ??
    channel.participants[0];
  return {
    from: fallbackParticipant?.label,
    senderContactId: (effectiveViewerActorId ?? fallbackParticipant?.id) as MessageContactId | undefined,
  };
};

export const resolveMessageActorId = (
  channel: WebChatChannel | null,
  message: Pick<WebChatMessage, "from" | "senderContactId">,
  viewerActorId?: string | null,
): MessageContactId | null => {
  if (message.senderContactId) {
    return message.senderContactId;
  }
  if (!channel) {
    return null;
  }
  if (message.from === channel.owner || message.from === `avatar:${channel.owner}`) {
    const ownerParticipant = resolveParticipantMatchByLabel(channel, channel.owner);
    return (ownerParticipant?.id ?? null) as MessageContactId | null;
  }
  const effectiveViewerActorId = resolveViewerActorId(channel, viewerActorId);
  if (message.from === "You" && effectiveViewerActorId) {
    return effectiveViewerActorId as MessageContactId;
  }
  const participant = resolveParticipantMatchByLabel(channel, message.from);
  if (participant) {
    return participant.id as MessageContactId;
  }
  return effectiveViewerActorId && message.from === channel.participantId
    ? (effectiveViewerActorId as MessageContactId)
    : null;
};

export const isAssistantMessage = (channel: WebChatChannel | null, message: WebChatMessage): boolean => {
  if (!channel) {
    return false;
  }
  return message.from === channel.owner || message.from === `avatar:${channel.owner}`;
};

export const isViewerOwnedMessage = (
  viewerActorId: string | null,
  message: WebChatMessage,
  channel?: WebChatChannel | null,
): boolean => {
  if (!viewerActorId) {
    return false;
  }
  return resolveMessageActorId(channel ?? null, message, viewerActorId) === viewerActorId;
};

export const isRecalledMessage = (message: WebChatMessage): boolean => typeof message.recalledAt === "number";

export const isEditedMessage = (message: WebChatMessage): boolean =>
  !isRecalledMessage(message) && message.updatedAt > message.createdAt;

export const getRenderableMessageText = (message: WebChatMessage): string =>
  isRecalledMessage(message) ? "This message was recalled." : message.content;

const resolveTranscriptGroupKey = (
  channel: WebChatChannel | null,
  message: WebChatMessage,
  viewerActorId: string | null,
): string => {
  if (isAssistantMessage(channel, message)) {
    return `assistant:${channel?.owner ?? message.from}`;
  }
  const actorId = resolveMessageActorId(channel, message, viewerActorId);
  if (actorId) {
    return `actor:${actorId}`;
  }
  if (isViewerOwnedMessage(viewerActorId, message, channel)) {
    return `viewer:${viewerActorId}`;
  }
  return `from:${message.from}:${message.kind}`;
};

export const buildTranscriptRenderModels = (
  messages: readonly WebChatMessage[],
  channel: WebChatChannel | null,
  viewerActorId: string | null,
): WebChatTranscriptRenderModel[] => {
  const groupKeys = messages.map((message) => resolveTranscriptGroupKey(channel, message, viewerActorId));
  return messages.map((message, index) => {
    const previousGroupKey = index > 0 ? groupKeys[index - 1] : null;
    const nextGroupKey = index < messages.length - 1 ? groupKeys[index + 1] : null;
    const currentGroupKey = groupKeys[index] ?? null;
    const groupFirst = previousGroupKey !== currentGroupKey;
    const groupLast = nextGroupKey !== currentGroupKey;
    return {
      message,
      groupFirst,
      groupLast,
      groupTail: groupLast,
    };
  });
};

export const estimateMessageRowSize = (message: WebChatMessage): number => {
  const baseHeight = 52;
  const contentLength = Math.max(getRenderableMessageText(message).trim().length, 1);
  const estimatedTextLines = Math.min(10, Math.ceil(contentLength / 56));
  const textHeight = estimatedTextLines * 20;
  const attachmentHeight = (message.attachments?.length ?? 0) > 0 ? 116 : 0;
  const interactiveHeight =
    message.kind === "interactive" ? 168 + (message.payload?.interactive?.fields.length ?? 0) * 52 : 0;
  const errorHeight = message.kind === "error" ? 44 : 0;
  return baseHeight + textHeight + attachmentHeight + interactiveHeight + errorHeight;
};
