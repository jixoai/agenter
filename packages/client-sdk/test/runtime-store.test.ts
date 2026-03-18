import { describe, expect, test } from "bun:test";

import { RuntimeStore } from "../src/runtime-store";
import type { AgenterClient } from "../src/trpc-client";
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
        imageInput: false,
      },
      activeCycle: null,
    },
  },
});

const createMockClient = (input: {
  snapshotQuery: () => Promise<RuntimeSnapshot>;
  onSubscribe?: (handlers: { onData?: (event: unknown) => void; onError?: () => void }) => void;
  onClose?: () => void;
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
          subscribe: (_payload: unknown, _handlers: unknown) => ({
            unsubscribe: () => {},
          }),
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
        send: { mutate: async () => ({ ok: true }) },
        list: { query: async () => ({ items: [] }) },
        listBefore: { query: async () => ({ items: [] }) },
        cycles: { query: async () => ({ items: [] }) },
        cyclesBefore: { query: async () => ({ items: [] }) },
      },
      draft: {
        resolve: {
          query: async () => ({
            cwd: process.cwd(),
            provider: { providerId: "default", kind: "openai-compatible", model: "test" },
            modelCapabilities: { imageInput: false },
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

describe("Feature: runtime store synchronization", () => {
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
});
