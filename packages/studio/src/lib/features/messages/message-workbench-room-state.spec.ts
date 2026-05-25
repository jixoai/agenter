import type { CachedResourceState, GlobalRoomEntry, MessageChannelEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildMessageRoomHref } from "./message-room-location";
import { buildMessageWorkbenchRooms, resolveMessageWorkbenchRoom } from "./message-workbench-room-state";

const createGlobalRoom = (input: { chatId: string; title: string }): GlobalRoomEntry => ({
  chatId: input.chatId,
  kind: "room",
  title: input.title,
  owner: "global-owner",
  participants: [],
  metadata: {},
  createdAt: 1,
  updatedAt: 2,
  focused: true,
  roomRevision: "0",
  transcriptRevision: "0",
  accessRole: "admin",
  accessToken: `${input.chatId}-token`,
});

const createSessionRoom = (input: { chatId: string; title: string; contextId?: string }): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: "room",
  title: input.title,
  owner: "session-owner",
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
});
