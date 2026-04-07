export interface RoomReadAckState {
  ackedRowId: number;
  pendingRowId: number | null;
}

export const EMPTY_ROOM_READ_ACK_STATE: RoomReadAckState = {
  ackedRowId: 0,
  pendingRowId: null,
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
