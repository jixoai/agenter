import type { MessageControlPlaneEntry } from "@agenter/message-system";
import { describe, expect, test } from "vitest";

import { buildRoomContactDirectory } from "../src/lib/review-example.api";
import type { ReviewProfile } from "../src/lib/review-example.types";

const TEST_SYSTEM_ID = "0x0000000000000000000000000000000000000a11";

const channel: MessageControlPlaneEntry = {
  chatId: "room-main",
  kind: "room",
  title: "Room",
  owner: "Trusted bootstrap",
  superKey: TEST_SYSTEM_ID,
  createdBySystemId: TEST_SYSTEM_ID,
  participants: [
    {
      id: "auth:kai",
      label: "Trusted bootstrap",
    },
  ],
  seatStates: [
    {
      contactId: "auth:kai",
      role: "member",
      label: "Trusted bootstrap",
      currentAdmin: false,
      online: true,
      focused: true,
      invalidCredential: false,
    },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  roomRevision: "1",
  transcriptRevision: "1",
  accessRole: "member",
  accessToken: "room-token",
  participantId: "auth:kai",
};

const profile: ReviewProfile = {
  id: "room-profile",
  appViewMode: "room",
  name: "Fallback profile",
  transportUrl: "ws://127.0.0.1:4580/room/room-main",
  accessToken: "room-token",
  viewerContactId: "auth:kai",
};

describe("Feature: app-view room actor directory contract", () => {
  test("Scenario: Given daemon snapshot actor presentation When app-view builds room contacts Then canonical sender name and avatar override bootstrap provenance", () => {
    const directory = buildRoomContactDirectory(channel, profile, {
      "auth:kai": {
        actorId: "auth:kai",
        label: "Kai",
        subtitle: "auth:kai",
        iconUrl: "http://127.0.0.1:4580/media/avatars/auth%3Akai/icon",
        kind: "auth",
      },
    });

    expect(directory["auth:kai"]).toMatchObject({
      actorId: "auth:kai",
      label: "Kai",
      iconUrl: "http://127.0.0.1:4580/media/avatars/auth%3Akai/icon",
      kind: "viewer",
    });
    expect(directory["auth:kai"]?.label).not.toBe("Trusted bootstrap");
  });

  test("Scenario: Given no daemon actor presentation When app-view builds room contacts Then profile and seat data remain local fallbacks", () => {
    const directory = buildRoomContactDirectory(channel, profile, undefined);

    expect(directory["auth:kai"]).toMatchObject({
      actorId: "auth:kai",
      label: "Trusted bootstrap",
      kind: "viewer",
    });
  });
});
