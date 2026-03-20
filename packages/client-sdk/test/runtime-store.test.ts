import { describe, expect, test } from "bun:test";

import { RuntimeStore } from "../src/runtime-store";
import type { AgenterClient, AgenterTransportEvent } from "../src/trpc-client";
import type { RuntimeSnapshot } from "../src/types";

const createSnapshot = (eventId: number): RuntimeSnapshot => ({
  version: 1,
  timestamp: Date.now(),
  lastEventId: eventId,
  sessions: [
    {
      id: "i-1",
      name: "workspace",
      cwd: process.cwd(),
      avatar: "tester-bot",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "running",
      storageState: "active",
      sessionRoot: "/tmp/sessions/i-1",
      storeTarget: "global",
    },
  ],
  runtimes: {
    "i-1": {
      sessionId: "i-1",
      started: true,
      activityState: "idle",
      loopPhase: "waiting_commits",
      stage: "idle",
      focusedTerminalId: "main",
      focusedTerminalIds: ["main"],
      chatMessages: [],
      terminalSnapshots: {
        main: {
          seq: 0,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: Array.from({ length: 24 }, () => ""),
          cursor: { x: 0, y: 0 },
        },
      },
      tasks: [],
      loopKernelState: null,
      loopInputSignals: {
        user: { version: 0, timestamp: null },
        terminal: { version: 0, timestamp: null },
        task: { version: 0, timestamp: null },
        attention: { version: 0, timestamp: null },
      },
      apiCallRecording: {
        enabled: false,
        refCount: 0,
      },
      terminals: [
        {
          terminalId: "main",
          running: true,
          status: "IDLE",
          seq: 0,
          cwd: process.cwd(),
        },
      ],
      modelCapabilities: {
        streaming: true,
        tools: true,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      },
      activeCycle: null,
    },
  },
});

