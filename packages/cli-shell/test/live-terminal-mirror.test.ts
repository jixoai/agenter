import { describe, expect, test } from "bun:test";

import type {
  TerminalTransportClientMessage,
  TerminalTransportClientSession,
  TerminalTransportServerMessage,
  TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

import { createCliShellLiveTerminalMirror } from "../src/tui/live-terminal-mirror";

const createRichSnapshot = (input: {
  lines: string[];
  rows: number;
  cols: number;
  cursorX: number;
  cursorY: number;
}): TerminalTransportSnapshot => ({
  seq: 1,
  timestamp: 1,
  cols: input.cols,
  rows: input.rows,
  lines: [...input.lines],
  richLines: input.lines.map((line) => ({
    spans: line.length > 0 ? [{ text: line }] : [],
  })),
  cursor: {
    x: input.cursorX,
    y: input.cursorY,
    visible: true,
  },
  scrollback: {
    viewportOffset: Math.max(0, input.lines.length - input.rows),
    totalLines: input.lines.length,
    screenLines: input.rows,
  },
});

const settleMirror = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const waitForMirrorEvent = (mirror: ReturnType<typeof createCliShellLiveTerminalMirror>): Promise<void> =>
  new Promise((resolve) => {
    const release = mirror.subscribe(() => {
      release();
      resolve();
    });
  });

describe("Feature: cli-shell live terminal mirror", () => {
  test("Scenario: Given an initial snapshot with scrollback When the mirror projects cursor truth Then cursorAbsRow stays viewport-aware", async () => {
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["line-1", "line-2", "line-3", "prompt$ "],
        rows: 2,
        cols: 40,
        cursorX: 7,
        cursorY: 1,
      }),
      createTransportSession: ({ events }) => ({
        async connect(): Promise<void> {
          events.onOpen();
        },
        disconnect(): void {
          events.onClose();
        },
        send(_message: TerminalTransportClientMessage): boolean {
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      }),
    });

    await settleMirror();

    const view = mirror.getView();
    expect(view.cursorAbsRow).toBe(3);
    expect(view.viewportStart).toBe(2);
    expect(view.viewportEnd).toBe(4);
  });

  test("Scenario: Given a rich bootstrap snapshot When live output bytes arrive Then the mirror keeps the hydrated terminal buffer instead of dropping prior lines", async () => {
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["prompt$ "],
        rows: 1,
        cols: 60,
        cursorX: 7,
        cursorY: 0,
      }),
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return {
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(_message: TerminalTransportClientMessage): boolean {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        } satisfies TerminalTransportClientSession;
      },
    });

    await mirror.connect();
    await settleMirror();

    const update = waitForMirrorEvent(mirror);
    const emitServerMessage = transportHooks.onMessage;
    if (!emitServerMessage) {
      throw new Error("expected mirror transport to capture onMessage");
    }
    emitServerMessage({
      type: "outputBytes",
      terminalId: "shell-1",
      data: new TextEncoder().encode("echo synced\r\nsynced\r\n"),
    });
    await update;

    const view = mirror.getView();
    expect(view.plainLines[0]).toContain("prompt$ echo synced");
    expect(view.plainLines.some((line) => line.includes("synced"))).toBe(true);
  });
});
