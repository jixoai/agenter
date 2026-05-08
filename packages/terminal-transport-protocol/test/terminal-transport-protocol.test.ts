import { describe, expect, test } from "bun:test";

import {
  binaryStringToBytes,
  createTerminalTransportClientSession,
  decodeTerminalTransportClientMessage,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  encodeTerminalTransportServerMessage,
} from "../src";

class FakeSocket {
  static readonly OPEN = 1;

  readonly listeners = {
    open: new Set<() => void>(),
    close: new Set<() => void>(),
    error: new Set<() => void>(),
    message: new Set<(event: { data: unknown }) => void>(),
  };

  readyState = 0;
  binaryType = "";
  sent: ArrayBuffer[] = [];

  send(data: ArrayBuffer): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close");
  }

  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(
    type: "open" | "close" | "error" | "message",
    listener: (() => void) | ((event: { data: unknown }) => void),
  ): void {
    (this.listeners[type] as Set<typeof listener>).add(listener);
  }

  emit(type: "open" | "close" | "error"): void;
  emit(type: "message", data: unknown): void;
  emit(type: "open" | "close" | "error" | "message", data?: unknown): void {
    if (type === "message") {
      for (const listener of this.listeners.message) {
        listener({ data });
      }
      return;
    }
    for (const listener of this.listeners[type]) {
      listener();
    }
  }
}

describe("Feature: terminal transport protocol", () => {
  test("Scenario: Given client live bytes and sideband frames When protobuf roundtrip runs Then opaque terminal input and resize truth are preserved", () => {
    const inputBytes = encodeTerminalTransportClientMessage({
      type: "inputBytes",
      data: Uint8Array.of(0x1b, 0x5b, 0x41, 0xff),
    });
    const resize = encodeTerminalTransportClientMessage({
      type: "resize",
      cols: 103,
      rows: 27,
    });

    expect(decodeTerminalTransportClientMessage(inputBytes)).toEqual({
      type: "inputBytes",
      data: Uint8Array.of(0x1b, 0x5b, 0x41, 0xff),
    });
    expect(decodeTerminalTransportClientMessage(resize)).toEqual({
      type: "resize",
      cols: 103,
      rows: 27,
    });
  });

  test("Scenario: Given server snapshot status and output frames When protobuf roundtrip runs Then renderable bootstrap and live bytes stay coherent", () => {
    const snapshot = encodeTerminalTransportServerMessage({
      type: "snapshot",
      terminalId: "term-demo",
      status: "BUSY",
      snapshot: {
        seq: 7,
        timestamp: 1234,
        cols: 80,
        rows: 24,
        lines: ["hello", "world"],
        richLines: [
          {
            spans: [{ text: "hello", fg: "#ffffff", bold: true }],
          },
        ],
        cursor: { x: 2, y: 1 },
        cursorVisible: true,
      },
    });
    const outputBytes = encodeTerminalTransportServerMessage({
      type: "outputBytes",
      terminalId: "term-demo",
      data: Uint8Array.of(0x68, 0x69),
    });
    const status = encodeTerminalTransportServerMessage({
      type: "status",
      terminalId: "term-demo",
      running: false,
      status: "IDLE",
    });

    expect(decodeTerminalTransportServerMessage(snapshot)).toEqual({
      type: "snapshot",
      terminalId: "term-demo",
      status: "BUSY",
      snapshot: {
        seq: 7,
        timestamp: 1234,
        cols: 80,
        rows: 24,
        lines: ["hello", "world"],
        richLines: [
          {
            spans: [{ text: "hello", fg: "#ffffff", bg: undefined, bold: true, underline: false, inverse: false }],
          },
        ],
        cursor: { x: 2, y: 1 },
        cursorVisible: true,
      },
    });
    expect(decodeTerminalTransportServerMessage(outputBytes)).toEqual({
      type: "outputBytes",
      terminalId: "term-demo",
      data: Uint8Array.of(0x68, 0x69),
    });
    expect(decodeTerminalTransportServerMessage(status)).toEqual({
      type: "status",
      terminalId: "term-demo",
      running: false,
      status: "IDLE",
    });
  });

  test("Scenario: Given malformed binary or xterm binary strings When decoding Then invalid payloads are rejected and raw bytes stay lossless", () => {
    expect(decodeTerminalTransportClientMessage(Uint8Array.of(0xff, 0x00))).toBeNull();
    expect(decodeTerminalTransportServerMessage(Uint8Array.of(0xff, 0x00))).toBeNull();
    expect(binaryStringToBytes(String.fromCharCode(0xff, 0x00, 0x7f))).toEqual(Uint8Array.of(0xff, 0x00, 0x7f));
  });

  test("Scenario: Given a connected websocket session When client messages and server frames flow Then the shared transport session preserves bytes-first truth", async () => {
    const socket = new FakeSocket();
    const opened: string[] = [];
    const messages: unknown[] = [];
    const session = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createSocket: () => socket,
      events: {
        onOpen: () => {
          opened.push("open");
        },
        onMessage: (message) => {
          messages.push(message);
        },
      },
    });

    const connectPromise = session.connect();
    socket.readyState = FakeSocket.OPEN;
    socket.emit("open");
    await connectPromise;

    const sent = session.send({
      type: "inputBytes",
      data: Uint8Array.of(0x65, 0x63, 0x68, 0x6f),
    });
    socket.emit(
      "message",
      encodeTerminalTransportServerMessage({
        type: "outputBytes",
        terminalId: "shell-1",
        data: Uint8Array.of(0x6f, 0x6b),
      }).buffer,
    );

    expect(opened).toEqual(["open"]);
    expect(sent).toBe(true);
    expect(socket.sent).toHaveLength(1);
    expect(decodeTerminalTransportClientMessage(new Uint8Array(socket.sent[0]))).toEqual({
      type: "inputBytes",
      data: Uint8Array.of(0x65, 0x63, 0x68, 0x6f),
    });
    expect(messages).toEqual([
      {
        type: "outputBytes",
        terminalId: "shell-1",
        data: Uint8Array.of(0x6f, 0x6b),
      },
    ]);
  });

  test("Scenario: Given transport open never succeeds When the socket errors or closes early Then the client session fails explicitly instead of hanging", async () => {
    const socket = new FakeSocket();
    const errors: string[] = [];
    const closes: string[] = [];
    const session = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createSocket: () => socket,
      events: {
        onError: (message) => {
          errors.push(message);
        },
        onClose: () => {
          closes.push("close");
        },
      },
    });

    const errorPromise = session.connect();
    socket.emit("error");
    await expect(errorPromise).rejects.toThrow("transport error");
    expect(errors).toEqual(["transport error"]);
    expect(session.getConnectionState()).toBe("error");

    const socket2 = new FakeSocket();
    const session2 = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-2",
      createSocket: () => socket2,
      events: {
        onClose: () => {
          closes.push("close-before-open");
        },
      },
    });

    const closePromise = session2.connect();
    socket2.emit("close");
    await expect(closePromise).rejects.toThrow("closed before open");
    expect(closes).toContain("close-before-open");
    expect(session2.getConnectionState()).toBe("closed");
  });
});
