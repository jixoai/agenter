import { create, fromBinary, toBinary } from "@bufbuild/protobuf";

import {
  TerminalClientFrameSchema,
  TerminalServerFrameSchema,
  TerminalSnapshotSchema,
  TerminalStatus as ProtoTerminalStatus,
  type TerminalClientFrame,
  type TerminalSnapshot as ProtoTerminalSnapshot,
  type TerminalServerFrame,
} from "./gen/proto/terminal_transport_pb";

export type TerminalTransportStatus = "IDLE" | "BUSY";

export interface TerminalTransportSnapshot {
  seq: number;
  timestamp?: number;
  cols: number;
  rows: number;
  lines: string[];
  richLines?: Array<{
    spans: Array<{
      text: string;
      fg?: string;
      bg?: string;
      bold?: boolean;
      underline?: boolean;
      inverse?: boolean;
    }>;
  }>;
  cursor: { x: number; y: number };
  cursorVisible?: boolean;
}

export type TerminalTransportClientSideband =
  | {
      type: "resize";
      cols: number;
      rows: number;
    }
  | {
      type: "hello";
      terminalId?: string;
    };

export type TerminalTransportServerSideband =
  | {
      type: "snapshot";
      terminalId: string;
      snapshot: TerminalTransportSnapshot;
      status: TerminalTransportStatus;
    }
  | {
      type: "status";
      terminalId: string;
      running: boolean;
      status: TerminalTransportStatus;
    }
  | {
      type: "error";
      terminalId: string;
      message: string;
    }
  | {
      type: "helloAck";
      terminalId: string;
    };

export type TerminalTransportClientMessage =
  | {
      type: "inputBytes";
      data: Uint8Array;
    }
  | TerminalTransportClientSideband;

export type TerminalTransportServerMessage =
  | {
      type: "outputBytes";
      terminalId: string;
      data: Uint8Array;
    }
  | TerminalTransportServerSideband;

const protoStatusFromDomain = (status: TerminalTransportStatus): ProtoTerminalStatus =>
  status === "BUSY" ? ProtoTerminalStatus.BUSY : ProtoTerminalStatus.IDLE;

const domainStatusFromProto = (status: ProtoTerminalStatus): TerminalTransportStatus | null => {
  switch (status) {
    case ProtoTerminalStatus.IDLE:
      return "IDLE";
    case ProtoTerminalStatus.BUSY:
      return "BUSY";
    default:
      return null;
  }
};

const toProtoSnapshot = (snapshot: TerminalTransportSnapshot): ProtoTerminalSnapshot =>
  create(TerminalSnapshotSchema, {
    seq: snapshot.seq,
    timestamp: snapshot.timestamp,
    cols: snapshot.cols,
    rows: snapshot.rows,
    lines: [...snapshot.lines],
    richLines: (snapshot.richLines ?? []).map((line) => ({
      spans: line.spans.map((span) => ({
        text: span.text,
        fg: span.fg,
        bg: span.bg,
        bold: span.bold ?? false,
        underline: span.underline ?? false,
        inverse: span.inverse ?? false,
      })),
    })),
    cursor: {
      x: snapshot.cursor.x,
      y: snapshot.cursor.y,
    },
    cursorVisible: snapshot.cursorVisible,
  });

const fromProtoSnapshot = (snapshot: ProtoTerminalSnapshot): TerminalTransportSnapshot | null => {
  if (!snapshot?.cursor) {
    return null;
  }
  return {
    seq: snapshot.seq,
    timestamp: snapshot.timestamp,
    cols: snapshot.cols,
    rows: snapshot.rows,
    lines: [...snapshot.lines],
    richLines:
      snapshot.richLines.length > 0
        ? snapshot.richLines.map((line) => ({
            spans: line.spans.map((span) => ({
              text: span.text,
              fg: span.fg,
              bg: span.bg,
              bold: span.bold,
              underline: span.underline,
              inverse: span.inverse,
            })),
          }))
        : undefined,
    cursor: {
      x: snapshot.cursor.x,
      y: snapshot.cursor.y,
    },
    cursorVisible: snapshot.cursorVisible,
  };
};

