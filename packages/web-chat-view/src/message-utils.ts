import type { MessageActorId } from "@agenter/message-system/types";

import type { WebChatChannel, WebChatMessage } from "./types";

export const compareMessages = (left: WebChatMessage, right: WebChatMessage): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.rowId !== right.rowId) {
    return left.rowId - right.rowId;
  }
  return left.messageId.localeCompare(right.messageId);
};

const isBootstrapMessageId = (messageId: string): boolean => /^\d+$/u.test(messageId);

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
    (left.senderActorId ?? null) === (right.senderActorId ?? null) &&
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

export const mergeMessages = (current: WebChatMessage[], incoming: WebChatMessage[]): WebChatMessage[] => {
  const byId = new Map<string, WebChatMessage>();
  for (const message of current) {
    byId.set(message.messageId, message);
  }
  for (const message of incoming) {
    byId.set(message.messageId, message);
  }
  return collapseSemanticDuplicates([...byId.values()]);
};

export const normalizeMessageRecord = (message: WebChatMessage): WebChatMessage => {
  const visibleAt = message.visibleAt ?? message.createdAt;
  return {
    ...message,
    visibleAt,
  };
};

export const normalizeMessageRecords = (messages: WebChatMessage[]): WebChatMessage[] => {
  return messages.map(normalizeMessageRecord);
};

export const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

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
): { from?: string; senderActorId?: MessageActorId; to?: string } => {
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
    senderActorId: (effectiveViewerActorId ?? fallbackParticipant?.id) as MessageActorId | undefined,
    to: channel.owner,
  };
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
): boolean => {
  if (!viewerActorId) {
    return false;
  }
  return message.senderActorId === viewerActorId;
};

export const estimateMessageRowSize = (message: WebChatMessage): number => {
  const baseHeight = 112;
  const contentLength = Math.max(message.content.trim().length, 1);
  const estimatedTextLines = Math.min(10, Math.ceil(contentLength / 56));
  const textHeight = estimatedTextLines * 20;
  const attachmentHeight = (message.attachments?.length ?? 0) > 0 ? 116 : 0;
  const interactiveHeight =
    message.kind === "interactive" ? 168 + (message.payload?.interactive?.fields.length ?? 0) * 52 : 0;
  const errorHeight = message.kind === "error" ? 44 : 0;
  return baseHeight + textHeight + attachmentHeight + interactiveHeight + errorHeight;
};
