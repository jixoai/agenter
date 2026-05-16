import { describe, expect, test } from "bun:test";

import {
  applyTerminalFramePatch,
  binaryStringToBytes,
  createTerminalTransportRowCacheDecoder,
  createTerminalTransportRowCacheEncoder,
  createTerminalTransportClientSession,
  decodeTerminalTransportClientMessage,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  encodeTerminalTransportServerMessage,
  getTerminalTransportDirectRegistry,
  type TerminalTransportFramePayload,
  type TerminalTransportClientMessage,
  type TerminalTransportServerMessage,
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
  test("Scenario: Given client live bytes and sideband frames When protobuf roundtrip runs Then opaque terminal input resize truth and both viewport mutation shapes are preserved", () => {
    const inputBytes = encodeTerminalTransportClientMessage({
      type: "inputBytes",
      data: Uint8Array.of(0x1b, 0x5b, 0x41, 0xff),
    });
    const resize = encodeTerminalTransportClientMessage({
      type: "resize",
      cols: 103,
      rows: 27,
    });
    const viewportDelta = encodeTerminalTransportClientMessage({
      type: "viewportDelta",
      deltaRows: -5,
    });
    const viewportTarget = encodeTerminalTransportClientMessage({
      type: "viewportTarget",
      viewportStart: 12,
    });
    const hello = encodeTerminalTransportClientMessage({
      type: "hello",
      terminalId: "shell-2",
      geometryRole: "authority",
      geometryOrder: 3,
      debugTrace: true,
    });
    const pullFrame = encodeTerminalTransportClientMessage({
      type: "pullFrame",
      lastAppliedFrameSeq: 7,
      cols: 103,
      rows: 27,
      maxPatchBytes: 4096,
    });

    expect(decodeTerminalTransportClientMessage(inputBytes)).toEqual({
      type: "inputBytes",
      data: Uint8Array.of(0x1b, 0x5b, 0x41, 0xff),
    });
    const unicodeInput = new TextEncoder().encode("agenter on  main [$✘!?⇡] via 🥟 v1.3.14");
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "inputBytes",
          data: unicodeInput,
        }),
      ),
    ).toEqual({
      type: "inputBytes",
      data: unicodeInput,
    });
    expect(decodeTerminalTransportClientMessage(resize)).toEqual({
      type: "resize",
      cols: 103,
      rows: 27,
    });
    expect(decodeTerminalTransportClientMessage(viewportDelta)).toEqual({
      type: "viewportDelta",
      deltaRows: -5,
    });
    expect(decodeTerminalTransportClientMessage(viewportTarget)).toEqual({
      type: "viewportTarget",
      viewportStart: 12,
    });
    expect(decodeTerminalTransportClientMessage(hello)).toEqual({
      type: "hello",
      terminalId: "shell-2",
      geometryRole: "authority",
      geometryOrder: 3,
      debugTrace: true,
    });
    expect(decodeTerminalTransportClientMessage(pullFrame)).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: 7,
      cols: 103,
      rows: 27,
      maxPatchBytes: 4096,
    });
  });

  test("Scenario: Given server dirty status and frame patches When protobuf roundtrip runs Then client-paced terminal projection truth is preserved", () => {
    const framePayload = {
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
      cursor: { x: 2, y: 1, visible: true, absY: 41 },
      scrollback: {
        viewportOffset: 0,
        totalLines: 2,
        screenLines: 24,
      },
    };
    const dirty = encodeTerminalTransportServerMessage({
      type: "frameDirty",
      terminalId: "term-demo",
      frameSeq: 7,
      reason: "snapshot",
      timestamp: 1234,
    });
    const fullFrame = encodeTerminalTransportServerMessage({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 7,
      status: "BUSY",
      patch: {
        type: "full",
        frame: framePayload,
      },
    });
    const rowsFrame = encodeTerminalTransportServerMessage({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 8,
      status: "BUSY",
      patch: {
        type: "rows",
        baseFrameSeq: 7,
        rowPatches: [
          {
            row: 1,
            line: "next",
            richLine: { spans: [{ text: "next", bg: "#001122" }] },
          },
        ],
        cols: 80,
        rows: 24,
        cursor: { x: 2, y: 1, visible: true, absY: 41 },
        scrollback: {
          viewportOffset: 0,
          totalLines: 2,
          screenLines: 24,
        },
        timestamp: 1235,
      },
    });
    const scrollRowsFrame = encodeTerminalTransportServerMessage({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 9,
      status: "IDLE",
      patch: {
        type: "scrollRows",
        baseFrameSeq: 8,
        deltaRows: 1,
        insertedLines: ["tail"],
        insertedRichLines: [{ spans: [{ text: "tail", fg: "#00ff00" }] }],
        cols: 80,
        rows: 24,
        cursor: { x: 4, y: 2, visible: false, absY: 42 },
        scrollback: {
          viewportOffset: 1,
          totalLines: 3,
          screenLines: 24,
        },
        timestamp: 1236,
      },
    });
    const rowCacheFrame = encodeTerminalTransportServerMessage({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 10,
      status: "IDLE",
      patch: {
        type: "rowCache",
        baseFrameSeq: 9,
        cachedRows: [
          { cid: 0 },
          { cid: 7, line: "cached", richLine: { spans: [{ text: "cached", fg: "#ff00ff" }] } },
          { cid: 7 },
        ],
        cols: 80,
        rows: 3,
        cursor: { x: 1, y: 2, visible: true, absY: 43 },
        scrollback: {
          viewportOffset: 2,
          totalLines: 5,
          screenLines: 3,
        },
        timestamp: 1237,
      },
    });
    const notModifiedFrame = encodeTerminalTransportServerMessage({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 11,
      status: "IDLE",
      patch: {
        type: "notModified",
        baseFrameSeq: 10,
        timestamp: 1238,
      },
    });
    const status = encodeTerminalTransportServerMessage({
      type: "status",
      terminalId: "term-demo",
      running: false,
      status: "IDLE",
    });
    const helloAck = encodeTerminalTransportServerMessage({
      type: "helloAck",
      terminalId: "term-demo",
      attachmentId: "attach-1",
      effectiveGeometryRole: "authority",
      geometryAuthorityAttachmentId: "attach-1",
      geometryOrder: 1,
      authorityReason: "explicit-geometry-order",
    });
    const trace = encodeTerminalTransportServerMessage({
      type: "trace",
      terminalId: "term-demo",
      event: "pull-frame-server",
      fields: {
        frameSeq: 11,
        patchType: "notModified",
        totalMs: 2,
        debug: true,
        queueWaitMs: null,
      },
      timestamp: 1239,
    });

    expect(decodeTerminalTransportServerMessage(dirty)).toEqual({
      type: "frameDirty",
      terminalId: "term-demo",
      frameSeq: 7,
      reason: "snapshot",
      timestamp: 1234,
    });
    expect(decodeTerminalTransportServerMessage(fullFrame)).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 7,
      status: "BUSY",
      patch: {
        type: "full",
        frame: {
          ...framePayload,
          richLines: [
            {
              spans: [{ text: "hello", fg: "#ffffff", bg: undefined, bold: true, underline: false, inverse: false }],
            },
          ],
        },
      },
    });
    expect(decodeTerminalTransportServerMessage(rowsFrame)).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 8,
      status: "BUSY",
      patch: {
        type: "rows",
        baseFrameSeq: 7,
        rowPatches: [
          {
            row: 1,
            line: "next",
            richLine: {
              spans: [{ text: "next", fg: undefined, bg: "#001122", bold: false, underline: false, inverse: false }],
            },
          },
        ],
        cols: 80,
        rows: 24,
        cursor: { x: 2, y: 1, visible: true, absY: 41 },
        scrollback: {
          viewportOffset: 0,
          totalLines: 2,
          screenLines: 24,
        },
        timestamp: 1235,
      },
    });
    expect(decodeTerminalTransportServerMessage(scrollRowsFrame)).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 9,
      status: "IDLE",
      patch: {
        type: "scrollRows",
        baseFrameSeq: 8,
        deltaRows: 1,
        insertedLines: ["tail"],
        insertedRichLines: [
          {
            spans: [{ text: "tail", fg: "#00ff00", bg: undefined, bold: false, underline: false, inverse: false }],
          },
        ],
        cols: 80,
        rows: 24,
        cursor: { x: 4, y: 2, visible: false, absY: 42 },
        scrollback: {
          viewportOffset: 1,
          totalLines: 3,
          screenLines: 24,
        },
        timestamp: 1236,
      },
    });
    expect(decodeTerminalTransportServerMessage(rowCacheFrame)).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 10,
      status: "IDLE",
      patch: {
        type: "rowCache",
        baseFrameSeq: 9,
        cachedRows: [
          { cid: 0, line: undefined, richLine: undefined },
          {
            cid: 7,
            line: "cached",
            richLine: {
              spans: [{ text: "cached", fg: "#ff00ff", bg: undefined, bold: false, underline: false, inverse: false }],
            },
          },
          { cid: 7, line: undefined, richLine: undefined },
        ],
        cols: 80,
        rows: 3,
        cursor: { x: 1, y: 2, visible: true, absY: 43 },
        scrollback: {
          viewportOffset: 2,
          totalLines: 5,
          screenLines: 3,
        },
        timestamp: 1237,
      },
    });
    expect(decodeTerminalTransportServerMessage(notModifiedFrame)).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: 11,
      status: "IDLE",
      patch: {
        type: "notModified",
        baseFrameSeq: 10,
        timestamp: 1238,
      },
    });
    expect(decodeTerminalTransportServerMessage(status)).toEqual({
      type: "status",
      terminalId: "term-demo",
      running: false,
      status: "IDLE",
    });
    expect(decodeTerminalTransportServerMessage(helloAck)).toEqual({
      type: "helloAck",
      terminalId: "term-demo",
      attachmentId: "attach-1",
      effectiveGeometryRole: "authority",
      geometryAuthorityAttachmentId: "attach-1",
      geometryOrder: 1,
      authorityReason: "explicit-geometry-order",
    });
    expect(decodeTerminalTransportServerMessage(trace)).toEqual({
      type: "trace",
      terminalId: "term-demo",
      event: "pull-frame-server",
      fields: {
        frameSeq: 11,
        patchType: "notModified",
        totalMs: 2,
        debug: true,
        queueWaitMs: null,
      },
      timestamp: 1239,
    });
  });

  test("Scenario: Given backend interaction client messages When protobuf roundtrip runs Then owner coordinates and copy intent are preserved", () => {
    const point = { ownerId: "shell", row: 12, col: 8 };
    const range = {
      ownerId: "dialogue",
      startRow: 1,
      startCol: 2,
      endRow: 3,
      endCol: 4,
      rectangular: false,
    };

    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectionStart",
          point,
        }),
      ),
    ).toEqual({
      type: "selectionStart",
      point,
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectionUpdate",
          point: { ...point, col: 14 },
        }),
      ),
    ).toEqual({
      type: "selectionUpdate",
      point: { ...point, col: 14 },
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectionEnd",
          point: { ...point, row: 13 },
        }),
      ),
    ).toEqual({
      type: "selectionEnd",
      point: { ...point, row: 13 },
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectWordAt",
          point,
        }),
      ),
    ).toEqual({
      type: "selectWordAt",
      point,
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectLineAt",
          point,
        }),
      ),
    ).toEqual({
      type: "selectLineAt",
      point,
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "selectRange",
          range,
        }),
      ),
    ).toEqual({
      type: "selectRange",
      range,
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "copySelection",
          ownerId: "dialogue",
        }),
      ),
    ).toEqual({
      type: "copySelection",
      ownerId: "dialogue",
    });
    expect(
      decodeTerminalTransportClientMessage(
        encodeTerminalTransportClientMessage({
          type: "clearSelection",
          ownerId: "shell",
        }),
      ),
    ).toEqual({
      type: "clearSelection",
      ownerId: "shell",
    });
    expect(decodeTerminalTransportClientMessage(encodeTerminalTransportClientMessage({ type: "followCursor" }))).toEqual(
      {
        type: "followCursor",
      },
    );
  });

  test("Scenario: Given backend interaction overlays When frame payloads roundtrip Then projection clients receive backend-owned selection state", () => {
    const frame: TerminalTransportFramePayload = {
      seq: 21,
      timestamp: 2048,
      cols: 20,
      rows: 3,
      lines: ["alpha beta", "中文测试", ""],
      richLines: [
        { spans: [{ text: "alpha beta" }] },
        { spans: [{ text: "中文测试", fg: "#ffffff" }] },
        { spans: [] },
      ],
      cursor: { x: 3, y: 1, visible: true, absY: 9 },
      scrollback: { viewportOffset: 8, totalLines: 11, screenLines: 3 },
      interaction: {
        activeOwnerId: "shell",
        selectionOverlays: [
          {
            ownerId: "shell",
            ownership: "backend-native",
            rows: [
              { row: 8, startCol: 0, endCol: 5 },
              { row: 9, startCol: 0, endCol: 4 },
            ],
            selectedText: "alpha\n中文",
          },
        ],
        capabilities: {
          shell: {
            ownership: "backend-native",
            selection: true,
            copy: true,
            semanticSelection: true,
            cursorFollow: true,
            overlay: true,
          },
        },
      },
    };

    const decoded = decodeTerminalTransportServerMessage(
      encodeTerminalTransportServerMessage({
        type: "frame",
        terminalId: "term-demo",
        frameSeq: frame.seq,
        status: "IDLE",
        patch: {
          type: "full",
          frame,
        },
      }),
    );

    expect(decoded).toEqual({
      type: "frame",
      terminalId: "term-demo",
      frameSeq: frame.seq,
      status: "IDLE",
      patch: {
        type: "full",
        frame: {
          ...frame,
          richLines: [
            { spans: [{ text: "alpha beta", fg: undefined, bg: undefined, bold: false, underline: false, inverse: false }] },
            { spans: [{ text: "中文测试", fg: "#ffffff", bg: undefined, bold: false, underline: false, inverse: false }] },
            { spans: [] },
          ],
        },
      },
    });
    expect(
      decodeTerminalTransportServerMessage(
        encodeTerminalTransportServerMessage({
          type: "selectionText",
          terminalId: "term-demo",
          ownerId: "shell",
          text: "alpha",
        }),
      ),
    ).toEqual({
      type: "selectionText",
      terminalId: "term-demo",
      ownerId: "shell",
      text: "alpha",
    });
  });

  test("Scenario: Given malformed binary or xterm binary strings When decoding Then invalid payloads are rejected and raw bytes stay lossless", () => {
    expect(decodeTerminalTransportClientMessage(Uint8Array.of(0xff, 0x00))).toBeNull();
    expect(decodeTerminalTransportServerMessage(Uint8Array.of(0xff, 0x00))).toBeNull();
    expect(binaryStringToBytes(String.fromCharCode(0xff, 0x00, 0x7f))).toEqual(Uint8Array.of(0xff, 0x00, 0x7f));
  });

  test("Scenario: Given row-cache transport frames When rows repeat or scroll Then cid-only rows decode from the per-connection cache", () => {
    const firstFrame: TerminalTransportFramePayload = {
      seq: 1,
      timestamp: 10,
      cols: 12,
      rows: 4,
      lines: ["alpha", "beta", "", "alpha"],
      richLines: [
        { spans: [{ text: "alpha", fg: "#111111" }] },
        { spans: [{ text: "beta" }] },
        { spans: [] },
        { spans: [{ text: "alpha", fg: "#111111" }] },
      ],
      cursor: { x: 1, y: 0, visible: true },
      scrollback: { viewportOffset: 0, totalLines: 4, screenLines: 4 },
    };
    const secondFrame: TerminalTransportFramePayload = {
      seq: 2,
      timestamp: 11,
      cols: 12,
      rows: 4,
      lines: ["beta", "", "alpha", "gamma"],
      richLines: [
        { spans: [{ text: "beta" }] },
        { spans: [] },
        { spans: [{ text: "alpha", fg: "#111111" }] },
        { spans: [{ text: "gamma", bg: "#222222" }] },
      ],
      cursor: { x: 3, y: 3, visible: true },
      scrollback: { viewportOffset: 1, totalLines: 5, screenLines: 4 },
    };
    const encoder = createTerminalTransportRowCacheEncoder();
    const decoder = createTerminalTransportRowCacheDecoder();

    const firstPatch = encoder.encode(firstFrame);
    expect(firstPatch.type).toBe("rowCache");
    if (firstPatch.type !== "rowCache") {
      throw new Error("expected rowCache patch");
    }
    expect(firstPatch.cachedRows).toEqual([
      { cid: 1, line: "alpha", richLine: { spans: [{ text: "alpha", fg: "#111111" }] } },
      { cid: 2, line: "beta", richLine: { spans: [{ text: "beta" }] } },
      { cid: 0 },
      { cid: 1 },
    ]);
    const decodedFirst = applyTerminalFramePatch(null, firstPatch, firstFrame.seq, decoder);
    expect(decodedFirst).toEqual(firstFrame);

    const secondPatch = encoder.encode(secondFrame);
    expect(secondPatch.type).toBe("rowCache");
    if (secondPatch.type !== "rowCache") {
      throw new Error("expected rowCache patch");
    }
    expect(secondPatch.cachedRows).toEqual([
      { cid: 2 },
      { cid: 0 },
      { cid: 1 },
      { cid: 3, line: "gamma", richLine: { spans: [{ text: "gamma", bg: "#222222" }] } },
    ]);
    const decodedSecond = applyTerminalFramePatch(decodedFirst, secondPatch, secondFrame.seq, decoder);
    expect(decodedSecond).toEqual(secondFrame);

    const notModifiedPatch = encoder.encode({
      ...secondFrame,
      seq: 3,
      timestamp: 12,
    });
    expect(notModifiedPatch).toEqual({
      type: "notModified",
      baseFrameSeq: 2,
      timestamp: 12,
    });
    expect(applyTerminalFramePatch(decodedSecond, notModifiedPatch, 3, decoder)).toEqual(decodedSecond);

    const thirdFrame: TerminalTransportFramePayload = {
      ...secondFrame,
      seq: 4,
      timestamp: 13,
      lines: ["beta", "", "alpha", "delta"],
      richLines: [
        { spans: [{ text: "beta" }] },
        { spans: [] },
        { spans: [{ text: "alpha", fg: "#111111" }] },
        { spans: [{ text: "delta", bg: "#333333" }] },
      ],
    };
    const thirdPatch = encoder.encode(thirdFrame);
    expect(thirdPatch.type).toBe("rowCache");
    if (thirdPatch.type !== "rowCache") {
      throw new Error("expected rowCache patch");
    }
    const decodedThird = applyTerminalFramePatch(decodedSecond, thirdPatch, thirdFrame.seq, decoder);
    expect(decodedThird).toEqual(thirdFrame);
  });

  test("Scenario: Given only backend interaction state changes When row-cache encodes Then style-only selection updates still produce a drawable frame", () => {
    const encoder = createTerminalTransportRowCacheEncoder();
    const baseFrame: TerminalTransportFramePayload = {
      seq: 1,
      timestamp: 10,
      cols: 12,
      rows: 2,
      lines: ["same", "rows"],
      richLines: [{ spans: [{ text: "same" }] }, { spans: [{ text: "rows" }] }],
      cursor: { x: 0, y: 0, visible: true },
      scrollback: { viewportOffset: 0, totalLines: 2, screenLines: 2 },
    };

    const firstPatch = encoder.encode(baseFrame);
    expect(firstPatch.type).toBe("rowCache");

    const selectedPatch = encoder.encode({
      ...baseFrame,
      seq: 2,
      timestamp: 11,
      interaction: {
        activeOwnerId: "shell",
        selectionOverlays: [
          {
            ownerId: "shell",
            ownership: "backend-adapter-owned",
            rows: [{ row: 0, startCol: 0, endCol: 4 }],
          },
        ],
      },
    });
    expect(selectedPatch.type).toBe("rowCache");
    if (selectedPatch.type !== "rowCache") {
      throw new Error("expected interaction change to produce rowCache patch");
    }
    expect(selectedPatch.interaction).toEqual({
      activeOwnerId: "shell",
      selectionOverlays: [
        {
          ownerId: "shell",
          ownership: "backend-adapter-owned",
          rows: [{ row: 0, startCol: 0, endCol: 4 }],
          selectedText: undefined,
        },
      ],
      capabilities: undefined,
    });
  });

  test("Scenario: Given a row-cache patch references an unknown cid When decoding Then the transport rejects the patch instead of drawing stale content", () => {
    const decoder = createTerminalTransportRowCacheDecoder();
    expect(
      applyTerminalFramePatch(
        null,
        {
          type: "rowCache",
          baseFrameSeq: 0,
          cachedRows: [{ cid: 99 }],
          cols: 10,
          rows: 1,
          cursor: { x: 0, y: 0, visible: true },
          scrollback: { viewportOffset: 0, totalLines: 1, screenLines: 1 },
        },
        1,
        decoder,
      ),
    ).toBeNull();
  });

  test("Scenario: Given a connected websocket session When client messages and server frames flow Then the shared transport session preserves bytes-first truth", async () => {
    const socket = new FakeSocket();
    const opened: string[] = [];
    const messages: unknown[] = [];
    const traceEvents: unknown[] = [];
    const session = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      geometryOrder: 4,
      createSocket: () => socket,
      events: {
        onOpen: () => {
          opened.push("open");
        },
        onMessage: (message) => {
          messages.push(message);
        },
        onTrace: (event) => {
          traceEvents.push(event);
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
    const pullSent = session.send({
      type: "pullFrame",
      lastAppliedFrameSeq: 0,
      cols: 80,
      rows: 24,
    });
    socket.emit(
      "message",
      encodeTerminalTransportServerMessage({
        type: "frameDirty",
        terminalId: "shell-1",
        frameSeq: 1,
        reason: "snapshot",
      }).buffer,
    );

    expect(opened).toEqual(["open"]);
    expect(sent).toBe(true);
    expect(pullSent).toBe(true);
    expect(socket.sent).toHaveLength(3);
    expect(decodeTerminalTransportClientMessage(new Uint8Array(socket.sent[0]))).toEqual({
      type: "hello",
      terminalId: undefined,
      geometryRole: "projection-only",
      geometryOrder: 4,
      debugTrace: false,
      runtime: {
        kind: "bun",
        pid: process.pid,
        directRegistryKey: "@agenter/terminal-transport/direct-registry/v1",
      },
      direct: {
        requested: true,
        clientToken: expect.any(String),
      },
    });
    expect(decodeTerminalTransportClientMessage(new Uint8Array(socket.sent[1]))).toEqual({
      type: "inputBytes",
      data: Uint8Array.of(0x65, 0x63, 0x68, 0x6f),
    });
    expect(decodeTerminalTransportClientMessage(new Uint8Array(socket.sent[2]))).toEqual({
      type: "pullFrame",
      lastAppliedFrameSeq: 0,
      cols: 80,
      rows: 24,
      maxPatchBytes: undefined,
    });
    expect(messages).toEqual([
      {
        type: "frameDirty",
        terminalId: "shell-1",
        frameSeq: 1,
        reason: "snapshot",
        timestamp: undefined,
      },
    ]);
    expect(traceEvents).toContainEqual({
      kind: "client-send",
      messageType: "inputBytes",
      byteLength: expect.any(Number),
      dataPlane: "websocket",
    });
    expect(traceEvents).toContainEqual({
      kind: "client-send",
      messageType: "pullFrame",
      byteLength: expect.any(Number),
      dataPlane: "websocket",
    });
    expect(traceEvents).toContainEqual({
      kind: "client-raw-message",
      byteLength: expect.any(Number),
    });
    expect(traceEvents).toContainEqual({
      kind: "client-decode-message",
      messageType: "frameDirty",
      byteLength: expect.any(Number),
      decodeMs: expect.any(Number),
      dataPlane: "websocket",
    });
  });

  test("Scenario: Given same-process direct transport is accepted When the client pulls and sends input Then WebSocket stays the handshake channel and semantic data uses direct functions", async () => {
    const socket = new FakeSocket();
    const directClientMessages: TerminalTransportClientMessage[] = [];
    const messages: TerminalTransportServerMessage[] = [];
    const traceEvents: Array<{ kind: string; messageType?: string; dataPlane?: string; reason?: string }> = [];
    const session = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createSocket: () => socket,
      events: {
        onMessage: (message) => {
          messages.push(message);
        },
        onTrace: (event) => {
          traceEvents.push(event);
        },
      },
    });

    const connectPromise = session.connect();
    socket.readyState = FakeSocket.OPEN;
    socket.emit("open");
    await connectPromise;

    const hello = decodeTerminalTransportClientMessage(new Uint8Array(socket.sent[0]));
    if (hello?.type !== "hello" || !hello.direct) {
      throw new Error("expected direct-capable hello");
    }
    const registry = getTerminalTransportDirectRegistry();
    const upgradeId = "direct-test-upgrade";
    const serverToken = "server-token";
    const unregister = registry?.register({
      upgradeId,
      clientToken: hello.direct.clientToken,
      serverToken,
      acceptClient(input) {
        if (input.clientToken !== hello.direct?.clientToken) {
          return null;
        }
        input.onServerMessage({
          type: "status",
          terminalId: "shell-1",
          running: true,
          status: "IDLE",
        });
        return {
          sendClientMessage(message) {
            directClientMessages.push(message);
            input.onServerMessage({
              type: "frameDirty",
              terminalId: "shell-1",
              frameSeq: directClientMessages.length,
              reason: message.type,
            });
            return true;
          },
          close() {
            input.onClose();
          },
        };
      },
    });
    try {
      socket.emit(
        "message",
        encodeTerminalTransportServerMessage({
          type: "helloAck",
          terminalId: "shell-1",
          attachmentId: "attach-1",
          effectiveGeometryRole: "authority",
          direct: {
            accepted: true,
            upgradeId,
            registryKey: "@agenter/terminal-transport/direct-registry/v1",
            serverToken,
          },
        }).buffer,
      );

      const websocketSendCountAfterUpgrade = socket.sent.length;
      expect(messages).toContainEqual({
        type: "status",
        terminalId: "shell-1",
        running: true,
        status: "IDLE",
      });
      expect(traceEvents).toContainEqual({
        kind: "client-direct-upgrade",
        reason: "connected",
        dataPlane: "direct",
      });

      expect(session.pullFrame({ lastAppliedFrameSeq: 0, cols: 80, rows: 24 })).toBe(true);
      expect(session.sendInputBytes(Uint8Array.of(0x78))).toBe(true);

      expect(socket.sent).toHaveLength(websocketSendCountAfterUpgrade);
      expect(directClientMessages).toEqual([
        {
          type: "pullFrame",
          lastAppliedFrameSeq: 0,
          cols: 80,
          rows: 24,
          maxPatchBytes: undefined,
        },
        {
          type: "inputBytes",
          data: Uint8Array.of(0x78),
        },
      ]);
      expect(traceEvents).toContainEqual({
        kind: "client-send",
        messageType: "pullFrame",
        dataPlane: "direct",
      });
      expect(traceEvents).toContainEqual({
        kind: "client-direct-message",
        messageType: "frameDirty",
        dataPlane: "direct",
      });
    } finally {
      unregister?.();
      session.disconnect();
    }
  });

  test("Scenario: Given debug trace sideband frames When the client receives them Then local raw decode trace does not amplify trace traffic", async () => {
    const socket = new FakeSocket();
    const traceEvents: Array<{
      kind: string;
      messageType?: string;
      byteLength?: number;
      decodeMs?: number;
      dataPlane?: string;
    }> = [];
    const messages: unknown[] = [];
    const session = createTerminalTransportClientSession({
      transportUrl: "ws://127.0.0.1/pty/shell-1",
      createSocket: () => socket,
      events: {
        onMessage: (message) => {
          messages.push(message);
        },
        onTrace: (event) => {
          traceEvents.push(event);
        },
      },
    });

    const connectPromise = session.connect();
    socket.readyState = FakeSocket.OPEN;
    socket.emit("open");
    await connectPromise;

    socket.emit(
      "message",
      encodeTerminalTransportServerMessage({
        type: "trace",
        terminalId: "shell-1",
        event: "transport-diagnostics",
        fields: {
          eventLoopLagMs: 12,
          queuedMessages: 3,
        },
        timestamp: 1234,
      }).buffer,
    );
    socket.emit(
      "message",
      encodeTerminalTransportServerMessage({
        type: "frameDirty",
        terminalId: "shell-1",
        frameSeq: 2,
        reason: "snapshot",
      }).buffer,
    );

    expect(messages).toHaveLength(2);
    expect(traceEvents.filter((event) => event.kind === "client-raw-message")).toHaveLength(1);
    expect(traceEvents.filter((event) => event.kind === "client-decode-message")).toEqual([
      {
        kind: "client-decode-message",
        messageType: "frameDirty",
        byteLength: expect.any(Number),
        decodeMs: expect.any(Number),
        dataPlane: "websocket",
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
