import { describe, expect, test } from "bun:test";

import {
  binaryStringToBytes,
  decodeTerminalTransportClientMessage,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  encodeTerminalTransportServerMessage,
} from "../src";

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
});
