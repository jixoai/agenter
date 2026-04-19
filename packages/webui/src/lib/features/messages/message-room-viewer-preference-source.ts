import type {
  AuthKvDeleteOutput,
  AuthKvEntry,
  AuthKvEvent,
  AuthKvSetOutput,
  AuthKvSnapshotOutput,
} from "@agenter/client-sdk";

import {
  roomViewerPreferenceBrowserStore,
  type RoomViewerPreferenceBrowserStore,
  type RoomViewerPreferencePendingMap,
} from "./message-room-viewer-preference-browser-store";

const ROOM_VIEWER_PREFERENCES_KEY = "webui/messages/room-viewer-by-room";

export interface RoomViewerPreferenceSnapshot {
  byRoomId: Record<string, string>;
  version: number | null;
  lastEventId: number;
}

export interface RoomViewerPreferenceStoreClient {
  snapshotAuthKv(input: { keys?: string[]; prefix?: string }): Promise<AuthKvSnapshotOutput>;
  setAuthKv(input: { key: string; value: AuthKvEntry["value"]; baseVersion?: number | null }): Promise<AuthKvSetOutput>;
  deleteAuthKv(input: { key: string; baseVersion?: number | null }): Promise<AuthKvDeleteOutput>;
  subscribeAuthKvEvents(
    input:
      | {
          afterEventId?: number;
          keys?: string[];
          prefix?: string;
        }
      | undefined,
    handlers: {
      onData: (event: AuthKvEvent) => void;
      onError?: (error: unknown) => void;
    },
  ): { unsubscribe: () => void };
}

const normalizeRoomViewerSelections = (value: AuthKvEntry["value"] | undefined): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("byRoomId" in value)) {
    return {};
  }
  const byRoomId = value.byRoomId;
  if (!byRoomId || typeof byRoomId !== "object" || Array.isArray(byRoomId)) {
    return {};
  }
  return Object.entries(byRoomId)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, string>>((nextByRoomId, [roomId, actorId]) => {
      if (roomId.trim().length === 0 || typeof actorId !== "string" || actorId.trim().length === 0) {
        return nextByRoomId;
      }
      nextByRoomId[roomId] = actorId;
      return nextByRoomId;
    }, {});
};

const toSnapshot = (entry: AuthKvEntry | null | undefined, lastEventId: number): RoomViewerPreferenceSnapshot => ({
  byRoomId: normalizeRoomViewerSelections(entry?.value),
  version: entry?.version ?? null,
  lastEventId,
});

