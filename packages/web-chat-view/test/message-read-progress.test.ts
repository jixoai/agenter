import { describe, expect, test } from "vitest";

import { resolveDefaultMessageReadProgress } from "../src/message-read-progress";
import type { WebChatMessageRenderInput } from "../src/types";

const TEST_SYSTEM_ID = "0x0000000000000000000000000000000000000a11";

const createRenderInput = (input: {
  readContactIds: WebChatMessageRenderInput["message"]["readContactIds"];
  unreadContactIds: WebChatMessageRenderInput["message"]["unreadContactIds"];
}): WebChatMessageRenderInput => ({
  channel: {
    chatId: "room-live",
    kind: "room",
    title: "walkthrough",
    owner: "default",
    superKey: TEST_SYSTEM_ID,
    createdBySystemId: TEST_SYSTEM_ID,
    participants: [],
    createdAt: 1,
    updatedAt: 1,
    focused: false,
    roomRevision: "1",
    transcriptRevision: "1",
    accessRole: "member",
    accessToken: "msgtok_viewer",
    participantId: "auth:viewer",
    currentAdmin: false,
    transportUrl: "ws://127.0.0.1:4600/room/room-live?token=msgtok_viewer",
    seatStates: [
      {
        contactId: "0x1111111111111111111111111111111111111111",
        role: "member",
        label: "default",
        currentAdmin: false,
        online: true,
        focused: false,
        invalidCredential: false,
      },
      {
        contactId: "auth:viewer",
        role: "member",
        label: "Gaubee",
        currentAdmin: false,
        online: true,
        focused: false,
        invalidCredential: false,
      },
    ],
  },
  message: {
    viewKey: "1",
    rowId: 1,
    messageId: 1,
    chatId: "room-live",
    sourceSystemId: TEST_SYSTEM_ID,
    senderContactId: "0x1111111111111111111111111111111111111111",
    from: "default",
    kind: "text",
    content: "hello",
    createdAt: 1,
    updatedAt: 1,
    visibleAt: 1,
    readContactIds: input.readContactIds,
    unreadContactIds: input.unreadContactIds,
    metadata: {},
    attachments: [],
  },
  viewerActorId: "auth:viewer",
  isAssistant: true,
  onSubmitInteractive: async () => {},
});

describe("Feature: default message read progress projection", () => {
  test("Scenario: Given room read facts include the sender When resolving read progress Then the read status panel projects only other actors", () => {
    const progress = resolveDefaultMessageReadProgress(
      createRenderInput({
        readContactIds: ["0x1111111111111111111111111111111111111111", "auth:viewer"],
        unreadContactIds: [],
      }),
    );

    expect(progress?.readCount).toBe(1);
    expect(progress?.totalCount).toBe(1);
    expect(progress?.readActors?.map((actor) => actor.label)).toEqual(["Gaubee"]);
    expect(progress?.unreadActors).toEqual([]);
  });

  test("Scenario: Given sender-only read facts When resolving read progress Then no read-status projection is fabricated", () => {
    const progress = resolveDefaultMessageReadProgress(
      createRenderInput({
        readContactIds: ["0x1111111111111111111111111111111111111111"],
        unreadContactIds: [],
      }),
    );

    expect(progress).toBeNull();
  });

  test("Scenario: Given a message without tracked read membership When resolving read progress Then no projection is fabricated", () => {
    const progress = resolveDefaultMessageReadProgress(
      createRenderInput({
        readContactIds: [],
        unreadContactIds: [],
      }),
    );

    expect(progress).toBeNull();
  });
});
