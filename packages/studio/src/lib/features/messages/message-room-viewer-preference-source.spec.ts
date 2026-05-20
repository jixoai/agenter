import { describe, expect, test } from "vitest";

import type { AuthKvEntry, AuthKvSetOutput } from "@agenter/client-sdk";

import type {
  RoomViewerPreferenceBrowserStore,
  RoomViewerPreferencePendingMap,
} from "./message-room-viewer-preference-browser-store";
import {
  MessageRoomViewerPreferenceSource,
  type RoomViewerPreferenceStoreClient,
} from "./message-room-viewer-preference-source";

const VIEWER_KEY = "studio/messages/room-viewer-by-room";

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

const createStoreStub = (initialByRoomId: Record<string, string> = {}): RoomViewerPreferenceStoreClient => {
  const normalizedInitialByRoomId = Object.fromEntries(
    Object.entries(initialByRoomId).sort(([left], [right]) => left.localeCompare(right)),
  );
  let entry: AuthKvEntry | null =
    Object.keys(normalizedInitialByRoomId).length > 0
      ? {
          key: VIEWER_KEY,
          value: {
            byRoomId: normalizedInitialByRoomId,
          },
          version: 1,
          updatedAt: 1,
        }
      : null;
  let lastEventId = entry ? 1 : 0;
  let eventListener:
    | ((event: {
        eventId: number;
        timestamp: number;
        kind: "set" | "delete";
        entry?: AuthKvEntry;
        key?: string;
        version?: number;
      }) => void)
    | null = null;

  const notify = (): void => {
    if (!eventListener) {
      return;
    }
    if (entry) {
      eventListener({
        eventId: lastEventId,
        timestamp: entry.updatedAt,
        kind: "set",
        entry,
      });
      return;
    }
    eventListener({
      eventId: lastEventId,
      timestamp: lastEventId,
      kind: "delete",
      key: VIEWER_KEY,
      version: lastEventId,
    });
  };

  return {
    async snapshotAuthKv() {
      return {
        lastEventId,
        items: entry ? [entry] : [],
      };
    },
    async setAuthKv(input) {
      if (
        entry &&
        input.baseVersion !== null &&
        input.baseVersion !== undefined &&
        input.baseVersion !== entry.version
      ) {
        return {
          ok: false,
          reason: "conflict",
          latest: entry,
        };
      }
      lastEventId += 1;
      entry = {
        key: input.key,
        value: input.value,
        version: entry ? entry.version + 1 : 1,
        updatedAt: lastEventId,
      };
      notify();
      return {
        ok: true,
        changed: true,
        eventId: lastEventId,
        entry,
      };
    },
    async deleteAuthKv(input) {
      if (!entry) {
        return {
          ok: true,
          removed: false,
          eventId: null,
          key: input.key,
          version: null,
        };
      }
      if (input.baseVersion !== undefined && input.baseVersion !== entry.version) {
        return {
          ok: false,
          reason: "conflict",
          latest: entry,
        };
      }
      lastEventId += 1;
      const removedVersion = entry.version + 1;
      entry = null;
      notify();
      return {
        ok: true,
        removed: true,
        eventId: lastEventId,
        key: VIEWER_KEY,
        version: removedVersion,
      };
    },
    subscribeAuthKvEvents(_input, handlers) {
      eventListener = (event) => {
        if (event.kind === "set" && event.entry) {
          handlers.onData({
            eventId: event.eventId,
            timestamp: event.timestamp,
            kind: "set",
            entry: event.entry,
          });
          return;
        }
        handlers.onData({
          eventId: event.eventId,
          timestamp: event.timestamp,
          kind: "delete",
          key: event.key ?? VIEWER_KEY,
          version: event.version ?? 0,
        });
      };
      return {
        unsubscribe: () => {
          eventListener = null;
        },
      };
    },
  } satisfies RoomViewerPreferenceStoreClient;
};

const createBrowserStoreStub = (): {
  browserStore: RoomViewerPreferenceBrowserStore;
  readPending(authId: string): RoomViewerPreferencePendingMap;
} => {
  const pendingByAuthId = new Map<string, RoomViewerPreferencePendingMap>();
  return {
    browserStore: {
      read(authId) {
        if (!authId?.trim()) {
          return {};
        }
        return {
          ...(pendingByAuthId.get(authId) ?? {}),
        };
      },
      write(authId, pendingByRoomId) {
        if (!authId?.trim()) {
          return;
        }
        if (Object.keys(pendingByRoomId).length === 0) {
          pendingByAuthId.delete(authId);
          return;
        }
        pendingByAuthId.set(authId, {
          ...pendingByRoomId,
        });
      },
    },
    readPending(authId) {
      return {
        ...(pendingByAuthId.get(authId) ?? {}),
      };
    },
  };
};

