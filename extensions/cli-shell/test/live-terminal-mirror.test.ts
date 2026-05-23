import { describe, expect, test } from "bun:test";
import type { TerminalTransportServerMessage, TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";

import { createTestTransportSession } from "../legacy/terminal2/test/test-transport-session";
import { createCliShellLiveTerminalMirror } from "../src/tui/terminal-instance-view";

const createSnapshot = (input: {
  seq: number;
  lines: string[];
  rows: number;
  cols: number;
  cursorX: number;
  cursorY: number;
  viewportOffset?: number;
}): TerminalTransportSnapshot => ({
  seq: input.seq,
  timestamp: input.seq,
  cols: input.cols,
  rows: input.rows,
  lines: [...input.lines],
  richLines: input.lines.map((line) => ({
    spans: line.length > 0 ? [{ text: line }] : [],
  })),
  cursor: {
    x: input.cursorX,
    y: input.cursorY,
    absY: (input.viewportOffset ?? 0) + input.cursorY,
    visible: true,
  },
  scrollback: {
    viewportOffset: input.viewportOffset ?? 0,
    totalLines: input.lines.length,
    screenLines: input.rows,
  },
});

const settleMirror = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Feature: cli-shell live terminal mirror lifecycle", () => {
  test("Scenario: Given terminal stop status arrives before a trailing frame When the mirror applies later frame content Then running stays false instead of reviving the terminal", async () => {
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createSnapshot({
        seq: 1,
        lines: ["prompt$ ready"],
        rows: 1,
        cols: 60,
        cursorX: 13,
        cursorY: 0,
      }),
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(): boolean {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    await settleMirror();

    expect(mirror.getView().running).toBe(true);

    transportHooks.onMessage?.({
      type: "status",
      terminalId: "shell-1",
      running: false,
      status: "IDLE",
    });
    expect(mirror.getView().running).toBe(false);

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "IDLE",
      patch: {
        type: "full",
        frame: createSnapshot({
          seq: 2,
          lines: ["prompt$ stopped"],
          rows: 1,
          cols: 60,
          cursorX: 15,
          cursorY: 0,
        }),
      },
    });
    await settleMirror();

    const view = mirror.getView();
    expect(view.plainLines).toEqual(["prompt$ stopped"]);
    expect(view.running).toBe(false);

    mirror.disconnect();
  });
});
