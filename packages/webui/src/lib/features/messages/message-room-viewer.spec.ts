import { describe, expect, test } from "vitest";

import { resolveRoomViewerActorId } from "./message-room-viewer";

describe("Feature: message room viewer selection", () => {
  test("Scenario: Given a stored viewer selection When that actor is still present Then the route keeps the explicit selection", () => {
    expect(
      resolveRoomViewerActorId({
        storedViewerActorId: "session:jane",
        roomParticipantId: "auth:operator",
        currentAuthActorId: "auth:operator",
        seatActorIds: ["auth:operator", "session:jane"],
      }),
    ).toBe("session:jane");
  });

  test("Scenario: Given no stored selection When the current room credential actor is a member Then the route prefers that actor over an earlier-sorted admin seat", () => {
    expect(
      resolveRoomViewerActorId({
        storedViewerActorId: null,
        roomParticipantId: "session:jane",
        currentAuthActorId: "auth:operator",
        seatActorIds: ["auth:operator", "session:jane"],
      }),
    ).toBe("session:jane");
  });

  test("Scenario: Given a control-room participant id When the current auth actor is projected as a seat Then the route prefers the auth actor", () => {
    expect(
      resolveRoomViewerActorId({
        storedViewerActorId: null,
        roomParticipantId: "system:bootstrap-control",
        currentAuthActorId: "auth:operator",
        seatActorIds: ["auth:operator", "session:jane"],
      }),
    ).toBe("auth:operator");
  });

  test("Scenario: Given no stored or credential actor match When resolving the viewer Then the route falls back to the first visible seat", () => {
    expect(
      resolveRoomViewerActorId({
        storedViewerActorId: null,
        roomParticipantId: "session:missing",
        currentAuthActorId: "auth:missing",
        seatActorIds: ["auth:operator", "session:jane"],
      }),
    ).toBe("auth:operator");
  });
});
