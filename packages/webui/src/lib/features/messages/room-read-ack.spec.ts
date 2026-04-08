import { describe, expect, test } from "vitest";

import {
  EMPTY_ROOM_READ_ACK_STATE,
  maybeStartRoomReadAck,
  resolveRoomReadAckKey,
  resolveRoomReadAckProjectionFloor,
  resolveRoomReadAckServerFloor,
  settleRoomReadAckFailure,
  settleRoomReadAckSuccess,
  syncRoomReadAckState,
  type RoomReadAckState,
} from "./room-read-ack";

describe("Feature: room read acknowledgement remains monotonic", () => {
  test("Scenario: Given a duplicate or older row When read ack starts Then no new mark-read request is needed", () => {
    const current: RoomReadAckState = {
      ackedRowId: 8,
      pendingRowId: null,
    };

    expect(maybeStartRoomReadAck(current, 8)).toBeNull();
    expect(maybeStartRoomReadAck(current, 7)).toBeNull();
  });

  test("Scenario: Given a newer visible row When read ack starts Then the state advances into pending without losing the acknowledged floor", () => {
    expect(maybeStartRoomReadAck(undefined, 5)).toEqual({
      ackedRowId: EMPTY_ROOM_READ_ACK_STATE.ackedRowId,
      pendingRowId: 5,
    });
  });

  test("Scenario: Given a newer request is already pending When an older request resolves Then the newer pending floor stays intact", () => {
    const current: RoomReadAckState = {
      ackedRowId: 4,
      pendingRowId: 7,
    };

    expect(settleRoomReadAckSuccess(current, 5)).toEqual({
      ackedRowId: 5,
      pendingRowId: 7,
    });
    expect(settleRoomReadAckFailure(current, 5)).toEqual(current);
  });

  test("Scenario: Given the current pending request fails When the failure is recorded Then only the pending marker clears", () => {
    expect(
      settleRoomReadAckFailure(
        {
          ackedRowId: 6,
          pendingRowId: 9,
        },
        9,
      ),
    ).toEqual({
      ackedRowId: 6,
      pendingRowId: null,
    });
  });

  test("Scenario: Given a room and viewer actor When creating the read-ack key Then acknowledgement remains actor-scoped instead of token-scoped", () => {
    expect(resolveRoomReadAckKey("room-1", "session:jane")).toBe("room-1:session:jane");
  });

  test("Scenario: Given durable read arrays When resolving the server floor Then the newest already-read row becomes the acknowledgement floor", () => {
    expect(
      resolveRoomReadAckServerFloor(
        [
          { rowId: 2, readActorIds: ["session:jane"] },
          { rowId: 5, readActorIds: ["session:jj"] },
          { rowId: 7, readActorIds: ["session:jane", "session:jj"] },
        ],
        "session:jane",
      ),
    ).toBe(7);
  });

  test("Scenario: Given the latest visible row is already projected as read for the viewer When the snapshot lags behind Then the projection floor still suppresses another mark-read request", () => {
    expect(
      resolveRoomReadAckProjectionFloor(
        {
          latestVisibleMessageRowId: 12,
        },
        [
          {
            actorId: "session:jane",
            trackedByLatestVisible: true,
            hasReadLatestVisible: true,
          },
        ],
        "session:jane",
      ),
    ).toBe(12);
  });

  test("Scenario: Given a pending local ack below the durable server floor When syncing state Then the already-read floor wins and stale pending work clears", () => {
    expect(
      syncRoomReadAckState(
        {
          ackedRowId: 0,
          pendingRowId: 4,
        },
        7,
      ),
    ).toEqual({
      ackedRowId: 7,
      pendingRowId: null,
    });
  });
});
