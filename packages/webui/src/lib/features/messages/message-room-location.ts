export const MESSAGE_ROOM_SESSION_QUERY_PARAM = "sessionId";

const normalizeMessageRoomSessionId = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export const readMessageRoomSessionId = (searchParams: URLSearchParams): string | null =>
  normalizeMessageRoomSessionId(searchParams.get(MESSAGE_ROOM_SESSION_QUERY_PARAM));

export const buildMessageRoomHref = (input: { chatId: string; sessionId?: string | null }): string => {
  const pathname = `/messages/room/${encodeURIComponent(input.chatId)}`;
  const sessionId = normalizeMessageRoomSessionId(input.sessionId);
  if (!sessionId) {
    return pathname;
  }
  const params = new URLSearchParams();
  params.set(MESSAGE_ROOM_SESSION_QUERY_PARAM, sessionId);
  return `${pathname}?${params.toString()}`;
};
