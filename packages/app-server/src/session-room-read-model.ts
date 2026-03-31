import type { MessageRecord } from "@agenter/message-system";
import type { SessionBlockRecord } from "@agenter/session-system";

import { toChatSessionAsset } from "./session-assets";
import type { ChatMessage } from "./types";

export const readPersistedBlockChatId = (block: Pick<SessionBlockRecord, "chatId">): string | null => {
  if (typeof block.chatId !== "string") {
    return null;
  }
  const normalized = block.chatId.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveRoomBackedBlockRef = (
  block: Pick<SessionBlockRecord, "chatId" | "messageId" | "projection">,
  fallbackRoomId: string,
): { roomId: string; messageId: string } | null => {
  if (block.projection?.source === "room-message-ref") {
    return {
      roomId: block.projection.roomId.trim().length > 0 ? block.projection.roomId : fallbackRoomId,
      messageId: block.projection.messageId,
    };
  }
  if (typeof block.messageId !== "string" || block.messageId.trim().length === 0) {
    return null;
  }
  return {
    roomId: readPersistedBlockChatId(block) ?? fallbackRoomId,
    messageId: block.messageId,
  };
};

const toLegacyBlockChatMessage = (
  sessionId: string,
  block: SessionBlockRecord,
  chatId: string,
): ChatMessage => ({
  id: block.messageId ?? `${block.id}`,
  chatId,
  role: block.role,
  content: block.content,
  timestamp: block.createdAt,
  updatedAt: block.updatedAt,
  visibleAt: block.visibleAt,
  attentionState: block.attentionState,
  attentionLoadedAt: block.attentionLoadedAt,
  editable: block.attentionState === "queued",
  cycleId: block.cycleId,
  channel: block.channel === "user_input" ? undefined : block.channel,
  format: block.format,
  tool: block.tool,
  attachments: block.attachments.map((attachment) => toChatSessionAsset(sessionId, attachment)),
});

const toRoomBackedChatMessage = (
  block: SessionBlockRecord,
  message: MessageRecord,
): ChatMessage => ({
  id: message.messageId,
  chatId: message.chatId,
  role: block.role,
  content: message.content,
  messageKind: message.kind,
  messagePayload: message.payload,
  timestamp: message.createdAt,
  updatedAt: message.updatedAt,
  visibleAt: message.visibleAt,
  attentionState: message.attentionState,
  attentionLoadedAt: message.attentionLoadedAt,
  editable: message.editable,
  cycleId: block.cycleId,
  channel: block.channel === "user_input" ? undefined : block.channel,
  format: block.format,
  attachments: message.attachments?.map((attachment) => ({
    assetId: attachment.assetId,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
  })),
});

export const projectPersistedBlockToChatMessage = (input: {
  sessionId: string;
  block: SessionBlockRecord;
  fallbackRoomId: string;
  lookupRoomMessage: (roomId: string, messageId: string) => MessageRecord | undefined;
}): ChatMessage => {
  const roomRef = resolveRoomBackedBlockRef(input.block, input.fallbackRoomId);
  if (roomRef) {
    const roomMessage = input.lookupRoomMessage(roomRef.roomId, roomRef.messageId);
    if (roomMessage) {
      return toRoomBackedChatMessage(input.block, roomMessage);
    }
    return toLegacyBlockChatMessage(input.sessionId, input.block, roomRef.roomId);
  }
  return toLegacyBlockChatMessage(
    input.sessionId,
    input.block,
    readPersistedBlockChatId(input.block) ?? input.fallbackRoomId,
  );
};
