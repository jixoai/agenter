import type { CachedResourceState, GlobalRoomEntry, MessageChannelEntry } from "@agenter/client-sdk";

import { buildMessageRoomHref } from "./message-room-location";

export type MessageWorkbenchRoomProjection = GlobalRoomEntry | MessageChannelEntry;

export interface MessageWorkbenchRoom {
  chatId: string;
  title?: string | null;
  source: "global" | "session";
  sessionId: string | null;
  href: string;
  archived: boolean;
  projection: MessageWorkbenchRoomProjection;
}

const toGlobalWorkbenchRoom = (room: GlobalRoomEntry): MessageWorkbenchRoom => ({
  chatId: room.chatId,
  title: room.title,
  source: "global",
  sessionId: null,
  href: buildMessageRoomHref({ chatId: room.chatId }),
  archived: Boolean(room.archivedAt),
  projection: room,
});

const toSessionWorkbenchRoom = (sessionId: string, channel: MessageChannelEntry): MessageWorkbenchRoom => ({
  chatId: channel.chatId,
  title: channel.title,
  source: "session",
  sessionId,
  href: buildMessageRoomHref({ chatId: channel.chatId, sessionId }),
  archived: Boolean(channel.archivedAt),
  projection: channel,
});

const findSessionWorkbenchRoom = (
  chatId: string,
  sessionId: string,
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>,
): MessageWorkbenchRoom | null => {
  const resource = messageChannelsBySession[sessionId];
  const channel = resource?.data.find((entry) => entry.chatId === chatId);
  return channel ? toSessionWorkbenchRoom(sessionId, channel) : null;
};

const findLoadedSessionWorkbenchRoom = (
  chatId: string,
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>,
): MessageWorkbenchRoom | null => {
  for (const [sessionId, resource] of Object.entries(messageChannelsBySession)) {
    const channel = resource.data.find((entry) => entry.chatId === chatId);
    if (channel) {
      return toSessionWorkbenchRoom(sessionId, channel);
    }
  }
  return null;
};

export const getMessageWorkbenchSessionRoomState = (
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>,
  sessionId: string | null | undefined,
): CachedResourceState<MessageChannelEntry[]> | null => {
  return sessionId ? (messageChannelsBySession[sessionId] ?? null) : null;
};

export const resolveMessageWorkbenchRoom = (input: {
  chatId: string | null | undefined;
  sessionId?: string | null;
  globalRooms: ReadonlyArray<GlobalRoomEntry>;
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>;
}): MessageWorkbenchRoom | null => {
  const chatId = input.chatId?.trim();
  if (!chatId) {
    return null;
  }

  const globalRoom = input.globalRooms.find((room) => room.chatId === chatId) ?? null;
  if (globalRoom) {
    return toGlobalWorkbenchRoom(globalRoom);
  }

  if (input.sessionId) {
    const preferredRoom = findSessionWorkbenchRoom(chatId, input.sessionId, input.messageChannelsBySession);
    if (preferredRoom) {
      return preferredRoom;
    }
  }

  return findLoadedSessionWorkbenchRoom(chatId, input.messageChannelsBySession);
};

export const buildMessageWorkbenchRooms = (input: {
  activeRoomId?: string | null;
  activeSessionId?: string | null;
  globalRooms: ReadonlyArray<GlobalRoomEntry>;
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>;
}): MessageWorkbenchRoom[] => {
  const rooms = input.globalRooms.map(toGlobalWorkbenchRoom);
  const activeRoom = resolveMessageWorkbenchRoom({
    chatId: input.activeRoomId,
    sessionId: input.activeSessionId,
    globalRooms: input.globalRooms,
    messageChannelsBySession: input.messageChannelsBySession,
  });

  if (!activeRoom || rooms.some((room) => room.chatId === activeRoom.chatId)) {
    return rooms;
  }
  return [...rooms, activeRoom];
};

export const splitMessageWorkbenchRooms = (
  rooms: ReadonlyArray<MessageWorkbenchRoom>,
): { activeRooms: MessageWorkbenchRoom[]; archivedRooms: MessageWorkbenchRoom[] } => ({
  activeRooms: rooms.filter((room) => !room.archived),
  archivedRooms: rooms.filter((room) => room.archived),
});
