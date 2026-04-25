import { afterEach, describe, expect, test } from "bun:test";

import { createAgenterClient } from "../src/trpc-client";

type Listener = EventListenerOrEventListenerObject;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string | URL;
  readonly sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string | URL) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.readyState !== FakeWebSocket.CONNECTING) {
        return;
      }
      this.readyState = FakeWebSocket.OPEN;
      this.dispatch("open", new Event("open"));
    }, 0);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", new CloseEvent("close"));
  }

  private dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") {
        listener(event);
        continue;
      }
      listener.handleEvent(event);
    }
  }
}

const originalWebSocket = globalThis.WebSocket;

const installFakeWebSocket = (): void => {
  FakeWebSocket.instances = [];
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: FakeWebSocket,
  });
};

const restoreWebSocket = (): void => {
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
};

const flush = async (ticks = 3): Promise<void> => {
  for (let index = 0; index < ticks; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const waitForSentFrames = async (socket: FakeWebSocket, count: number): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (socket.sent.length >= count) {
      return;
    }
    await flush();
  }
  throw new Error(`expected at least ${count} ws frames, received ${socket.sent.length}`);
};

afterEach(() => {
  restoreWebSocket();
});

describe("Feature: tRPC transport auth lifecycle", () => {
  test("Scenario: Given a fresh client without auth When the client is created Then the websocket transport stays lazy until a subscription is requested", () => {
    installFakeWebSocket();

    createAgenterClient({
      wsUrl: "ws://example.test/trpc",
    });

    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  test("Scenario: Given auth is set before the first subscription When runtime events subscribe Then the websocket uses the bearer token and auth rotation closes the stale socket", async () => {
    installFakeWebSocket();

    const client = createAgenterClient({
      wsUrl: "ws://example.test/trpc",
    });

    client.setAuthToken("token-1");
    const subscription = client.trpc.runtime.events.subscribe(
      { afterEventId: 1 },
      {
        onData: () => {},
        onError: () => {},
      },
    );

    await flush();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const firstSocket = FakeWebSocket.instances[0]!;
    await waitForSentFrames(firstSocket, 2);

    const connectionMessage = JSON.parse(firstSocket.sent[0]!);
    const subscriptionMessage = JSON.parse(firstSocket.sent[1]!);
    expect(connectionMessage).toMatchObject({
      method: "connectionParams",
      data: {
        authorization: "Bearer token-1",
      },
    });
    expect(subscriptionMessage).toMatchObject({
      method: "subscription",
      params: {
        path: "runtime.events",
      },
    });

    client.setAuthToken("token-2");
    await flush();

    expect(firstSocket.readyState).toBe(FakeWebSocket.CLOSED);

    subscription.unsubscribe();
    client.close();
  });
});
