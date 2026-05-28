import type { CachedResourceState, GlobalRoomEntry, MessageChannelEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildMessageRoomHref } from "./message-room-location";
import {
  buildMessageWorkbenchRooms,
  resolveMessageWorkbenchRoom,
  splitMessageWorkbenchRooms,
} from "./message-workbench-room-state";

const TEST_ROOM_DOMAIN_ID = "0x0000000000000000000000000000000000000001" as const;

const createGlobalRoom = (input: { chatId: string; title: string; archivedAt?: number }): GlobalRoomEntry => ({
  chatId: input.chatId,
  kind: "room",
  title: input.title,
  owner: "global-owner",
  superKey: TEST_ROOM_DOMAIN_ID,
  createdBySystemId: TEST_ROOM_DOMAIN_ID,
  participants: [],
  metadata: {},
  createdAt: 1,
  updatedAt: 2,
  focused: true,
  roomRevision: "0",
  transcriptRevision: "0",
  accessRole: "admin",
  accessToken: `${input.chatId}-token`,
  archivedAt: input.archivedAt,
});

const createSessionRoom = (input: {
  chatId: string;
  title: string;
  contextId?: string;
  archivedAt?: number;
}): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: "room",
  title: input.title,
  owner: "session-owner",
  superKey: TEST_ROOM_DOMAIN_ID,
  createdBySystemId: TEST_ROOM_DOMAIN_ID,
  contextId: input.contextId,
  participants: [],
  metadata: {
    builtIn: true,
  },
  createdAt: 1,
  updatedAt: 2,
  focused: true,
  roomRevision: "0",
  transcriptRevision: "0",
  accessRole: "admin",
  accessToken: `${input.chatId}-token`,
  archivedAt: input.archivedAt,
});

const createChannelState = (
  data: MessageChannelEntry[],
  overrides?: Partial<CachedResourceState<MessageChannelEntry[]>>,
): CachedResourceState<MessageChannelEntry[]> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 1,
  ...overrides,
});

describe("Feature: Messages workbench room state contract", () => {
  test("Scenario: Given a runtime session room deep link When building a room href Then the route carries the sessionId needed for cold-start recovery", () => {
    expect(buildMessageRoomHref({ chatId: "room-session", sessionId: "session-1" })).toBe(
      "/messages/room/room-session?sessionId=session-1",
    );
    expect(buildMessageRoomHref({ chatId: "room-global" })).toBe("/messages/room/room-global");
  });

  test("Scenario: Given the active route points at a session-owned room When building workbench rooms Then the active runtime room is injected without polluting the global catalog", () => {
    const rooms = buildMessageWorkbenchRooms({
      activeRoomId: "room-session",
      activeSessionId: "session-1",
      globalRooms: [createGlobalRoom({ chatId: "room-global", title: "Global room" })],
      messageChannelsBySession: {
        "session-1": createChannelState([
          createSessionRoom({
            chatId: "room-session",
            title: "Avatar primary room",
            contextId: "ctx-room-session",
          }),
        ]),
      },
    });

    expect(rooms.map((room) => room.chatId)).toEqual(["room-global", "room-session"]);
    expect(rooms[1]).toMatchObject({
      source: "session",
      sessionId: "session-1",
      href: "/messages/room/room-session?sessionId=session-1",
    });
  });

  test("Scenario: Given a room exists in the durable global catalog When resolving the current room Then the global truth wins over any session shadow copy", () => {
    const resolved = resolveMessageWorkbenchRoom({
      chatId: "room-shared",
      sessionId: "session-1",
      globalRooms: [createGlobalRoom({ chatId: "room-shared", title: "Shared room" })],
      messageChannelsBySession: {
        "session-1": createChannelState([
          createSessionRoom({
            chatId: "room-shared",
            title: "Session mirror",
          }),
        ]),
      },
    });

    expect(resolved).toMatchObject({
      source: "global",
      sessionId: null,
      href: "/messages/room/room-shared",
    });
  });

  test("Scenario: Given an archived room deep link When resolving the current room Then the room stays reachable instead of disappearing from navigation truth", () => {
    const resolved = resolveMessageWorkbenchRoom({
      chatId: "room-archive",
      sessionId: "session-1",
      globalRooms: [createGlobalRoom({ chatId: "room-archive", title: "Archived room", archivedAt: 42 })],
      messageChannelsBySession: {
        "session-1": createChannelState([
          createSessionRoom({
            chatId: "room-archive",
            title: "Archived mirror",
            archivedAt: 42,
          }),
        ]),
      },
    });

    expect(resolved).toMatchObject({
      chatId: "room-archive",
      source: "global",
      archived: true,
    });
  });

  test("Scenario: Given active and archived room projections When the workbench splits catalog sections Then archived rooms move to a dedicated archived list instead of being deleted from truth", () => {
    const rooms = buildMessageWorkbenchRooms({
      globalRooms: [
        createGlobalRoom({ chatId: "room-active", title: "Active room" }),
        createGlobalRoom({ chatId: "room-archived", title: "Archived room", archivedAt: 42 }),
      ],
      messageChannelsBySession: {},
    });

    const { activeRooms, archivedRooms } = splitMessageWorkbenchRooms(rooms);

    expect(activeRooms.map((room) => room.chatId)).toEqual(["room-active"]);
    expect(archivedRooms.map((room) => room.chatId)).toEqual(["room-archived"]);
  });
});