describe("Feature: Message room viewer preference source", () => {
  test("Scenario: Given actor-private room viewer selections When hydrating Then the source restores the per-room viewer map from auth-scoped KV", async () => {
    const source = new MessageRoomViewerPreferenceSource();
    const store = createStoreStub({
      "room-alpha": "auth:gaubee",
      "room-beta": "session:reviewer",
    });

    const snapshot = await source.hydrate(store);

    expect(snapshot).toEqual({
      byRoomId: {
        "room-alpha": "auth:gaubee",
        "room-beta": "session:reviewer",
      },
      version: 1,
      lastEventId: 1,
    });
  });

  test("Scenario: Given another client is listening When a room viewer changes Then the subscriber receives the synced viewer projection", async () => {
    const source = new MessageRoomViewerPreferenceSource();
    const store = createStoreStub({
      "room-alpha": "auth:default",
    });
    const seen: Array<Record<string, string>> = [];

    await source.hydrate(store);
    const unsubscribe = source.subscribe(store, (snapshot) => {
      seen.push(snapshot.byRoomId);
    });

    const snapshot = await source.setRoomViewerActorId(store, "room-alpha", "auth:gaubee");

    expect(snapshot.byRoomId).toEqual({
      "room-alpha": "auth:gaubee",
    });
    expect(seen.at(-1)).toEqual({
      "room-alpha": "auth:gaubee",
    });
    unsubscribe();
  });

  test("Scenario: Given the final room viewer selection is removed When the source clears that room Then the auth-scoped KV key is deleted", async () => {
    const source = new MessageRoomViewerPreferenceSource();
    const store = createStoreStub({
      "room-alpha": "auth:gaubee",
    });

    await source.hydrate(store);
    const snapshot = await source.setRoomViewerActorId(store, "room-alpha", null);

    expect(snapshot).toEqual({
      byRoomId: {},
      version: null,
      lastEventId: 2,
    });
  });

  test("Scenario: Given a viewer change is written locally before auth-kv acknowledges it When the page refreshes Then the next source instance restores that pending room viewer from browser-local WAL", async () => {
    const { browserStore, readPending } = createBrowserStoreStub();
    const deferredSet = createDeferred<AuthKvSetOutput>();
    const source = new MessageRoomViewerPreferenceSource(browserStore);
    const refreshedSource = new MessageRoomViewerPreferenceSource(browserStore);
    let entry: AuthKvEntry | null = null;

    const store: RoomViewerPreferenceStoreClient = {
      async snapshotAuthKv() {
        return {
          lastEventId: entry ? 1 : 0,
          items: entry ? [entry] : [],
        };
      },
      async setAuthKv(input) {
        return await deferredSet.promise.then((result) => {
          if (result.ok) {
            entry = result.entry;
          }
          return result;
        });
      },
      async deleteAuthKv() {
        throw new Error("delete not expected");
      },
      subscribeAuthKvEvents() {
        return {
          unsubscribe: () => undefined,
        };
      },
    };

    await source.hydrate(store, "kzf");
    const commitPromise = source.setRoomViewerActorId(store, "room-alpha", "auth:gaubee");

    expect(source.snapshot.byRoomId).toEqual({
      "room-alpha": "auth:gaubee",
    });
    expect(readPending("kzf")).toEqual({
      "room-alpha": "auth:gaubee",
    });

    const refreshedSnapshot = await refreshedSource.hydrate(createStoreStub(), "kzf");
    expect(refreshedSnapshot.byRoomId).toEqual({
      "room-alpha": "auth:gaubee",
    });

    deferredSet.resolve({
      ok: true,
      changed: true,
      eventId: 1,
      entry: {
        key: VIEWER_KEY,
        value: {
          byRoomId: {
            "room-alpha": "auth:gaubee",
          },
        },
        version: 1,
        updatedAt: 1,
      },
    });
    await commitPromise;
    expect(readPending("kzf")).toEqual({});
  });

  test("Scenario: Given browser-local pending viewer WAL exists after a refresh When the source flushes pending changes Then auth-kv catches up and the WAL is cleared", async () => {
    const { browserStore, readPending } = createBrowserStoreStub();
    const store = createStoreStub();
    const source = new MessageRoomViewerPreferenceSource(browserStore);

    browserStore.write("kzf", {
      "room-alpha": "auth:gaubee",
    });

    const hydrated = await source.hydrate(store, "kzf");
    expect(hydrated.byRoomId).toEqual({
      "room-alpha": "auth:gaubee",
    });

    const flushed = await source.flushPending(store);
    expect(flushed.byRoomId).toEqual({
      "room-alpha": "auth:gaubee",
    });
    expect(flushed.version).toBe(1);
    expect(readPending("kzf")).toEqual({});
  });
});
