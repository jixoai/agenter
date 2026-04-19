export type RoomViewerPreferencePendingMap = Record<string, string | null>;

export interface RoomViewerPreferenceBrowserStore {
  read(authId: string | null | undefined): RoomViewerPreferencePendingMap;
  write(authId: string | null | undefined, pendingByRoomId: RoomViewerPreferencePendingMap): void;
}

const ROOM_VIEWER_PENDING_STORAGE_PREFIX = "agenter:webui:messages:room-viewer-pending:";

const storageKey = (authId: string): string => `${ROOM_VIEWER_PENDING_STORAGE_PREFIX}${authId}`;

const normalizePendingByRoomId = (value: unknown): RoomViewerPreferencePendingMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<RoomViewerPreferencePendingMap>((nextPendingByRoomId, [roomId, actorId]) => {
      const normalizedRoomId = roomId.trim();
      if (normalizedRoomId.length === 0) {
        return nextPendingByRoomId;
      }
      if (actorId === null) {
        nextPendingByRoomId[normalizedRoomId] = null;
        return nextPendingByRoomId;
      }
      if (typeof actorId !== "string") {
        return nextPendingByRoomId;
      }
      const normalizedActorId = actorId.trim();
      if (normalizedActorId.length === 0) {
        return nextPendingByRoomId;
      }
      nextPendingByRoomId[normalizedRoomId] = normalizedActorId;
      return nextPendingByRoomId;
    }, {});
};

export const roomViewerPreferenceBrowserStore: RoomViewerPreferenceBrowserStore = {
  read(authId) {
    const normalizedAuthId = authId?.trim();
    if (typeof window === "undefined" || !normalizedAuthId) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(storageKey(normalizedAuthId));
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as { pendingByRoomId?: unknown };
      return normalizePendingByRoomId(parsed.pendingByRoomId);
    } catch {
      return {};
    }
  },

  write(authId, pendingByRoomId) {
    const normalizedAuthId = authId?.trim();
    if (typeof window === "undefined" || !normalizedAuthId) {
      return;
    }
    const normalizedPendingByRoomId = normalizePendingByRoomId(pendingByRoomId);
    if (Object.keys(normalizedPendingByRoomId).length === 0) {
      window.localStorage.removeItem(storageKey(normalizedAuthId));
      return;
    }
    window.localStorage.setItem(
      storageKey(normalizedAuthId),
      JSON.stringify({
        pendingByRoomId: normalizedPendingByRoomId,
      }),
    );
  },
};