export class MessageRoomViewerPreferenceSource {
  #committedSnapshot: RoomViewerPreferenceSnapshot = {
    byRoomId: {},
    version: null,
    lastEventId: 0,
  };
  #pendingByRoomId: RoomViewerPreferencePendingMap = {};
  #authId: string | null = null;
  readonly #browserStore: RoomViewerPreferenceBrowserStore;

  constructor(browserStore: RoomViewerPreferenceBrowserStore = roomViewerPreferenceBrowserStore) {
    this.#browserStore = browserStore;
  }

  get snapshot(): RoomViewerPreferenceSnapshot {
    return {
      byRoomId: this.#resolveDesiredByRoomId(),
      version: this.#committedSnapshot.version,
      lastEventId: this.#committedSnapshot.lastEventId,
    };
  }

  async hydrate(
    runtimeStore: RoomViewerPreferenceStoreClient,
    authId?: string | null,
  ): Promise<RoomViewerPreferenceSnapshot> {
    this.#authId = authId?.trim() ? authId : null;
    this.#pendingByRoomId = this.#browserStore.read(this.#authId);
    try {
      const snapshot = await runtimeStore.snapshotAuthKv({
        keys: [ROOM_VIEWER_PREFERENCES_KEY],
      });
      const entry = snapshot.items[0] ?? null;
      this.#committedSnapshot = toSnapshot(entry, snapshot.lastEventId);
    } catch {
      this.#committedSnapshot = {
        byRoomId: {},
        version: null,
        lastEventId: 0,
      };
    }
    this.#reconcilePendingByRoomId();
    return this.snapshot;
  }

  subscribe(
    runtimeStore: RoomViewerPreferenceStoreClient,
    listener: (snapshot: RoomViewerPreferenceSnapshot) => void,
  ): () => void {
    const sub = runtimeStore.subscribeAuthKvEvents(
      {
        afterEventId: this.#committedSnapshot.lastEventId,
        keys: [ROOM_VIEWER_PREFERENCES_KEY],
      },
      {
        onData: (event) => {
          if (event.kind === "set") {
            this.#committedSnapshot = toSnapshot(event.entry, event.eventId);
          } else {
            this.#committedSnapshot = {
              byRoomId: {},
              version: null,
              lastEventId: event.eventId,
            };
          }
          this.#reconcilePendingByRoomId();
          listener(this.snapshot);
        },
      },
    );
    return () => {
      sub.unsubscribe();
    };
  }

  async flushPending(runtimeStore: RoomViewerPreferenceStoreClient): Promise<RoomViewerPreferenceSnapshot> {
    if (Object.keys(this.#pendingByRoomId).length === 0) {
      return this.snapshot;
    }
    return await this.#commit(runtimeStore);
  }

  async setRoomViewerActorId(
    runtimeStore: RoomViewerPreferenceStoreClient,
    chatId: string,
    actorId: string | null,
  ): Promise<RoomViewerPreferenceSnapshot> {
    this.#stagePendingViewer(chatId, actorId);
    return await this.#commit(runtimeStore);
  }

  #resolveDesiredByRoomId(): Record<string, string> {
    const nextByRoomId = {
      ...this.#committedSnapshot.byRoomId,
    };
    for (const [roomId, actorId] of Object.entries(this.#pendingByRoomId)) {
      if (actorId === null) {
        delete nextByRoomId[roomId];
        continue;
      }
      nextByRoomId[roomId] = actorId;
    }
    return Object.fromEntries(Object.entries(nextByRoomId).sort(([left], [right]) => left.localeCompare(right)));
  }

  #stagePendingViewer(chatId: string, actorId: string | null): void {
    const normalizedChatId = chatId.trim();
    if (normalizedChatId.length === 0) {
      return;
    }
    const normalizedActorId = actorId?.trim() ? actorId.trim() : null;
    const committedActorId = this.#committedSnapshot.byRoomId[normalizedChatId] ?? null;
    const nextPendingByRoomId = {
      ...this.#pendingByRoomId,
    };
    if (normalizedActorId === committedActorId) {
      delete nextPendingByRoomId[normalizedChatId];
    } else {
      nextPendingByRoomId[normalizedChatId] = normalizedActorId;
    }
    this.#pendingByRoomId = nextPendingByRoomId;
    this.#browserStore.write(this.#authId, this.#pendingByRoomId);
  }

  #reconcilePendingByRoomId(): void {
    const nextPendingByRoomId = {
      ...this.#pendingByRoomId,
    };
    let changed = false;
    for (const [roomId, actorId] of Object.entries(nextPendingByRoomId)) {
      const committedActorId = this.#committedSnapshot.byRoomId[roomId] ?? null;
      if (actorId === committedActorId || (actorId === null && committedActorId === null)) {
        delete nextPendingByRoomId[roomId];
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    this.#pendingByRoomId = nextPendingByRoomId;
    this.#browserStore.write(this.#authId, this.#pendingByRoomId);
  }

  async #commit(runtimeStore: RoomViewerPreferenceStoreClient): Promise<RoomViewerPreferenceSnapshot> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const currentByRoomId = this.#committedSnapshot.byRoomId;
      const nextByRoomId = this.#resolveDesiredByRoomId();
      if (JSON.stringify(nextByRoomId) === JSON.stringify(currentByRoomId)) {
        this.#reconcilePendingByRoomId();
        return this.snapshot;
      }
      if (Object.keys(nextByRoomId).length === 0) {
        const result = await runtimeStore.deleteAuthKv({
          key: ROOM_VIEWER_PREFERENCES_KEY,
          baseVersion: this.#committedSnapshot.version ?? undefined,
        });
        if (result.ok) {
          this.#committedSnapshot = {
            byRoomId: {},
            version: null,
            lastEventId: result.eventId ?? this.#committedSnapshot.lastEventId,
          };
          this.#reconcilePendingByRoomId();
          return this.snapshot;
        }
        this.#committedSnapshot = toSnapshot(result.latest, this.#committedSnapshot.lastEventId);
        this.#reconcilePendingByRoomId();
        continue;
      }

      const result = await runtimeStore.setAuthKv({
        key: ROOM_VIEWER_PREFERENCES_KEY,
        value: {
          byRoomId: nextByRoomId,
        },
        baseVersion: this.#committedSnapshot.version ?? null,
      });
      if (result.ok) {
        this.#committedSnapshot = toSnapshot(result.entry, result.eventId ?? this.#committedSnapshot.lastEventId);
        this.#reconcilePendingByRoomId();
        return this.snapshot;
      }
      this.#committedSnapshot = toSnapshot(result.latest, this.#committedSnapshot.lastEventId);
      this.#reconcilePendingByRoomId();
    }
    return this.snapshot;
  }
}
