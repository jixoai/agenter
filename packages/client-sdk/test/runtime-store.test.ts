import { describe, expect, test } from "bun:test";

import type { RuntimeSnapshot } from "../src/types";
import { RuntimeStore } from "../src/runtime-store";
import type { AgenterClient } from "../src/trpc-client";

const createSnapshot = (eventId: number): RuntimeSnapshot => ({
  version: 1,
  timestamp: Date.now(),
  lastEventId: eventId,
  instances: [
    {
      id: "i-1",
      name: "workspace",
      cwd: process.cwd(),
      autoStart: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "running",
    },
  ],
  runtimes: {
    "i-1": {
      instanceId: "i-1",
      started: true,
      loopPhase: "waiting_messages",
      stage: "idle",
      focusedTerminalId: "main",
      chatMessages: [],
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
        create: { mutate: async () => ({}) },
        start: { mutate: async () => ({}) },
        stop: { mutate: async () => ({}) },
        delete: { mutate: async () => ({}) },
      },
      chat: {
        send: { mutate: async () => ({}) },
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

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "chat.message",
      instanceId: "i-1",
      payload: {
        message: {
          id: "m-1",
          role: "assistant",
          content: "hello",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsByInstance["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 9,
      timestamp: Date.now(),
      type: "chat.message",
      instanceId: "i-1",
      payload: {
        message: {
          id: "ignored",
          role: "assistant",
          content: "ignored",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsByInstance["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 12,
      timestamp: Date.now(),
      type: "runtime.phase",
      instanceId: "i-1",
      payload: { phase: "waiting_processor_response" },
    });
    expect(store.getState().runtimes["i-1"]?.loopPhase).toBe("waiting_processor_response");

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
});
