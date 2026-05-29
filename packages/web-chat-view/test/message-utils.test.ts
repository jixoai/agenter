import { describe, expect, test } from "vitest";

import { estimateMessageRowSize, resolveMessageActorId } from "../src/message-utils";
import type { WebChatChannel, WebChatMessage } from "../src/types";

const TEST_SYSTEM_ID = "0x0000000000000000000000000000000000000a11";

describe("Feature: shared message contact identity resolution", () => {
  test("Scenario: Given a transcript message without senderContactId When its from label matches a room participant Then avatar binding still resolves the participant contact id", () => {
    const channel = {
      chatId: "chat-main",
      kind: "room",
      title: "Room",
      owner: "Iris",
      superKey: TEST_SYSTEM_ID,
      createdBySystemId: TEST_SYSTEM_ID,
      participants: [
        { id: "actor:iris", label: "Iris" },
        { id: "actor:kai", label: "Kai" },
        { id: "actor:lena", label: "Lena" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      roomRevision: "1",
      transcriptRevision: "1",
      accessRole: "admin",
      accessToken: "token",
    } satisfies WebChatChannel;

    const message = {
      rowId: 2,
      viewKey: "message-2",
      messageId: 2,
      chatId: "chat-main",
      sourceSystemId: TEST_SYSTEM_ID,
      from: "Kai",
      kind: "text",
      content: "avatar should still resolve",
      createdAt: 2,
      updatedAt: 2,
      visibleAt: 2,
      readContactIds: [],
      unreadContactIds: [],
      metadata: {},
      attachments: [],
    } satisfies WebChatMessage;

    expect(resolveMessageActorId(channel, message, "actor:kai")).toBe("actor:kai");
  });
});

describe("Feature: shared message row size estimation", () => {
  test("Scenario: Given a compact embedded transcript row When the virtual list estimates a short text message Then the estimate matches normal chat-row geometry", () => {
    const message = {
      rowId: 5,
      viewKey: "message-5",
      messageId: 5,
      chatId: "chat-main",
      sourceSystemId: TEST_SYSTEM_ID,
      from: "Kai",
      kind: "text",
      content: "Transport append #1",
      createdAt: 5,
      updatedAt: 5,
      visibleAt: 5,
      readContactIds: [],
      unreadContactIds: [],
      metadata: {},
      attachments: [],
    } satisfies WebChatMessage;

    expect(estimateMessageRowSize(message)).toBe(72);
  });
});
