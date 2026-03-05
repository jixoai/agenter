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
      sessionRoot: "/tmp/sessions/i-1",
      storeTarget: "global",
    },
  ],
  runtimes: {
    "i-1": {
      sessionId: "i-1",
      started: true,
      activityState: "idle",
      loopPhase: "waiting_messages",
      stage: "idle",
      focusedTerminalId: "main",
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
      terminals: [
        {
          terminalId: "main",
          running: true,
          status: "IDLE",
          seq: 0,
          cwd: process.cwd(),
        },
      ],
    },
  },
});

const createMockClient = (input: {
  snapshotQuery: () => Promise<RuntimeSnapshot>;
  onSubscribe?: (handlers: { onData: (event: unknown) => void; onError: () => void }) => void;
  onClose?: () => void;
  createSessionResult?: RuntimeSnapshot["sessions"][number];
}): AgenterClient => {
  return {
    trpc: {
      runtime: {
        snapshot: {
          query: input.snapshotQuery,
        },
        events: {
          subscribe: (_payload, handlers) => {
            input.onSubscribe?.({
              onData: handlers.onData,
              onError: handlers.onError,
            });
            return {
              unsubscribe: () => {},
            };
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
        delete: { mutate: async () => ({}) },
      },
      chat: {
        send: { mutate: async () => ({ ok: true }) },
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
        recent: { query: async () => ({ items: [process.cwd()] }) },
      },
      fs: {
        listDirectories: { query: async () => ({ items: [] }) },
        validateDirectory: { query: async () => ({ ok: true, path: process.cwd() }) },
      },
    } as AgenterClient["trpc"],
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
      payload: { phase: "waiting_processor_response" },
    });
    expect(store.getState().runtimes["i-1"]?.loopPhase).toBe("waiting_processor_response");
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
      payload: { phase: "waiting_messages" },
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
});
