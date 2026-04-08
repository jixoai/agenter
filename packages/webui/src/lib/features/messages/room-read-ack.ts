export interface RoomReadAckState {
  ackedRowId: number;
  pendingRowId: number | null;
}

export interface RoomReadAckMessageLike {
  rowId: number;
  readActorIds?: readonly string[];
}

export interface RoomReadAckProgressLike {
  latestVisibleMessageRowId?: number;
}

export interface RoomReadAckSeatLike {
  actorId: string;
  trackedByLatestVisible: boolean;
  hasReadLatestVisible: boolean;
}

export const EMPTY_ROOM_READ_ACK_STATE: RoomReadAckState = {
  ackedRowId: 0,
  pendingRowId: null,
};

export const resolveRoomReadAckKey = (chatId: string, actorId: string): string => `${chatId}:${actorId}`;

export const resolveRoomReadAckServerFloor = (
  messages: readonly RoomReadAckMessageLike[],
  actorId: string,
): number => {
  let latestReadRowId = 0;
  for (const message of messages) {
    if (!message.readActorIds?.includes(actorId)) {
      continue;
    }
    latestReadRowId = Math.max(latestReadRowId, message.rowId);
  }
  return latestReadRowId;
};

export const resolveRoomReadAckProjectionFloor = (
  readProgress: RoomReadAckProgressLike | null | undefined,
  roomSeatStates: readonly RoomReadAckSeatLike[],
  actorId: string,
): number => {
  const latestVisibleRowId = readProgress?.latestVisibleMessageRowId ?? 0;
  if (latestVisibleRowId <= 0) {
    return 0;
  }
  const viewerSeat = roomSeatStates.find((seat) => seat.actorId === actorId) ?? null;
  if (!viewerSeat?.trackedByLatestVisible || !viewerSeat.hasReadLatestVisible) {
    return 0;
  }
  return latestVisibleRowId;
};

export const syncRoomReadAckState = (
  state: RoomReadAckState | undefined,
  serverAckedRowId: number,
): RoomReadAckState => {
  const current = state ?? EMPTY_ROOM_READ_ACK_STATE;
  const ackedRowId = Math.max(current.ackedRowId, serverAckedRowId);
  return {
    ackedRowId,
    pendingRowId:
      current.pendingRowId !== null && current.pendingRowId > ackedRowId ? current.pendingRowId : null,
  };
};

export const maybeStartRoomReadAck = (
  state: RoomReadAckState | undefined,
  targetRowId: number,
): RoomReadAckState | null => {
  const current = state ?? EMPTY_ROOM_READ_ACK_STATE;
  const currentFloor = Math.max(current.ackedRowId, current.pendingRowId ?? 0);
  if (targetRowId <= currentFloor) {
    return null;
  }
  return {
    ackedRowId: current.ackedRowId,
    pendingRowId: targetRowId,
  };
};

export const settleRoomReadAckSuccess = (
  state: RoomReadAckState | undefined,
  targetRowId: number,
): RoomReadAckState => {
  const current = state ?? EMPTY_ROOM_READ_ACK_STATE;
  return {
    ackedRowId: Math.max(current.ackedRowId, targetRowId),
    pendingRowId: current.pendingRowId === targetRowId ? null : current.pendingRowId,
  };
};

export const settleRoomReadAckFailure = (
  state: RoomReadAckState | undefined,
  targetRowId: number,
): RoomReadAckState => {
  const current = state ?? EMPTY_ROOM_READ_ACK_STATE;
  if (current.pendingRowId !== targetRowId) {
    return current;
  }
  return {
    ackedRowId: current.ackedRowId,
    pendingRowId: null,
  };
};
