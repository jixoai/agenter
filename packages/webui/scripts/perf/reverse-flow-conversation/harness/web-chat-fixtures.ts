import type { WebChatChannel, WebChatMessage } from "@agenter/web-chat-view";

export type RoomChatPerfScenarioId =
  | "room-chat-append-away"
  | "room-chat-append-pinned"
  | "room-chat-initial"
  | "room-chat-load-older";

export interface RoomChatPerfScenario {
  appendBatch: WebChatMessage[];
  channel: WebChatChannel;
  latestMessages: WebChatMessage[];
  olderMessages: WebChatMessage[];
}

const baseTime = Date.UTC(2026, 3, 17, 12, 0, 0);

const buildRoomMessage = (rowId: number): WebChatMessage => {
  const lineCount = 1 + (rowId % 5);
  const content = Array.from({ length: lineCount }, (_unused, index) => {
    return `room transcript ${rowId} line ${index + 1} keeps the reverse-flow viewport under load.`;
  }).join("\n");
  return {
    attachments: [],
    chatId: "room-perf",
    content,
    createdAt: baseTime + rowId * 1_000,
    from: rowId % 2 === 0 ? "Bootstrap admin" : "Analyst",
    kind: "text",
    messageId: `room-message-${rowId}`,
    metadata: {},
    readActorIds: [],
    rowId,
    senderActorId: rowId % 2 === 0 ? "system:trusted-bootstrap" : "auth:analyst",
    unreadActorIds: [],
    updatedAt: baseTime + rowId * 1_000,
    visibleAt: baseTime + rowId * 1_000,
  };
};

const latestMessages = Array.from({ length: 96 }, (_unused, index) => buildRoomMessage(105 + index));
const olderMessages = Array.from({ length: 96 }, (_unused, index) => buildRoomMessage(9 + index));
const appendBatch = Array.from({ length: 3 }, (_unused, index) => buildRoomMessage(500 + index));

export const getRoomChatPerfScenario = (_scenarioId: RoomChatPerfScenarioId): RoomChatPerfScenario => ({
  appendBatch,
  channel: {
    accessRole: "admin",
    accessToken: "room-token-admin",
    chatId: "room-perf",
    createdAt: baseTime,
    currentAdmin: true,
    focused: true,
    kind: "room",
    owner: "root",
    participantId: "system:trusted-bootstrap",
    participants: [
      { id: "system:trusted-bootstrap", label: "Bootstrap admin" },
      { id: "auth:analyst", label: "Analyst" },
    ],
    title: "Perf room",
    transportUrl: "ws://storybook.local/room-perf?token=room-token-admin",
    updatedAt: latestMessages.at(-1)!.updatedAt,
  },
  latestMessages,
  olderMessages,
});
