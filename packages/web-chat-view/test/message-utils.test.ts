import { describe, expect, test } from "vitest";

import { resolveMessageActorId } from "../src/message-utils";
import type { WebChatChannel, WebChatMessage } from "../src/types";

describe("Feature: shared message actor identity resolution", () => {
  test("Scenario: Given a transcript message without senderActorId When its from label matches a room participant Then avatar binding still resolves the participant actor id", () => {
    const channel = {
      chatId: "chat-main",
      kind: "room",
      title: "Room",
      owner: "Iris",
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
      from: "Kai",
      kind: "text",
      content: "avatar should still resolve",
      createdAt: 2,
      updatedAt: 2,
      visibleAt: 2,
      readActorIds: [],
      unreadActorIds: [],
      metadata: {},
      attachments: [],
    } satisfies WebChatMessage;

    expect(resolveMessageActorId(channel, message, "actor:kai")).toBe("actor:kai");
  });
});
