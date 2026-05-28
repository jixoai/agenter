import { describe, expect, test } from "bun:test";
import type {
  TerminalTransportClientMessage,
  TerminalTransportClientSession,
  TerminalTransportServerMessage,
  TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";
import { createTestRenderer } from "@opentui/core/testing";

import {
  createBunPtyPaneSource,
  createCommandTaskPaneSource,
  createOpenTuiRenderablePaneSource,
  createPaneSourceId,
  getPaneSourceLayoutKind,
  normalizeTerminalPaneSource,
  type TerminalFrameSnapshot,
  type TerminalProtocolPaneSource,
} from "../src/renderable-mux/pane-source";
import { ShellNextLiveTerminalProtocolSource } from "../src/sources/shell-next-live-terminal-source";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const createProtocolSource = (id: string): TerminalProtocolPaneSource => {
  let size = { cols: 80, rows: 24 };
  const frame = (): TerminalFrameSnapshot => ({
    size,
    lines: ["protocol frame"],
    revision: 1,
  });
  return {
    kind: "terminal-protocol",
    id: createPaneSourceId(id),
    readFrame: frame,
    writeInput: () => undefined,
    resize: (nextSize) => {
      size = nextSize;
    },
    dispose: () => undefined,
  };
};

const createSnapshot = (input: {
  seq: number;
  lines: readonly string[];
  rows: number;
  cols: number;
  cursorX: number;
  cursorY: number;
}): TerminalTransportSnapshot => ({
  seq: input.seq,
  timestamp: input.seq,
  cols: input.cols,
  rows: input.rows,
  lines: [...input.lines],
  richLines: input.lines.map((line) => ({
    spans: line.length > 0 ? [{ text: line, fg: "#00ff00" }] : [],
  })),
  cursor: {
    x: input.cursorX,
    y: input.cursorY,
    absY: input.cursorY,
    visible: true,
  },
  scrollback: {
    viewportOffset: 0,
    totalLines: input.lines.length,
    screenLines: input.rows,
  },
});

const createTestTransportSession = (input: {
  connect(): Promise<void>;
  disconnect?: () => void;
  send?: (message: TerminalTransportClientMessage) => boolean;
}): TerminalTransportClientSession => {
  const send = input.send ?? (() => true);
  return {
    connect: input.connect,
    disconnect: input.disconnect ?? (() => undefined),
    send,
    sendInputBytes: (data) => send({ type: "inputBytes", data }),
    resize: (cols, rows) => send({ type: "resize", cols, rows }),
    scrollViewport: (deltaRows) => send({ type: "viewportDelta", deltaRows }),
    setViewportStart: (viewportStart) => send({ type: "viewportTarget", viewportStart }),
    followCursor: () => send({ type: "followCursor" }),
    selectionStart: (point) => send({ type: "selectionStart", point }),
    selectionUpdate: (point) => send({ type: "selectionUpdate", point }),
    selectionEnd: (point) => send({ type: "selectionEnd", point }),
    selectWordAt: (point) => send({ type: "selectWordAt", point }),
    selectLineAt: (point) => send({ type: "selectLineAt", point }),
    selectRange: (range) => send({ type: "selectRange", range }),
    copySelection: (ownerId) => send({ type: "copySelection", ownerId }),
    clearSelection: (ownerId) => send({ type: "clearSelection", ownerId }),
    pullFrame: (frameInput) => send({ type: "pullFrame", ...frameInput }),
    getConnectionState: () => "connected",
  };
};

describe("Feature: shell-next pane source normalization", () => {
  test("Scenario: Given a protocol channel source When normalized Then it remains the terminal truth boundary", () => {
    const protocol = createProtocolSource("protocol-1");

    expect(normalizeTerminalPaneSource(protocol)).toBe(protocol);
    expect(getPaneSourceLayoutKind(protocol)).toBe("terminal-protocol");
  });

  test("Scenario: Given a Bun PTY source When normalized Then it exposes the same protocol channel shape", () => {
    const protocol = createProtocolSource("pty-1");
    const source = createBunPtyPaneSource({
      id: createPaneSourceId("pty-1"),
      launch: { command: "bash", args: ["-l"], cwd: "/tmp" },
      protocol,
    });

    expect(normalizeTerminalPaneSource(source)).toBe(protocol);
    expect(getPaneSourceLayoutKind(source)).toBe("terminal-protocol");
    expect(source.launch.command).toBe("bash");
  });

  test("Scenario: Given a CommandTask source When normalized Then it lowers through the Bun PTY source path", () => {
    const protocol = createProtocolSource("task-1");
    const source = createCommandTaskPaneSource({
      id: createPaneSourceId("task-1"),
      task: { command: "npm", args: ["test"], label: "test task" },
      protocol,
    });

    expect(source.bunPty.launch.command).toBe("npm");
    expect(source.bunPty.launch.args).toEqual(["test"]);
    expect(normalizeTerminalPaneSource(source)).toBe(protocol);
    expect(getPaneSourceLayoutKind(source)).toBe("terminal-protocol");
  });

  test("Scenario: Given an OpenTUI renderable source When classified Then it stays outside terminal protocol truth", async () => {
    const setup = await createTestRenderer({ width: 10, height: 4 });
    const source = createOpenTuiRenderablePaneSource({
      id: createPaneSourceId("room-1"),
      surface: {
        root: setup.renderer.root,
        syncNode: () => undefined,
      },
    });

    expect(getPaneSourceLayoutKind(source)).toBe("opentui-renderable");
    setup.renderer.destroy();
  });

  test("Scenario: Given a shell-next live terminal channel When normalized as shell-next source Then rich protocol facts are preserved", async () => {
    const sentMessages: TerminalTransportClientMessage[] = [];
    const session = {
      deliverServerMessage: null as ((message: TerminalTransportServerMessage) => void) | null,
    };
    let disconnected = false;
    const source = new ShellNextLiveTerminalProtocolSource({
      id: createPaneSourceId("terminal-live-1"),
      terminalId: "terminal-live-1",
      transportUrl: "ws://127.0.0.1/terminal-live-1",
      initialSnapshot: createSnapshot({
        seq: 7,
        lines: ["rich terminal"],
        rows: 4,
        cols: 20,
        cursorX: 3,
        cursorY: 0,
      }),
      createTransportSession: (sessionInput) => {
        const { events } = sessionInput;
        session.deliverServerMessage = events.onMessage;
        return createTestTransportSession({
          connect: async () => {
            events.onOpen();
          },
          disconnect: () => {
            disconnected = true;
            events.onClose();
          },
          send: (message) => {
            sentMessages.push(message);
            return true;
          },
        });
      },
    });

    await source.ready;
    source.resize({ cols: 18, rows: 3 });
    source.writeInput("x");
    const frame = source.readFrame();

    expect(frame.revision).toBe(7);
    expect(frame.lines).toEqual(["rich terminal", "", "", ""]);
    expect(frame.richLines?.[0]?.spans[0]).toMatchObject({ text: "rich terminal", fg: "#00ff00" });
    expect(sentMessages).not.toContainEqual({ type: "resize", cols: 18, rows: 3 });
    expect(sentMessages.some((message) => message.type === "inputBytes")).toBe(true);
    await wait(30);
    expect(sentMessages).toContainEqual({ type: "resize", cols: 18, rows: 3 });

    const selectionTextEvents: Array<{ ownerId?: string; text: string; target?: "clipboard" | "primary" }> = [];
    const unsubscribeSelectionText = source.subscribeSelectionText((event) => {
      selectionTextEvents.push(event);
    });
    expect(source.copySelection("terminal", "primary")).toBe(true);
    const deliverServerMessage = session.deliverServerMessage;
    if (!deliverServerMessage) {
      throw new Error("live terminal test session did not expose server message delivery");
    }
    deliverServerMessage({
      type: "selectionText",
      terminalId: "terminal-live-1",
      ownerId: "terminal",
      text: "async primary text",
    });
    expect(selectionTextEvents).toContainEqual({
      ownerId: "terminal",
      text: "async primary text",
      target: "primary",
    });
    unsubscribeSelectionText();

    source.dispose();
    expect(disconnected).toBe(true);
  });
});
