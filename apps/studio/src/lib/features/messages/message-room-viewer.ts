type RoomViewerSelectionInput = {
  storedViewerActorId?: string | null;
  roomParticipantId?: string | null;
  currentAuthActorId?: string | null;
  seatActorIds: readonly string[];
  seatTruthLoaded?: boolean;
};

export type RoomViewerResolution = {
  actorId: string | null;
  storedViewerState: "selected" | "pending_truth" | "invalid" | "none";
};

const includesActor = (
  seatActorIds: readonly string[],
  actorId: string | null | undefined,
): actorId is string => {
  return typeof actorId === "string" && seatActorIds.includes(actorId);
};

export const resolveRoomViewerResolution = ({
  storedViewerActorId,
  roomParticipantId,
  currentAuthActorId,
  seatActorIds,
  seatTruthLoaded = true,
}: RoomViewerSelectionInput): RoomViewerResolution => {
  if (includesActor(seatActorIds, storedViewerActorId)) {
    return {
      actorId: storedViewerActorId,
      storedViewerState: "selected",
    };
  }
  if (storedViewerActorId && !seatTruthLoaded) {
    return {
      actorId: storedViewerActorId,
      storedViewerState: "pending_truth",
    };
  }
  if (includesActor(seatActorIds, roomParticipantId)) {
    return {
      actorId: roomParticipantId,
      storedViewerState: storedViewerActorId ? "invalid" : "none",
    };
  }
  if (includesActor(seatActorIds, currentAuthActorId)) {
    return {
      actorId: currentAuthActorId,
      storedViewerState: storedViewerActorId ? "invalid" : "none",
    };
  }
  return {
    actorId: seatActorIds[0] ?? null,
    storedViewerState: storedViewerActorId ? "invalid" : "none",
  };
};

export const resolveRoomViewerActorId = (input: RoomViewerSelectionInput): string | null =>
  resolveRoomViewerResolution(input).actorId;
