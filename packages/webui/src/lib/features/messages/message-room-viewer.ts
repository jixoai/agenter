type RoomViewerSelectionInput = {
  storedViewerActorId?: string | null;
  roomParticipantId?: string | null;
  currentAuthActorId?: string | null;
  seatActorIds: readonly string[];
};

const includesActor = (
  seatActorIds: readonly string[],
  actorId: string | null | undefined,
): actorId is string => {
  return typeof actorId === "string" && seatActorIds.includes(actorId);
};

export const resolveRoomViewerActorId = ({
  storedViewerActorId,
  roomParticipantId,
  currentAuthActorId,
  seatActorIds,
}: RoomViewerSelectionInput): string | null => {
  if (includesActor(seatActorIds, storedViewerActorId)) {
    return storedViewerActorId;
  }
  if (includesActor(seatActorIds, roomParticipantId)) {
    return roomParticipantId;
  }
  if (includesActor(seatActorIds, currentAuthActorId)) {
    return currentAuthActorId;
  }
  return seatActorIds[0] ?? null;
};
