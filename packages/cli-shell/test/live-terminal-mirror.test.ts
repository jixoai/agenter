import { describe, expect, test } from "bun:test";

import type {
  TerminalTransportClientMessage,
  TerminalTransportServerMessage,
  TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

import { createCliShellLiveTerminalMirror } from "../src/tui/live-terminal-mirror";
import { createTestTransportSession } from "./test-transport-session";

const createRichSnapshot = (input: {
  lines: string[];
  rows: number;
  cols: number;
  cursorX: number;
  cursorY: number;
  viewportOffset?: number;
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
    viewportOffset: input.viewportOffset ?? Math.max(0, input.lines.length - input.rows),
    totalLines: input.lines.length,
    screenLines: input.rows,
  },
});

const settleMirror = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const waitUntil = async (predicate: () => boolean, timeoutMs = 1_000): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for mirror condition");
    }
    await Bun.sleep(10);
  }
};

describe("Feature: cli-shell live terminal mirror", () => {
  test("Scenario: Given transport client timing events When the mirror receives them Then trace separates send raw decode and pacing state", async () => {
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["prompt$ "],
        rows: 1,
        cols: 40,
        cursorX: 8,
        cursorY: 0,
      }),
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          events.onOpen();
          events.onTrace?.({
            kind: "client-send",
            messageType: "pullFrame",
            byteLength: 12,
            dataPlane: "direct",
          });
          events.onTrace?.({
            kind: "client-raw-message",
            byteLength: 128,
            dataPlane: "websocket",
          });
          events.onTrace?.({
            kind: "client-decode-message",
            messageType: "frame",
            byteLength: 128,
            decodeMs: 2.345,
            dataPlane: "websocket",
            reason: "probe",
          });
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
      }),
    });

    await mirror.connect();
    await settleMirror();

    expect(traceEvents).toContainEqual({
      kind: "client-send",
      detail: expect.objectContaining({
        terminalId: "shell-1",
        messageType: "pullFrame",
        byteLength: 12,
        dataPlane: "direct",
        reason: undefined,
        decodeMs: null,
        pullMode: "active",
        pacingMode: "fixed",
      }),
    });
    expect(traceEvents).toContainEqual({
      kind: "client-raw-message",
      detail: expect.objectContaining({
        terminalId: "shell-1",
        byteLength: 128,
        dataPlane: "websocket",
      }),
    });
    expect(traceEvents).toContainEqual({
      kind: "client-decode-message",
      detail: expect.objectContaining({
        terminalId: "shell-1",
        messageType: "frame",
        byteLength: 128,
        decodeMs: 2.35,
        dataPlane: "websocket",
        reason: "probe",
      }),
    });
  });

  test("Scenario: Given an initial viewport frame with scrollback metadata When the mirror projects cursor truth Then cursorAbsRow is restored to absolute model space", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["line-3", "prompt$ "],
        rows: 2,
        cols: 40,
        cursorX: 7,
        cursorY: 1,
        viewportOffset: 2,
      }),
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          sent.push({
            type: "hello",
            terminalId: "shell-1",
            geometryRole: "authority",
          });
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

    await mirror.connect();
    await settleMirror();

    const view = mirror.getView();
    expect(view.cursorAbsRow).toBe(3);
    expect(view.viewportStart).toBe(2);
    expect(view.viewportEnd).toBe(4);
    expect(sent).toContainEqual({
      type: "hello",
      terminalId: "shell-1",
      geometryRole: "authority",
    });
  });

  test("Scenario: Given a legacy full-scrollback bootstrap snapshot When the mirror reads it Then the view is first normalized to visible viewport rows", async () => {
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["line-0", "line-1", "line-2", "line-3"],
        rows: 2,
        cols: 40,
        cursorX: 7,
        cursorY: 3,
        viewportOffset: 2,
      }),
      createTransportSession: ({ events }) => createTestTransportSession({
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
      }),
    });

    await mirror.connect();
    await settleMirror();

    const view = mirror.getView();
    expect(view.plainLines).toEqual(["line-2", "line-3"]);
    expect(view.cursorAbsRow).toBe(3);
    expect(view.viewportStart).toBe(2);
    expect(view.scrollbackRows).toBe(4);
  });

  test("Scenario: Given a rich bootstrap frame When the backend only emits dirty signals Then the mirror pulls and applies frame patches instead of locally reconstructing terminal bytes", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const initialSnapshot = createRichSnapshot({
      lines: ["prompt$ "],
      rows: 1,
      cols: 60,
      cursorX: 7,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot,
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
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

    const emitServerMessage = transportHooks.onMessage;
    if (!emitServerMessage) {
      throw new Error("expected mirror transport to capture onMessage");
    }
    emitServerMessage({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "snapshot",
    });
    await Bun.sleep(180);
    expect(sent.some((message) => message.type === "pullFrame")).toBe(true);

    emitServerMessage({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "BUSY",
      patch: {
        type: "rows",
        baseFrameSeq: initialSnapshot.seq,
        rowPatches: [
          {
            row: 0,
            line: "prompt$ synced",
            richLine: { spans: [{ text: "prompt$ synced" }] },
          },
        ],
        cols: 60,
        rows: 1,
        cursor: { x: 14, y: 0, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: 1,
          screenLines: 1,
        },
        timestamp: 2,
      },
    });
    await settleMirror();

    const view = mirror.getView();
    expect(view.plainLines).toEqual(["prompt$ synced"]);
  });

  test("Scenario: Given row-cache transport patches When known rows repeat Then the live mirror decodes cid-only rows through connection-local cache", async () => {
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
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

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 1,
      status: "IDLE",
      patch: {
        type: "rowCache",
        baseFrameSeq: 0,
        cachedRows: [
          { cid: 1, line: "alpha", richLine: { spans: [{ text: "alpha" }] } },
          { cid: 2, line: "beta", richLine: { spans: [{ text: "beta" }] } },
          { cid: 0 },
        ],
        cols: 40,
        rows: 3,
        cursor: { x: 4, y: 1, visible: true },
        scrollback: { viewportOffset: 0, totalLines: 3, screenLines: 3 },
      },
    });
    await settleMirror();
    expect(mirror.getView().plainLines).toEqual(["alpha", "beta", ""]);

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "IDLE",
      patch: {
        type: "rowCache",
        baseFrameSeq: 1,
        cachedRows: [
          { cid: 2 },
          { cid: 0 },
          { cid: 1 },
        ],
        cols: 40,
        rows: 3,
        cursor: { x: 5, y: 2, visible: true },
        scrollback: { viewportOffset: 1, totalLines: 4, screenLines: 3 },
      },
    });
    await settleMirror();

    const view = mirror.getView();
    expect(view.plainLines).toEqual(["beta", "", "alpha"]);
    expect(view.viewportStart).toBe(1);
  });

  test("Scenario: Given backend viewport is the only authority When the mirror pulls a dirty frame Then pullFrame does not carry a client viewport selector", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["line-10", "line-11"],
        rows: 2,
        cols: 60,
        cursorX: 7,
        cursorY: 1,
        viewportOffset: 10,
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
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
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
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "snapshot",
    });
    await Bun.sleep(180);

    const pullFrame = sent.findLast((message) => message.type === "pullFrame");
    expect(pullFrame).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: 1,
      cols: 60,
      rows: 2,
    });
  });

  test("Scenario: Given an initial backend snapshot When the mirror opens Then startup pacing does not invent a dirty frame ahead of backend truth", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    const initialSnapshot = createRichSnapshot({
      lines: ["prompt$ ready"],
      rows: 1,
      cols: 60,
      cursorX: 13,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot,
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          events.onOpen();
        },
        disconnect(): void {
          events.onClose();
        },
        send(message: TerminalTransportClientMessage): boolean {
          sent.push(message);
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      }),
    });

    await mirror.connect();
    await Bun.sleep(80);

    const pullFrame = sent.find((message) => message.type === "pullFrame");
    expect(pullFrame).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: initialSnapshot.seq,
      cols: initialSnapshot.cols,
      rows: initialSnapshot.rows,
    });
    const firstPullTrace = traceEvents.find((event) => event.kind === "pull-frame-sent");
    expect(firstPullTrace?.detail).toMatchObject({
      dirtyFrameSeq: initialSnapshot.seq,
      observedFrameSeq: initialSnapshot.seq,
      dirtyQueueDepth: 0,
      pacingMode: "fixed",
      pullMode: "active",
    });
  });

  test("Scenario: Given server-side debug trace arrives When the mirror receives it Then the event is recorded in local trace without touching frame paint", async () => {
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    let requestPaintCount = 0;
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["prompt$ ready"],
        rows: 1,
        cols: 60,
        cursorX: 13,
        cursorY: 0,
      }),
      requestPaint() {
        requestPaintCount += 1;
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
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
    transportHooks.onMessage?.({
      type: "trace",
      terminalId: "shell-1",
      event: "pull-frame-server",
      fields: {
        frameSeq: 7,
        patchType: "rowCache",
        totalMs: 4,
        queueWaitMs: null,
      },
      timestamp: 1234,
    });
    await settleMirror();

    expect(requestPaintCount).toBe(0);
    expect(traceEvents).toContainEqual({
      kind: "server-pull-frame-server",
      detail: {
        terminalId: "shell-1",
        frameSeq: 7,
        patchType: "rowCache",
        totalMs: 4,
        queueWaitMs: null,
        serverTimestamp: 1234,
      },
    });
  });

  test("Scenario: Given the native shell view grows taller When the mirror receives a dirty signal Then the next pull uses the current frontend geometry", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: ["old-0", "old-1"],
        rows: 2,
        cols: 60,
        cursorX: 7,
        cursorY: 1,
        viewportOffset: 0,
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
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    mirror.setPullGeometry(80, 12);
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "resize",
    });
    await Bun.sleep(180);

    const pullFrame = sent.findLast((message) => message.type === "pullFrame");
    expect(pullFrame).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: 1,
      cols: 80,
      rows: 12,
    });
  });

  test("Scenario: Given a connected mirror When the shell-terminal-view requests shared viewport movement Then the transport sends an explicit viewportDelta message", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const sessionInputs: Array<{ terminalId?: string; geometryRole?: "projection-only" | "authority" }> = [];
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createTransportSession: ({ events, terminalId, geometryRole }) => {
        sessionInputs.push({ terminalId, geometryRole });
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    expect(sessionInputs[0]).toEqual({
      terminalId: "shell-1",
      geometryRole: "authority",
    });
    expect(mirror.scrollViewport(-4)).toBe(true);
    expect(sent).toContainEqual({
      type: "viewportDelta",
      deltaRows: -4,
    });
  });

  test("Scenario: Given a connected mirror When shell-terminal-view requests an absolute shared viewport target Then the transport sends an explicit viewportTarget message", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          events.onOpen();
        },
        disconnect(): void {
          events.onClose();
        },
        send(message: TerminalTransportClientMessage): boolean {
          sent.push(message);
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      }),
    });

    await mirror.connect();
    expect(mirror.setViewportStart(7)).toBe(true);
    expect(sent).toContainEqual({
      type: "viewportTarget",
      viewportStart: 7,
    });
  });

  test("Scenario: Given input leaves the cursor below the visible viewport When cli-shell asks to follow the cursor Then the transport sends an absolute viewport target", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: createRichSnapshot({
        lines: Array.from({ length: 40 }, (_, index) => `line-${index}`),
        rows: 10,
        cols: 80,
        cursorX: 3,
        cursorY: 39,
        viewportOffset: 0,
      }),
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          events.onOpen();
        },
        disconnect(): void {
          events.onClose();
        },
        send(message: TerminalTransportClientMessage): boolean {
          sent.push(message);
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      }),
    });

    await mirror.connect();
    expect(mirror.followCursor()).toBe(true);
    expect(sent).toContainEqual({
      type: "viewportTarget",
      viewportStart: 30,
    });
  });

  test("Scenario: Given large shell output like cat AGENTS.md When dirty signals arrive quickly Then the mirror pulls one viewport-sized frame and records skipped frame pressure", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const initialSnapshot = createRichSnapshot({
      lines: Array.from({ length: 24 }, (_, index) => `boot-${index}`),
      rows: 24,
      cols: 100,
      cursorX: 0,
      cursorY: 23,
      viewportOffset: 0,
    });
    const largeOutputLines = Array.from({ length: 1_200 }, (_, index) =>
      index === 1_199 ? "shell-1:~/repo $" : `AGENTS.md line ${index.toString().padStart(4, "0")}`,
    );
    let requestPaintCount = 0;
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot,
      requestPaint() {
        requestPaintCount += 1;
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
            if (message.type === "pullFrame") {
              const viewportStart = largeOutputLines.length - message.rows;
              const lines = largeOutputLines.slice(viewportStart, viewportStart + message.rows);
              events.onMessage({
                type: "frame",
                terminalId: "shell-1",
                frameSeq: 80,
                status: "IDLE",
                patch: {
                  type: "full",
                  frame: {
                    seq: 80,
                    timestamp: Date.now(),
                    cols: message.cols,
                    rows: message.rows,
                    lines,
                    richLines: lines.map((line) => ({ spans: [{ text: line }] })),
                    cursor: { x: "shell-1:~/repo $".length, y: message.rows - 1, visible: true },
                    scrollback: {
                      viewportOffset: viewportStart,
                      totalLines: largeOutputLines.length,
                      screenLines: message.rows,
                    },
                  },
                },
              });
            }
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    mirror.setPullGeometry(100, 24);
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 50,
      reason: "snapshot",
    });
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 80,
      reason: "snapshot",
    });
    await waitUntil(() => mirror.getView().viewportStart === 1_176);

    const pullFrame = sent.findLast((message) => message.type === "pullFrame");
    expect(pullFrame).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: 1,
      cols: 100,
      rows: 24,
    });
    const view = mirror.getView();
    expect(view.richLines).toHaveLength(24);
    expect(view.scrollbackRows).toBe(1_200);
    expect(view.viewportStart).toBe(1_176);
    expect(view.plainLines.at(-1)).toBe("shell-1:~/repo $");
    expect(requestPaintCount).toBe(1);
    expect(traceEvents.some((event) => event.kind === "frame-dirty-received")).toBe(true);
    expect(
      traceEvents.some(
        (event) =>
          event.kind === "frame-received" &&
          event.detail?.patchType === "full" &&
          event.detail?.patchRows === 24 &&
          typeof event.detail.diffBytes === "number" &&
          (event.detail.skippedFrames as number | undefined) !== undefined,
      ),
    ).toBe(true);
  });

  test("Scenario: Given the backend returns an already-applied frame When the mirror receives the duplicate frame Then it keeps transport pacing without requesting another paint", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    let requestPaintCount = 0;
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const snapshot = createRichSnapshot({
      lines: ["prompt$ ready"],
      rows: 1,
      cols: 60,
      cursorX: 13,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: snapshot,
      requestPaint() {
        requestPaintCount += 1;
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
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

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: snapshot.seq,
      status: "IDLE",
      patch: {
        type: "full",
        frame: snapshot,
      },
    });
    await settleMirror();

    expect(requestPaintCount).toBe(0);
    expect(mirror.getView().plainLines).toEqual(["prompt$ ready"]);
    expect(traceEvents.some((event) => event.kind === "frame-skipped" && event.detail?.reason === "duplicate-frame")).toBe(true);
    await waitUntil(() => sent.some((message) => message.type === "pullFrame"));
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(1);
  });

  test("Scenario: Given default fixed pacing When dirty has been consumed by notModified Then the mirror keeps client-paced 30FPS instead of dropping to idle", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    let requestPaintCount = 0;
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const snapshot = createRichSnapshot({
      lines: ["prompt$ ready"],
      rows: 1,
      cols: 60,
      cursorX: 13,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: snapshot,
      requestPaint() {
        requestPaintCount += 1;
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "style-fallback",
    });
    await Bun.sleep(80);
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(1);

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "IDLE",
      patch: {
        type: "notModified",
        baseFrameSeq: snapshot.seq,
        timestamp: 2,
      },
    });
    await Bun.sleep(120);

    expect(requestPaintCount).toBe(0);
    expect(mirror.getView().plainLines).toEqual(["prompt$ ready"]);
    expect(traceEvents.some((event) => event.kind === "frame-not-modified")).toBe(true);
    expect(
      traceEvents.some(
        (event) =>
          event.kind === "pull-frame-scheduled" &&
          event.detail?.pacingMode === "fixed" &&
          event.detail?.pullMode === "active" &&
          event.detail?.delayMs === 33 &&
          event.detail?.dirtyQueueDepth === 0,
      ),
    ).toBe(true);
    await waitUntil(() => sent.filter((message) => message.type === "pullFrame").length >= 2);
  });

  test("Scenario: Given experimental dynamic pacing When drawable cells stay unchanged past the quiet window Then the mirror returns to idle fallback cadence", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const snapshot = createRichSnapshot({
      lines: ["prompt$ ready"],
      rows: 1,
      cols: 60,
      cursorX: 13,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot: snapshot,
      pacing: {
        mode: "dynamic",
        dynamicQuietMs: 20,
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        });
      },
    });

    await mirror.connect();
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "style-fallback",
    });
    await Bun.sleep(80);
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(1);

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "IDLE",
      patch: {
        type: "notModified",
        baseFrameSeq: snapshot.seq,
        timestamp: 2,
      },
    });
    await Bun.sleep(30);

    expect(traceEvents.some((event) => event.kind === "dynamic-pacing-active")).toBe(true);
    expect(traceEvents.some((event) => event.kind === "dynamic-pacing-idle")).toBe(true);
    expect(
      traceEvents.some(
        (event) =>
          event.kind === "pull-frame-scheduled" &&
          event.detail?.pacingMode === "dynamic" &&
          event.detail?.pullMode === "idle" &&
          event.detail?.delayMs === 1000,
      ),
    ).toBe(true);
  });

  test("Scenario: Given a frame is applied When more dirty signals arrive before UI paint commits Then the mirror waits for paint before pulling again", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    let requestPaintCount = 0;
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const initialSnapshot = createRichSnapshot({
      lines: ["boot"],
      rows: 1,
      cols: 40,
      cursorX: 0,
      cursorY: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot,
      requestPaint() {
        requestPaintCount += 1;
      },
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => {
        transportHooks.onMessage = events.onMessage;
        return createTestTransportSession({
          async connect(): Promise<void> {
            events.onOpen();
          },
          disconnect(): void {
            events.onClose();
          },
          send(message: TerminalTransportClientMessage): boolean {
            sent.push(message);
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
    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 2,
      reason: "snapshot",
    });
    await Bun.sleep(180);
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(1);

    transportHooks.onMessage?.({
      type: "frame",
      terminalId: "shell-1",
      frameSeq: 2,
      status: "IDLE",
      patch: {
        type: "full",
        frame: {
          seq: 2,
          timestamp: Date.now(),
          cols: 40,
          rows: 1,
          lines: ["after-first-pull"],
          richLines: [{ spans: [{ text: "after-first-pull" }] }],
          cursor: { x: 16, y: 0, visible: true },
          scrollback: {
            viewportOffset: 0,
            totalLines: 1,
            screenLines: 1,
          },
        },
      },
    });
    await settleMirror();
    expect(requestPaintCount).toBe(1);

    transportHooks.onMessage?.({
      type: "frameDirty",
      terminalId: "shell-1",
      frameSeq: 3,
      reason: "snapshot",
    });
    await Bun.sleep(180);
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(1);
    expect(
      traceEvents.some(
        (event) =>
          event.kind === "pull-frame-blocked" &&
          Array.isArray(event.detail?.blockedReasons) &&
          event.detail.blockedReasons.includes("paint-in-flight"),
      ),
    ).toBe(true);

    mirror.notifyPaintCommitted();
    await Bun.sleep(180);
    expect(sent.filter((message) => message.type === "pullFrame")).toHaveLength(2);
  });

  test("Scenario: Given continuous wheel scrolling When many deltas arrive in one paint window Then cli-shell objectively forwards each backend scroll input without local refresh requests", async () => {
    const sent: TerminalTransportClientMessage[] = [];
    const traceEvents: Array<{ kind: string; detail?: Record<string, unknown> }> = [];
    const initialSnapshot = createRichSnapshot({
      lines: Array.from({ length: 20 }, (_, index) => `line-${index}`),
      rows: 5,
      cols: 40,
      cursorX: 0,
      cursorY: 4,
      viewportOffset: 0,
    });
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: "shell-1",
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      initialSnapshot,
      trace: {
        enabled: true,
        record(event) {
          traceEvents.push(event);
        },
      },
      createTransportSession: ({ events }) => createTestTransportSession({
          async connect(): Promise<void> {
          events.onOpen();
        },
        disconnect(): void {
          events.onClose();
        },
        send(message: TerminalTransportClientMessage): boolean {
          sent.push(message);
          if (message.type === "pullFrame") {
            const viewportStart = 12;
            const lines = Array.from({ length: 20 }, (_, index) => `line-${index}`).slice(
              viewportStart,
              viewportStart + message.rows,
            );
            events.onMessage({
              type: "frame",
              terminalId: "shell-1",
              frameSeq: 2,
              status: "IDLE",
              patch: {
                type: "full",
                frame: {
                  seq: 2,
                  timestamp: Date.now(),
                  cols: message.cols,
                  rows: message.rows,
                  lines,
                  richLines: lines.map((line) => ({ spans: [{ text: line }] })),
                  cursor: { x: 0, y: message.rows - 1, visible: true },
                  scrollback: {
                    viewportOffset: viewportStart,
                    totalLines: 20,
                    screenLines: message.rows,
                  },
                },
              },
            });
          }
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      }),
    });

    await mirror.connect();
    await settleMirror();
    sent.length = 0;

    for (let index = 0; index < 12; index += 1) {
      expect(mirror.scrollViewport(1)).toBe(true);
    }
    await settleMirror();
    await waitUntil(() => mirror.getView().viewportStart === 12);

    const viewportDeltas = sent.filter((message) => message.type === "viewportDelta");
    expect(viewportDeltas).toHaveLength(12);
    expect(viewportDeltas.every((message) => message.deltaRows === 1)).toBe(true);
    expect(sent.some((message) => message.type === "pullFrame")).toBe(true);
    expect(mirror.getView().viewportStart).toBe(12);
    expect(traceEvents.some((event) => event.kind === "client-refresh-requested")).toBe(false);
  });
});