const normalizeIncomingBytes = (input: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array => {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
};

export const encodeTerminalTransportClientMessage = (message: TerminalTransportClientMessage): Uint8Array => {
  const frame: TerminalClientFrame =
    message.type === "inputBytes"
      ? create(TerminalClientFrameSchema, {
          body: {
            case: "inputBytes",
            value: {
              data: message.data,
            },
          },
        })
      : message.type === "resize"
        ? create(TerminalClientFrameSchema, {
            body: {
              case: "resize",
              value: {
                cols: message.cols,
                rows: message.rows,
              },
            },
          })
        : create(TerminalClientFrameSchema, {
            body: {
              case: "hello",
              value: {
                terminalId: message.terminalId,
              },
            },
          });
  return toBinary(TerminalClientFrameSchema, frame);
};

export const encodeTerminalTransportServerMessage = (message: TerminalTransportServerMessage): Uint8Array => {
  const frame: TerminalServerFrame =
    message.type === "outputBytes"
      ? create(TerminalServerFrameSchema, {
          body: {
            case: "outputBytes",
            value: {
              terminalId: message.terminalId,
              data: message.data,
            },
          },
        })
      : message.type === "snapshot"
        ? create(TerminalServerFrameSchema, {
            body: {
              case: "snapshot",
              value: {
                terminalId: message.terminalId,
                snapshot: toProtoSnapshot(message.snapshot),
                status: protoStatusFromDomain(message.status),
              },
            },
          })
        : message.type === "status"
          ? create(TerminalServerFrameSchema, {
              body: {
                case: "status",
                value: {
                  terminalId: message.terminalId,
                  running: message.running,
                  status: protoStatusFromDomain(message.status),
                },
              },
            })
          : message.type === "error"
            ? create(TerminalServerFrameSchema, {
                body: {
                  case: "error",
                  value: {
                    terminalId: message.terminalId,
                    message: message.message,
                  },
                },
              })
            : create(TerminalServerFrameSchema, {
                body: {
                  case: "helloAck",
                  value: {
                    terminalId: message.terminalId,
                  },
                },
              });
  return toBinary(TerminalServerFrameSchema, frame);
};

export const decodeTerminalTransportClientMessage = (
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
): TerminalTransportClientMessage | null => {
  try {
    const frame = fromBinary(TerminalClientFrameSchema, normalizeIncomingBytes(input));
    switch (frame.body.case) {
      case "inputBytes":
        return {
          type: "inputBytes",
          data: frame.body.value.data,
        };
      case "resize":
        return {
          type: "resize",
          cols: frame.body.value.cols,
          rows: frame.body.value.rows,
        };
      case "hello":
        return {
          type: "hello",
          terminalId: frame.body.value.terminalId,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};

export const decodeTerminalTransportServerMessage = (
  input: ArrayBuffer | ArrayBufferView | Uint8Array,
): TerminalTransportServerMessage | null => {
  try {
    const frame = fromBinary(TerminalServerFrameSchema, normalizeIncomingBytes(input));
    switch (frame.body.case) {
      case "outputBytes":
        return {
          type: "outputBytes",
          terminalId: frame.body.value.terminalId,
          data: frame.body.value.data,
        };
      case "snapshot": {
        const status = domainStatusFromProto(frame.body.value.status);
        const snapshot = frame.body.value.snapshot ? fromProtoSnapshot(frame.body.value.snapshot) : null;
        if (!status || !snapshot) {
          return null;
        }
        return {
          type: "snapshot",
          terminalId: frame.body.value.terminalId,
          snapshot,
          status,
        };
      }
      case "status": {
        const status = domainStatusFromProto(frame.body.value.status);
        if (!status) {
          return null;
        }
        return {
          type: "status",
          terminalId: frame.body.value.terminalId,
          running: frame.body.value.running,
          status,
        };
      }
      case "error":
        return {
          type: "error",
          terminalId: frame.body.value.terminalId,
          message: frame.body.value.message,
        };
      case "helloAck":
        return {
          type: "helloAck",
          terminalId: frame.body.value.terminalId,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};

export const binaryStringToBytes = (input: string): Uint8Array => Uint8Array.from(input, (char) => char.charCodeAt(0) & 0xff);