const createMockClient = (input: {
  snapshotQuery: () => Promise<RuntimeSnapshot>;
  onSubscribe?: (handlers: { onData?: (event: unknown) => void; onError?: () => void }) => void;
  onTransportSubscribe?: (listener: (event: AgenterTransportEvent) => void) => void;
  onClose?: () => void;
  apiCallsSubscribe?: (
    payload: { sessionId: string; afterId: number },
    handlers: { onData?: (payload: unknown) => void; onError?: () => void },
  ) => { unsubscribe: () => void };
  createSessionResult?: RuntimeSnapshot["sessions"][number];
  workspaceRecentQuery?: () => Promise<{ items: string[] }>;
  workspaceListAllQuery?: () => Promise<{
    items: Array<{
      path: string;
      favorite: boolean;
      group: string;
      missing: boolean;
      counts: { all: number; running: number; stopped: number; archive: number };
      lastSessionActivityAt?: string;
    }>;
  }>;
  workspaceCleanMissingMutate?: () => Promise<{ removed: string[] }>;
  notificationSnapshotQuery?: () => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      workspacePath: string;
      sessionName: string;
      messageId: string;
      messageSeq: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
  }>;
  setChatVisibilityMutate?: (input: { sessionId: string; visible: boolean; focused: boolean }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      workspacePath: string;
      sessionName: string;
      messageId: string;
      messageSeq: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
  }>;
  consumeNotificationsMutate?: (input: { sessionId: string; upToMessageId?: string }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      workspacePath: string;
      sessionName: string;
      messageId: string;
      messageSeq: number;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
  }>;
  listSettingsLayersQuery?: (input: { workspacePath: string }) => Promise<{
    effective: { content: string };
    layers: Array<{
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    }>;
  }>;
  readSettingsLayerQuery?: (input: { workspacePath: string; layerId: string }) => Promise<{
    layer: {
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    };
    path: string;
    content: string;
    mtimeMs: number;
  }>;
  saveSettingsLayerMutate?: (input: {
    workspacePath: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }) => Promise<
    | {
        ok: true;
        file: { path: string; content: string; mtimeMs: number };
        effective: { content: string };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: { path: string; content: string; mtimeMs: number };
      }
    | { ok: false; reason: "readonly"; message: string }
  >;
  chatSendMutate?: (input: {
    sessionId: string;
    text: string;
    assetIds: string[];
    clientMessageId: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  chatListQuery?: (input: { sessionId: string; afterId?: number; limit?: number }) => Promise<{ items: unknown[] }>;
  chatCyclesQuery?: (input: { sessionId: string; limit?: number }) => Promise<{ items: unknown[] }>;
}): AgenterClient => {
  return {
    trpc: {
      runtime: {
        snapshot: {
          query: input.snapshotQuery,
        },
        events: {
          subscribe: (_payload: unknown, handlers: { onData?: (event: unknown) => void; onError?: () => void }) => {
            input.onSubscribe?.({
              onData: handlers.onData,
              onError: handlers.onError,
            });
            return {
              unsubscribe: () => {},
            };
          },
        },
        loopbusStateLogs: {
          query: async () => ({ items: [] }),
        },
        loopbusStateLogsBefore: {
          query: async () => ({ items: [] }),
        },
        loopbusTraces: {
          query: async () => ({ items: [] }),
        },
        loopbusTracesBefore: {
          query: async () => ({ items: [] }),
        },
        modelCallsPage: {
          query: async () => ({ items: [] }),
        },
        modelDebug: {
          query: async () => ({
            config: null,
            history: [],
            stats: null,
            latestModelCall: null,
            recentModelCalls: [],
            recentApiCalls: [],
          }),
        },
        apiCallsPage: {
          query: async () => ({ items: [] }),
        },
        apiCalls: {
          subscribe: (
            payload: { sessionId: string; afterId: number },
            handlers: { onData?: (payload: unknown) => void; onError?: () => void },
          ) =>
            input.apiCallsSubscribe
              ? input.apiCallsSubscribe(payload, handlers)
              : {
                  unsubscribe: () => {},
                },
        },
      },
      session: {
        create: {
          mutate: async () => ({
            session: input.createSessionResult ?? createSnapshot(0).sessions[0],
          }),
        },
        start: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        stop: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        archive: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        restore: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        delete: { mutate: async () => ({}) },
      },
      chat: {
        send: {
          mutate: async (payload: { sessionId: string; text: string; assetIds: string[]; clientMessageId: string }) =>
            input.chatSendMutate ? await input.chatSendMutate(payload) : { ok: true },
        },
        list: {
          query: async (payload: { sessionId: string; afterId?: number; limit?: number }) =>
            input.chatListQuery ? await input.chatListQuery(payload) : { items: [] },
        },
        listBefore: { query: async () => ({ items: [] }) },
        cycles: {
          query: async (payload: { sessionId: string; limit?: number }) =>
            input.chatCyclesQuery ? await input.chatCyclesQuery(payload) : { items: [] },
        },
        cyclesBefore: { query: async () => ({ items: [] }) },
      },
      draft: {
        resolve: {
          query: async () => ({
            cwd: process.cwd(),
            provider: { providerId: "default", apiStandard: "openai-responses", vendor: "openai", model: "test" },
            modelCapabilities: {
              streaming: true,
              tools: true,
              imageInput: false,
              nativeCompact: true,
              summarizeFallback: true,
              fileUpload: false,
              mcpCatalog: false,
            },
          }),
        },
      },
      settings: {
        read: {
          query: async () => ({
            path: "settings.json",
            content: "{}",
            mtimeMs: Date.now(),
          }),
        },
        save: {
          mutate: async () => ({
            ok: true as const,
            file: {
              path: "settings.json",
              content: "{}",
              mtimeMs: Date.now(),
            },
          }),
        },
        layers: {
          list: {
            query: async (payload: { workspacePath: string }) =>
              input.listSettingsLayersQuery
                ? await input.listSettingsLayersQuery(payload)
                : {
                    effective: { content: "{}" },
                    layers: [],
                  },
          },
          read: {
            query: async (payload: { workspacePath: string; layerId: string }) =>
              input.readSettingsLayerQuery
                ? await input.readSettingsLayerQuery(payload)
                : {
                    layer: {
                      layerId: payload.layerId,
                      sourceId: "project",
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      exists: true,
                      editable: true,
                    },
                    path: `${payload.workspacePath}/.agenter/settings.json`,
                    content: "{}",
                    mtimeMs: Date.now(),
                  },
          },
          save: {
            mutate: async (payload: {
              workspacePath: string;
              layerId: string;
              content: string;
              baseMtimeMs: number;
            }) =>
              input.saveSettingsLayerMutate
                ? await input.saveSettingsLayerMutate(payload)
                : {
                    ok: true as const,
                    file: {
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      content: payload.content,
                      mtimeMs: payload.baseMtimeMs + 1,
                    },
                    effective: {
                      content: payload.content,
                    },
                  },
          },
        },
      },
      notification: {
        snapshot: {
          query: async () =>
            input.notificationSnapshotQuery
              ? await input.notificationSnapshotQuery()
              : { items: [], unreadBySession: {} },
        },
        setChatVisibility: {
          mutate: async (payload: { sessionId: string; visible: boolean; focused: boolean }) =>
            input.setChatVisibilityMutate
              ? await input.setChatVisibilityMutate(payload)
              : { items: [], unreadBySession: {} },
        },
        consume: {
          mutate: async (payload: { sessionId: string; upToMessageId?: string }) =>
            input.consumeNotificationsMutate
              ? await input.consumeNotificationsMutate(payload)
              : { items: [], unreadBySession: {} },
        },
      },
      task: {
        list: { query: async () => ({ ok: true, tasks: [] }) },
        triggerManual: { mutate: async () => ({ ok: true }) },
        emitEvent: { mutate: async () => ({ ok: true }) },
      },
      workspace: {
        recent: {
          query: async () => (input.workspaceRecentQuery ? input.workspaceRecentQuery() : { items: [process.cwd()] }),
        },
        listAll: { query: async () => (input.workspaceListAllQuery ? input.workspaceListAllQuery() : { items: [] }) },
        listSessions: {
          query: async () => ({ items: [], nextCursor: null, counts: { all: 0, running: 0, stopped: 0, archive: 0 } }),
        },
        searchPaths: {
          query: async () => ({ items: [] }),
        },
        toggleFavorite: { mutate: async () => ({ item: null }) },
        toggleSessionFavorite: { mutate: async () => ({ sessionId: "i-1", favorite: true }) },
        delete: { mutate: async () => ({ removed: true }) },
        cleanMissing: {
          mutate: async () =>
            input.workspaceCleanMissingMutate ? input.workspaceCleanMissingMutate() : { removed: [] },
        },
      },
      fs: {
        listDirectories: { query: async () => ({ items: [] }) },
        validateDirectory: { query: async () => ({ ok: true, path: process.cwd() }) },
      },
    } as unknown as AgenterClient["trpc"],
    wsUrl: "ws://127.0.0.1:3000/trpc",
    httpUrl: "http://127.0.0.1:3000",
    subscribeTransport: (listener: (event: AgenterTransportEvent) => void) => {
      input.onTransportSubscribe?.(listener);
      return () => {};
    },
    close: () => {
      input.onClose?.();
    },
  };
};

const waitFor = async (predicate: () => boolean, timeoutMs = 4_000): Promise<void> => {
  const startAt = Date.now();
  while (Date.now() - startAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timeout waiting for condition");
};

const withBrowserOnlineState = async (
  initialOnline: boolean,
  callback: (controls: { setOnline: (online: boolean) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const navigatorValue = { onLine: initialOnline };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });

  try {
    await callback({
      setOnline: (online: boolean) => {
        navigatorValue.onLine = online;
        eventTarget.dispatchEvent(new Event(online ? "online" : "offline"));
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

const withAnimationFrameWindow = async (
  callback: (controls: { flushFrame: (time?: number) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const handle = nextHandle++;
        frameCallbacks.set(handle, callback);
        return handle;
      },
      cancelAnimationFrame: (handle: number) => {
        frameCallbacks.delete(handle);
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });

  try {
    await callback({
      flushFrame: (time = 0) => {
        const callbacks = [...frameCallbacks.values()];
        frameCallbacks.clear();
        for (const callback of callbacks) {
          callback(time);
        }
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

describe("Feature: runtime store synchronization", () => {
  test("Scenario: Given browser-frame batching When hot runtime events burst before the next frame Then listeners observe one coalesced publication", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });

    await withAnimationFrameWindow(async ({ flushFrame }) => {
      const store = new RuntimeStore(client);
      let publishCount = 0;
      store.subscribe(() => {
        publishCount += 1;
      });

      await store.connect();
      expect(publishCount).toBe(0);

      flushFrame();
      expect(publishCount).toBe(1);

      onData?.({
        version: 1,
        eventId: 11,
        timestamp: Date.now(),
        type: "runtime.phase",
        sessionId: "i-1",
        payload: { phase: "collecting_inputs" },
      });
      onData?.({
        version: 1,
        eventId: 12,
        timestamp: Date.now(),
        type: "runtime.loopbus.trace",
        sessionId: "i-1",
        payload: {
          entry: {
            id: 12,
            cycleId: 1,
            seq: 1,
            step: "collect_inputs",
            status: "ok",
            startedAt: Date.now(),
            endedAt: Date.now(),
            detail: { inputs: 2 },
          },
        },
      });

      expect(publishCount).toBe(1);

      flushFrame();
      expect(publishCount).toBe(2);
      expect(store.getState().runtimes["i-1"]?.loopPhase).toBe("collecting_inputs");
      expect(store.getState().loopbusTracesBySession["i-1"]?.length).toBe(1);

      store.disconnect();
    });
  });

  test("Scenario: Given subscription events When applying updates Then state stays ordered and deduped", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let onError: (() => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
        onError = handlers.onError;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().connected).toBe(true);
    expect(store.getState().lastEventId).toBe(10);
    expect(store.getState().recentWorkspaces).toHaveLength(1);
    expect(store.getState().activityBySession["i-1"]).toBe("idle");
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.seq).toBe(0);

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "m-1",
          role: "assistant",
          content: "hello",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 9,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "ignored",
          role: "assistant",
          content: "ignored",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 12,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "calling_model" },
    });
    expect(store.getState().runtimes["i-1"]?.loopPhase).toBe("calling_model");
    expect(store.getState().activityBySession["i-1"]).toBe("active");

    onData?.({
      version: 1,
      eventId: 13,
      timestamp: Date.now(),
      type: "terminal.snapshot",
      sessionId: "i-1",
      payload: {
        terminalId: "main",
        snapshot: {
          seq: 2,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: ["hello"],
          cursor: { x: 5, y: 0 },
        },
      },
    });
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.lines[0]).toBe("hello");

    onData?.({
      version: 1,
      eventId: 14,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "waiting_commits" },
    });
    expect(store.getState().activityBySession["i-1"]).toBe("idle");

    onError?.();
    expect(store.getState().connected).toBe(false);
    expect(store.getState().connectionStatus).toBe("reconnecting");
    store.disconnect();
  });

  test("Scenario: Given first snapshot request fails When reconnecting Then store recovers automatically", async () => {
    let callCount = 0;
    const client = createMockClient({
      snapshotQuery: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("network-error");
        }
        return createSnapshot(20);
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => store.getState().connected);
    expect(store.getState().lastEventId).toBe(20);
    expect(store.getState().connectionStatus).toBe("connected");
    store.disconnect();
  });

  test("Scenario: Given browser goes offline When runtime store is connected Then connectionStatus becomes offline immediately", async () => {
    await withBrowserOnlineState(true, async ({ setOnline }) => {
      const client = createMockClient({
        snapshotQuery: async () => createSnapshot(25),
      });
      const store = new RuntimeStore(client);

      await store.connect();
      expect(store.getState().connectionStatus).toBe("connected");

      setOnline(false);

      expect(store.getState().connected).toBe(false);
      expect(store.getState().connectionStatus).toBe("offline");
      store.disconnect();
    });
  });

  test("Scenario: Given retained API-call streams When reconnect succeeds Then the runtime restores them from the saved cursor without duplicates", async () => {
    let transportListener: ((event: AgenterTransportEvent) => void) | undefined;
    const apiCallSubscriptions: Array<{ sessionId: string; afterId: number }> = [];
    const apiCallHandlers: Array<{ onData?: (payload: unknown) => void; onError?: () => void }> = [];
    let snapshotCallCount = 0;

    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCallCount += 1;
        return createSnapshot(snapshotCallCount === 1 ? 30 : 31);
      },
      onTransportSubscribe: (listener) => {
        transportListener = listener;
      },
      apiCallsSubscribe: (
        payload: { sessionId: string; afterId: number },
        handlers: { onData?: (payload: unknown) => void; onError?: () => void },
      ) => {
        apiCallSubscriptions.push(payload);
        apiCallHandlers.push(handlers);
        return {
          unsubscribe: () => {},
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const release = store.retainApiCallStream("i-1");
    expect(apiCallSubscriptions).toEqual([{ sessionId: "i-1", afterId: 0 }]);

    apiCallHandlers[0]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5]);

    transportListener?.({ type: "close" });
    expect(store.getState().connectionStatus).toBe("reconnecting");

    transportListener?.({ type: "open" });

    await waitFor(() => apiCallSubscriptions.length === 2);
    expect(apiCallSubscriptions[1]).toEqual({ sessionId: "i-1", afterId: 5 });
    await waitFor(() => store.getState().connectionStatus === "connected");

    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 6,
        modelCallId: 2,
        createdAt: Date.now(),
        request: { prompt: "next" },
        response: { output: "reply" },
      },
    });

    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5, 6]);
    release();
    store.disconnect();
  });

  test("Scenario: Given createSession call succeeds When events have not arrived yet Then local state is updated optimistically", async () => {
    const nowIso = new Date().toISOString();
    const newSession = {
      id: "i-2",
      name: "workspace-2",
      cwd: process.cwd(),
      avatar: "tester-bot",
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "running" as const,
      storageState: "active" as const,
      sessionRoot: "/tmp/sessions/i-2",
      storeTarget: "global" as const,
    };
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...createSnapshot(30),
        sessions: [],
        runtimes: {},
      }),
      createSessionResult: newSession,
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().sessions).toHaveLength(0);

    const created = await store.createSession({ cwd: process.cwd(), autoStart: true });
    expect(created.id).toBe("i-2");
    expect(store.getState().sessions.some((session) => session.id === "i-2")).toBe(true);
    expect(store.getState().runtimes["i-2"]).toBeDefined();
    expect(store.getState().chatsBySession["i-2"]).toEqual([]);

    store.disconnect();
  });

  test("Scenario: Given high-volume loopbus traces When streaming updates Then memory keeps only LRU 100 items", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(40),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    for (let index = 0; index < 160; index += 1) {
      const eventId = 41 + index;
      onData?.({
        version: 1,
        eventId,
        timestamp: Date.now(),
        type: "runtime.loopbus.trace",
        sessionId: "i-1",
        payload: {
          entry: {
            id: eventId,
            timestamp: Date.now(),
            cycleId: index + 1,
            seq: 1,
            step: "call_model",
            status: "ok",
            startedAt: Date.now(),
            endedAt: Date.now(),
            detail: { inputs: 1 },
          },
        },
      });
    }

    const traces = store.getState().loopbusTracesBySession["i-1"] ?? [];
    expect(traces.length).toBe(100);
    expect(traces[0]?.id).toBe(101);
    expect(traces.at(-1)?.id).toBe(200);
    store.disconnect();
  });

  test("Scenario: Given one model call id emits running then done When runtime events arrive Then the store merges lifecycle updates into one record", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(300),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "running",
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "done",
          completedAt: 150,
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
          response: { assistant: { text: "hi" } },
        },
      },
    });

    expect(store.getState().modelCallsBySession["i-1"]).toEqual([
      {
        id: 11,
        cycleId: 4,
        createdAt: 100,
        status: "done",
        completedAt: 150,
        provider: "deepseek/openai-chat",
        model: "deepseek-chat",
        request: { messages: [{ role: "user", content: "hello" }] },
        response: { assistant: { text: "hi" } },
      },
    ]);

    store.disconnect();
  });

  test("Scenario: Given missing workspaces When cleaning them Then store refreshes workspace state", async () => {
    let recentCalls = 0;
    let listAllCalls = 0;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(500),
      workspaceRecentQuery: async () => {
        recentCalls += 1;
        return { items: ["/repo/kept"] };
      },
      workspaceListAllQuery: async () => {
        listAllCalls += 1;
        return {
          items: [
            {
              path: "/repo/kept",
              favorite: false,
              group: "Other",
              missing: false,
              counts: { all: 0, running: 0, stopped: 0, archive: 0 },
            },
          ],
        };
      },
      workspaceCleanMissingMutate: async () => ({ removed: ["/repo/missing"] }),
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const removed = await store.cleanMissingWorkspaces();

    expect(removed).toEqual(["/repo/missing"]);
    expect(store.getState().recentWorkspaces).toEqual(["/repo/kept"]);
    expect(store.getState().workspaces[0]?.path).toBe("/repo/kept");
    expect(recentCalls).toBe(2);
    expect(listAllCalls).toBe(2);
    store.disconnect();
  });

  test("Scenario: Given workspace-scoped settings When loading and saving layers Then store uses workspacePath instead of session state", async () => {
    const listCalls: Array<{ workspacePath: string }> = [];
    const readCalls: Array<{ workspacePath: string; layerId: string }> = [];
    const saveCalls: Array<{ workspacePath: string; layerId: string; content: string; baseMtimeMs: number }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      listSettingsLayersQuery: async (input) => {
        listCalls.push(input);
        return {
          effective: { content: '{"lang":"en"}' },
          layers: [
            {
              layerId: "1:project",
              sourceId: "project",
              path: `${input.workspacePath}/.agenter/settings.json`,
              exists: true,
              editable: true,
            },
          ],
        };
      },
      readSettingsLayerQuery: async (input) => {
        readCalls.push(input);
        return {
          layer: {
            layerId: input.layerId,
            sourceId: "project",
            path: `${input.workspacePath}/.agenter/settings.json`,
            exists: true,
            editable: true,
          },
          path: `${input.workspacePath}/.agenter/settings.json`,
          content: '{"lang":"en"}',
          mtimeMs: 7,
        };
      },
      saveSettingsLayerMutate: async (input) => {
        saveCalls.push(input);
        return {
          ok: true,
          file: {
            path: `${input.workspacePath}/.agenter/settings.json`,
            content: input.content,
            mtimeMs: input.baseMtimeMs + 1,
          },
          effective: {
            content: input.content,
          },
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const layers = await store.listSettingsLayers("/repo/demo");
    const file = await store.readSettingsLayer("/repo/demo", "1:project");
    const saved = await store.saveSettingsLayer({
      workspacePath: "/repo/demo",
      layerId: "1:project",
      content: '{"lang":"ja"}',
      baseMtimeMs: 7,
    });

    expect(layers.layers[0]?.layerId).toBe("1:project");
    expect(file.path).toBe("/repo/demo/.agenter/settings.json");
    expect(saved.ok).toBe(true);
    expect(listCalls).toEqual([{ workspacePath: "/repo/demo" }]);
    expect(readCalls).toEqual([{ workspacePath: "/repo/demo", layerId: "1:project" }]);
    expect(saveCalls).toEqual([
      {
        workspacePath: "/repo/demo",
        layerId: "1:project",
        content: '{"lang":"ja"}',
        baseMtimeMs: 7,
      },
    ]);
    store.disconnect();
  });

  test("Scenario: Given unread notifications When visibility and consume updates arrive Then store keeps unread state in sync", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(800),
      notificationSnapshotQuery: async () => ({
        items: [
          {
            id: "i-1:9",
            sessionId: "i-1",
            workspacePath: "/repo/demo",
            sessionName: "workspace",
            messageId: "9",
            messageSeq: 9,
            content: "hello",
            timestamp: Date.now(),
          },
        ],
        unreadBySession: { "i-1": 1 },
      }),
      setChatVisibilityMutate: async () => ({
        items: [
          {
            id: "i-1:9",
            sessionId: "i-1",
            workspacePath: "/repo/demo",
            sessionName: "workspace",
            messageId: "9",
            messageSeq: 9,
            content: "hello",
            timestamp: Date.now(),
          },
        ],
        unreadBySession: { "i-1": 1 },
      }),
      consumeNotificationsMutate: async () => ({
        items: [],
        unreadBySession: {},
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    expect(store.getState().notifications[0]?.messageId).toBe("9");

    await store.setChatVisibility({ sessionId: "i-1", visible: true, focused: true });
    expect(store.getState().unreadBySession["i-1"]).toBe(1);

    onData?.({
      version: 1,
      eventId: 801,
      timestamp: Date.now(),
      type: "notification.updated",
      sessionId: "i-1",
      payload: {
        snapshot: {
          items: [
            {
              id: "i-1:10",
              sessionId: "i-1",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              messageId: "10",
              messageSeq: 10,
              content: "new reply",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
        },
      },
    });
    expect(store.getState().notifications[0]?.messageId).toBe("10");

    await store.consumeNotifications({ sessionId: "i-1", upToMessageId: "10" });
    expect(store.getState().notifications).toEqual([]);
    expect(store.getState().unreadBySession["i-1"]).toBeUndefined();
    store.disconnect();
  });

  test("Scenario: Given long-history hydration and a later live reply When hydrating session history Then persisted rows merge with live rows without dropping unread continuity", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(900),
      chatListQuery: async () => ({
        items: [
          {
            id: 10,
            sessionId: "i-1",
            messageId: "assistant-1",
            role: "assistant",
            channel: "to_user",
            content: "persisted reply",
            timestamp: 10,
            cycleId: 1,
            format: "markdown",
            tool: null,
            attachments: [],
          },
          {
            id: 11,
            sessionId: "i-1",
            messageId: "user-2",
            role: "user",
            channel: "user_input",
            content: "persisted follow-up",
            timestamp: 20,
            cycleId: 2,
            format: "markdown",
            tool: null,
            attachments: [],
          },
        ],
      }),
      chatCyclesQuery: async () => ({
        items: [],
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 901,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "assistant-live",
          role: "assistant",
          channel: "to_user",
          content: "live reply",
          timestamp: 30,
          cycleId: 3,
        },
      },
    });

    await store.hydrateSessionHistory("i-1", { messageLimit: 200, cycleLimit: 120 });

    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual([
      "assistant-1",
      "user-2",
      "assistant-live",
    ]);
    store.disconnect();
  });

  test("Scenario: Given snapshot has session without runtime When runtime events arrive Then scaffold is created and loopbus state updates", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const snapshot = createSnapshot(300);
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...snapshot,
        runtimes: {},
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "collecting_inputs" },
    });
    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.loopbus.trace",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 302,
          cycleId: 1,
          seq: 1,
          step: "collect_inputs",
          status: "ok",
          startedAt: Date.now(),
          endedAt: Date.now(),
          detail: { inputs: 1 },
        },
      },
    });

    const runtime = store.getState().runtimes["i-1"];
    expect(runtime).toBeDefined();
    expect(runtime?.loopPhase).toBe("collecting_inputs");
    expect(store.getState().loopbusTracesBySession["i-1"]?.length).toBe(1);
    store.disconnect();
  });

  test("Scenario: Given optimistic chat send When a cycle update arrives Then the pending cycle is replaced by the persisted cycle", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(600),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    await store.sendChat("i-1", "hello cycle");
    const pending = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("pending");

    const clientMessageId = pending[0]?.clientMessageIds[0];
    if (!clientMessageId) {
      throw new Error("expected optimistic client message id");
    }

    onData?.({
      version: 1,
      eventId: 601,
      timestamp: Date.now(),
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      payload: {
        cycle: {
          id: "cycle:9",
          cycleId: 9,
          seq: 9,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: [clientMessageId],
          inputs: [
            {
              source: "message",
              role: "user",
              name: "User",
              parts: [{ type: "text", text: "hello cycle" }],
              meta: { clientMessageId },
            },
          ],
          outputs: [
            {
              id: "reply-1",
              role: "assistant",
              content: "done",
              timestamp: Date.now(),
              channel: "to_user",
            },
          ],
          liveMessages: [],
          streaming: null,
          modelCallId: 12,
        },
      },
    });

    const cycles = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.id).toBe("cycle:9");
    expect(cycles[0]?.outputs[0]?.content).toBe("done");
    store.disconnect();
  });

  test("Scenario: Given uploaded session assets When sending chat Then resolved asset urls and optimistic attachment parts stay aligned", async () => {
    const originalFetch = globalThis.fetch;
    const sentPayloads: Array<{ sessionId: string; text: string; assetIds: string[]; clientMessageId: string }> = [];
    globalThis.fetch = (async (input) => {
      expect(input).toBe("http://127.0.0.1:3000/api/sessions/i-1/assets");
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              assetId: "asset-1",
              kind: "file",
              mimeType: "text/plain",
              name: "notes.txt",
              sizeBytes: 5,
              url: "/media/sessions/i-1/assets/asset-1",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      chatSendMutate: async (payload) => {
        sentPayloads.push(payload);
        return { ok: true };
      },
    });
    const store = new RuntimeStore(client);

    try {
      await store.connect();
      const uploaded = await store.uploadSessionAssets("i-1", [
        new File(["hello"], "notes.txt", { type: "text/plain" }),
      ]);

      expect(uploaded).toEqual([
        {
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1",
        },
      ]);

      await store.sendChat("i-1", "review attachment", uploaded.map((item) => item.assetId), uploaded);

      expect(sentPayloads).toHaveLength(1);
      expect(sentPayloads[0]?.sessionId).toBe("i-1");
      expect(sentPayloads[0]?.text).toBe("review attachment");
      expect(sentPayloads[0]?.assetIds).toEqual(["asset-1"]);

      const pendingCycles = store.getState().chatCyclesBySession["i-1"] ?? [];
      expect(pendingCycles).toHaveLength(1);
      expect(pendingCycles[0]?.inputs[0]?.parts).toEqual([
        { type: "text", text: "review attachment" },
        {
          type: "file",
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      store.disconnect();
    }
  });
});
