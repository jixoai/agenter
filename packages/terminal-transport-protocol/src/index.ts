import { create, fromBinary, toBinary } from "@bufbuild/protobuf";

import {
  TerminalClientFrameSchema,
  TerminalFramePatchSchema,
  TerminalFramePayloadSchema,
  TerminalGeometryRole as ProtoTerminalGeometryRole,
  TerminalInteractionCapabilitiesSchema,
  TerminalInteractionFrameStateSchema,
  TerminalOwnerActionSchema,
  TerminalOwnerCoordinateSchema,
  TerminalServerFrameSchema,
  TerminalSelectionOverlaySchema,
  TerminalSelectionRangeActionSchema,
  TerminalSelectionRangeSchema,
  TerminalSelectionPointActionSchema,
  TerminalStatus as ProtoTerminalStatus,
  TerminalTraceFieldSchema,
  type TerminalClientFrame,
  type TerminalFramePatch as ProtoTerminalFramePatch,
  type TerminalFramePayload as ProtoTerminalFramePayload,
  type TerminalInteractionCapabilities as ProtoTerminalInteractionCapabilities,
  type TerminalInteractionFrameState as ProtoTerminalInteractionFrameState,
  type TerminalOwnerCoordinate as ProtoTerminalOwnerCoordinate,
  type TerminalSelectionOverlay as ProtoTerminalSelectionOverlay,
  type TerminalSelectionRange as ProtoTerminalSelectionRange,
  type TerminalTraceField as ProtoTerminalTraceField,
  type TerminalServerFrame,
} from "./gen/proto/terminal_transport_pb";

export type TerminalTransportStatus = "IDLE" | "BUSY";
export type TerminalTransportGeometryRole = "projection-only" | "authority";
export type TerminalTransportTraceValue = string | number | boolean | null;
export type TerminalTransportRuntimeKind = "bun" | "browser" | "node" | "unknown";

export interface TerminalTransportRichSpan {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface TerminalTransportRichLine {
  spans: TerminalTransportRichSpan[];
}

export interface TerminalTransportFramePayload {
  seq: number;
  timestamp?: number;
  cols: number;
  rows: number;
  lines: string[];
  richLines?: TerminalTransportRichLine[];
  cursor: { x: number; y: number; visible?: boolean; absY?: number };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
  interaction?: TerminalTransportInteractionFrameState;
}

export type TerminalTransportSnapshot = TerminalTransportFramePayload;

export interface TerminalTransportFrameRowPatch {
  row: number;
  line: string;
  richLine?: TerminalTransportRichLine;
}

export interface TerminalTransportFrameCachedRow {
  cid: number;
  line?: string;
  richLine?: TerminalTransportRichLine;
}

export type TerminalTransportFramePatch =
  | {
      type: "full";
      frame: TerminalTransportFramePayload;
    }
  | {
      type: "rows";
      baseFrameSeq: number;
      rowPatches: TerminalTransportFrameRowPatch[];
      cols: number;
      rows: number;
      cursor: TerminalTransportFramePayload["cursor"];
      scrollback: TerminalTransportFramePayload["scrollback"];
      interaction?: TerminalTransportInteractionFrameState;
      timestamp?: number;
    }
  | {
      type: "scrollRows";
      baseFrameSeq: number;
      deltaRows: number;
      insertedLines: string[];
      insertedRichLines?: TerminalTransportRichLine[];
      cols: number;
      rows: number;
      cursor: TerminalTransportFramePayload["cursor"];
      scrollback: TerminalTransportFramePayload["scrollback"];
      interaction?: TerminalTransportInteractionFrameState;
      timestamp?: number;
    }
  | {
      type: "rowCache";
      baseFrameSeq: number;
      cachedRows: TerminalTransportFrameCachedRow[];
      cols: number;
      rows: number;
      cursor: TerminalTransportFramePayload["cursor"];
      scrollback: TerminalTransportFramePayload["scrollback"];
      interaction?: TerminalTransportInteractionFrameState;
      timestamp?: number;
    }
  | {
      type: "notModified";
      baseFrameSeq: number;
      timestamp?: number;
    };

const richLineTextLength = (line: TerminalTransportRichLine | undefined): number =>
  line?.spans.reduce((total, span) => total + span.text.length, 0) ?? 0;

const frameTextLength = (frame: TerminalTransportFramePayload): number =>
  frame.lines.reduce((total, line) => total + line.length, 0) +
  (frame.richLines?.reduce((total, line) => total + richLineTextLength(line), 0) ?? 0);

export const estimateTerminalTransportPatchPayloadBytes = (patch: TerminalTransportFramePatch): number => {
  if (patch.type === "notModified") {
    return 0;
  }
  if (patch.type === "full") {
    return frameTextLength(patch.frame);
  }
  if (patch.type === "rows") {
    return patch.rowPatches.reduce(
      (total, row) => total + row.line.length + richLineTextLength(row.richLine),
      0,
    );
  }
  if (patch.type === "scrollRows") {
    return (
      patch.insertedLines.reduce((total, line) => total + line.length, 0) +
      (patch.insertedRichLines?.reduce((total, line) => total + richLineTextLength(line), 0) ?? 0)
    );
  }
  return patch.cachedRows.reduce(
    (total, row) => total + (row.line?.length ?? 0) + richLineTextLength(row.richLine),
    0,
  );
};

export const estimateTerminalTransportFramePayloadBytes = (frame: TerminalTransportFramePayload): number =>
  frameTextLength(frame);

export type TerminalTransportClientSideband =
  | {
      type: "resize";
      cols: number;
      rows: number;
    }
  | {
      type: "viewportDelta";
      deltaRows: number;
    }
  | {
      type: "viewportTarget";
      viewportStart: number;
    }
  | {
      type: "followCursor";
    }
  | TerminalTransportInteractionClientMessage
  | {
      type: "pullFrame";
      lastAppliedFrameSeq: number;
      cols: number;
      rows: number;
      maxPatchBytes?: number;
    }
  | {
      type: "hello";
      terminalId?: string;
      geometryRole?: TerminalTransportGeometryRole;
      geometryOrder?: number;
      debugTrace?: boolean;
      runtime?: {
        kind: TerminalTransportRuntimeKind;
        pid?: number;
        directRegistryKey?: string;
      };
      direct?: {
        requested: boolean;
        clientToken: string;
      };
    };

export type TerminalTransportInteractionOwnership =
  | "backend-native"
  | "backend-adapter-owned"
  | "unavailable"
  | "host-projection-only";

export interface TerminalTransportInteractionCapabilities {
  ownership: TerminalTransportInteractionOwnership;
  selection: boolean;
  copy: boolean;
  semanticSelection: boolean;
  cursorFollow: boolean;
  overlay: boolean;
  reason?: string;
}

export interface TerminalTransportOwnerCoordinate {
  ownerId: string;
  row: number;
  col: number;
}

export interface TerminalTransportSelectionRange {
  ownerId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  rectangular?: boolean;
}

export interface TerminalTransportSelectionOverlayRow {
  row: number;
  startCol: number;
  endCol: number;
}

export interface TerminalTransportSelectionOverlay {
  ownerId: string;
  ownership: Extract<TerminalTransportInteractionOwnership, "backend-native" | "backend-adapter-owned">;
  rows: TerminalTransportSelectionOverlayRow[];
  selectedText?: string;
}

export interface TerminalTransportInteractionFrameState {
  activeOwnerId?: string;
  selectionOverlays?: TerminalTransportSelectionOverlay[];
  capabilities?: Record<string, TerminalTransportInteractionCapabilities>;
}

export type TerminalTransportPointInteractionClientMessage = {
  [Type in "selectionStart" | "selectionUpdate" | "selectionEnd" | "selectWordAt" | "selectLineAt"]: {
    type: Type;
    point: TerminalTransportOwnerCoordinate;
  };
}["selectionStart" | "selectionUpdate" | "selectionEnd" | "selectWordAt" | "selectLineAt"];

export type TerminalTransportInteractionClientMessage =
  | TerminalTransportPointInteractionClientMessage
  | {
      type: "selectRange";
      range: TerminalTransportSelectionRange;
    }
  | {
      type: "copySelection" | "clearSelection";
      ownerId?: string;
    };

export type TerminalTransportServerSideband =
  | {
      type: "frameDirty";
      terminalId: string;
      frameSeq: number;
      reason: string;
      timestamp?: number;
    }
  | {
      type: "frame";
      terminalId: string;
      frameSeq: number;
      status: TerminalTransportStatus;
      patch: TerminalTransportFramePatch;
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
      attachmentId: string;
      effectiveGeometryRole: TerminalTransportGeometryRole;
      geometryAuthorityAttachmentId?: string;
      geometryOrder?: number;
      authorityReason?: string;
      direct?: {
        accepted: boolean;
        upgradeId?: string;
        registryKey?: string;
        serverToken?: string;
        reason?: string;
      };
    }
  | {
      type: "trace";
      terminalId: string;
      event: string;
      fields: Record<string, TerminalTransportTraceValue>;
      timestamp?: number;
    }
  | {
      type: "selectionText";
      terminalId: string;
      ownerId?: string;
      text: string;
    };

export type TerminalTransportClientMessage =
  | {
      type: "inputBytes";
      data: Uint8Array;
    }
  | TerminalTransportClientSideband;

export type TerminalTransportServerMessage = TerminalTransportServerSideband;

const protoStatusFromDomain = (status: TerminalTransportStatus): ProtoTerminalStatus =>
  status === "BUSY" ? ProtoTerminalStatus.BUSY : ProtoTerminalStatus.IDLE;

const protoGeometryRoleFromDomain = (role: TerminalTransportGeometryRole | undefined): ProtoTerminalGeometryRole =>
  role === "authority"
    ? ProtoTerminalGeometryRole.AUTHORITY
    : ProtoTerminalGeometryRole.PROJECTION_ONLY;

const domainGeometryRoleFromProto = (
  role: ProtoTerminalGeometryRole,
): TerminalTransportGeometryRole | undefined => {
  switch (role) {
    case ProtoTerminalGeometryRole.PROJECTION_ONLY:
      return "projection-only";
    case ProtoTerminalGeometryRole.AUTHORITY:
      return "authority";
    default:
      return undefined;
  }
};

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

const encodeJsonField = (value: unknown): string | undefined => (value === undefined ? undefined : JSON.stringify(value));

const decodeJsonField = (value: string | undefined): unknown => {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isRuntimeKind = (value: unknown): value is TerminalTransportRuntimeKind =>
  value === "bun" || value === "browser" || value === "node" || value === "unknown";

const decodeHelloRuntime = (
  value: string | undefined,
): Extract<TerminalTransportClientMessage, { type: "hello" }>["runtime"] => {
  const decoded = decodeJsonField(value);
  if (typeof decoded !== "object" || decoded === null) {
    return undefined;
  }
  const record = decoded as Record<string, unknown>;
  if (!isRuntimeKind(record.kind)) {
    return undefined;
  }
  return {
    kind: record.kind,
    pid: typeof record.pid === "number" && Number.isFinite(record.pid) ? record.pid : undefined,
    directRegistryKey: typeof record.directRegistryKey === "string" ? record.directRegistryKey : undefined,
  };
};

const decodeHelloDirect = (
  value: string | undefined,
): Extract<TerminalTransportClientMessage, { type: "hello" }>["direct"] => {
  const decoded = decodeJsonField(value);
  if (typeof decoded !== "object" || decoded === null) {
    return undefined;
  }
  const record = decoded as Record<string, unknown>;
  return {
    requested: record.requested === true,
    clientToken: typeof record.clientToken === "string" ? record.clientToken : "",
  };
};

const decodeHelloAckDirect = (
  value: string | undefined,
): Extract<TerminalTransportServerMessage, { type: "helloAck" }>["direct"] => {
  const decoded = decodeJsonField(value);
  if (typeof decoded !== "object" || decoded === null) {
    return undefined;
  }
  const record = decoded as Record<string, unknown>;
  return {
    accepted: record.accepted === true,
    upgradeId: typeof record.upgradeId === "string" ? record.upgradeId : undefined,
    registryKey: typeof record.registryKey === "string" ? record.registryKey : undefined,
    serverToken: typeof record.serverToken === "string" ? record.serverToken : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
  };
};

const isTransportInteractionOwnership = (value: string): value is TerminalTransportInteractionOwnership =>
  value === "backend-native" ||
  value === "backend-adapter-owned" ||
  value === "unavailable" ||
  value === "host-projection-only";

const isOverlayOwnership = (
  value: string,
): value is Extract<TerminalTransportInteractionOwnership, "backend-native" | "backend-adapter-owned"> =>
  value === "backend-native" || value === "backend-adapter-owned";

const cloneInteractionCapabilities = (
  capabilities: TerminalTransportInteractionCapabilities,
): TerminalTransportInteractionCapabilities => ({ ...capabilities });

const cloneSelectionOverlay = (
  overlay: TerminalTransportSelectionOverlay,
): TerminalTransportSelectionOverlay => ({
  ownerId: overlay.ownerId,
  ownership: overlay.ownership,
  rows: overlay.rows.map((row) => ({ ...row })),
  selectedText: overlay.selectedText,
});

const cloneInteractionFrameState = (
  state: TerminalTransportInteractionFrameState | undefined,
): TerminalTransportInteractionFrameState | undefined =>
  state
    ? {
        activeOwnerId: state.activeOwnerId,
        selectionOverlays: state.selectionOverlays?.map(cloneSelectionOverlay),
        capabilities: state.capabilities
          ? Object.fromEntries(
              Object.entries(state.capabilities).map(([ownerId, capabilities]) => [
                ownerId,
                cloneInteractionCapabilities(capabilities),
              ]),
            )
          : undefined,
      }
    : undefined;

const toProtoInteractionCapabilities = (capabilities: TerminalTransportInteractionCapabilities) =>
  create(TerminalInteractionCapabilitiesSchema, {
    ownership: capabilities.ownership,
    selection: capabilities.selection,
    copy: capabilities.copy,
    semanticSelection: capabilities.semanticSelection,
    cursorFollow: capabilities.cursorFollow,
    overlay: capabilities.overlay,
    reason: capabilities.reason,
  });

const fromProtoInteractionCapabilities = (
  capabilities: ProtoTerminalInteractionCapabilities | undefined,
): TerminalTransportInteractionCapabilities | null => {
  if (!capabilities || !isTransportInteractionOwnership(capabilities.ownership)) {
    return null;
  }
  return {
    ownership: capabilities.ownership,
    selection: capabilities.selection,
    copy: capabilities.copy,
    semanticSelection: capabilities.semanticSelection,
    cursorFollow: capabilities.cursorFollow,
    overlay: capabilities.overlay,
    reason: capabilities.reason,
  };
};

const toProtoSelectionOverlay = (overlay: TerminalTransportSelectionOverlay) =>
  create(TerminalSelectionOverlaySchema, {
    ownerId: overlay.ownerId,
    ownership: overlay.ownership,
    rows: overlay.rows.map((row) => ({
      row: row.row,
      startCol: row.startCol,
      endCol: row.endCol,
    })),
    selectedText: overlay.selectedText,
  });

const fromProtoSelectionOverlay = (
  overlay: ProtoTerminalSelectionOverlay,
): TerminalTransportSelectionOverlay | null => {
  if (!overlay.ownerId || !isOverlayOwnership(overlay.ownership)) {
    return null;
  }
  return {
    ownerId: overlay.ownerId,
    ownership: overlay.ownership,
    rows: overlay.rows.map((row) => ({
      row: row.row,
      startCol: row.startCol,
      endCol: row.endCol,
    })),
    selectedText: overlay.selectedText,
  };
};

const toProtoInteractionFrameState = (state: TerminalTransportInteractionFrameState | undefined) =>
  state
    ? create(TerminalInteractionFrameStateSchema, {
        activeOwnerId: state.activeOwnerId,
        selectionOverlays: (state.selectionOverlays ?? []).map(toProtoSelectionOverlay),
        capabilities: Object.entries(state.capabilities ?? {}).map(([ownerId, capabilities]) => ({
          ownerId,
          capabilities: toProtoInteractionCapabilities(capabilities),
        })),
      })
    : undefined;

const fromProtoInteractionFrameState = (
  state: ProtoTerminalInteractionFrameState | undefined,
): TerminalTransportInteractionFrameState | undefined => {
  if (!state) {
    return undefined;
  }
  const selectionOverlays = state.selectionOverlays
    .map(fromProtoSelectionOverlay)
    .filter((overlay): overlay is TerminalTransportSelectionOverlay => overlay !== null);
  const capabilityEntries = state.capabilities
    .map((entry): [string, TerminalTransportInteractionCapabilities] | null => {
      if (!entry.ownerId) {
        return null;
      }
      const capabilities = fromProtoInteractionCapabilities(entry.capabilities);
      return capabilities ? [entry.ownerId, capabilities] : null;
    })
    .filter((entry): entry is [string, TerminalTransportInteractionCapabilities] => entry !== null);
  return {
    activeOwnerId: state.activeOwnerId,
    selectionOverlays: selectionOverlays.length > 0 ? selectionOverlays : undefined,
    capabilities: capabilityEntries.length > 0 ? Object.fromEntries(capabilityEntries) : undefined,
  };
};

const toProtoOwnerCoordinate = (point: TerminalTransportOwnerCoordinate) =>
  create(TerminalOwnerCoordinateSchema, {
    ownerId: point.ownerId,
    row: point.row,
    col: point.col,
  });

const fromProtoOwnerCoordinate = (
  point: ProtoTerminalOwnerCoordinate | undefined,
): TerminalTransportOwnerCoordinate | null =>
  point && point.ownerId
    ? {
        ownerId: point.ownerId,
        row: point.row,
        col: point.col,
      }
    : null;

const toProtoSelectionRange = (range: TerminalTransportSelectionRange) =>
  create(TerminalSelectionRangeSchema, {
    ownerId: range.ownerId,
    startRow: range.startRow,
    startCol: range.startCol,
    endRow: range.endRow,
    endCol: range.endCol,
    rectangular: range.rectangular === true,
  });

const fromProtoSelectionRange = (
  range: ProtoTerminalSelectionRange | undefined,
): TerminalTransportSelectionRange | null =>
  range && range.ownerId
    ? {
        ownerId: range.ownerId,
        startRow: range.startRow,
        startCol: range.startCol,
        endRow: range.endRow,
        endCol: range.endCol,
        rectangular: range.rectangular,
      }
    : null;

const toProtoFramePayload = (frame: TerminalTransportFramePayload): ProtoTerminalFramePayload =>
  create(TerminalFramePayloadSchema, {
    seq: frame.seq,
    timestamp: frame.timestamp,
    cols: frame.cols,
    rows: frame.rows,
    lines: [...frame.lines],
    richLines: (frame.richLines ?? []).map((line) => ({
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
      x: frame.cursor.x,
      y: frame.cursor.y,
      visible: frame.cursor.visible,
      absY: frame.cursor.absY,
    },
    scrollback: {
      viewportOffset: frame.scrollback.viewportOffset,
      totalLines: frame.scrollback.totalLines,
      screenLines: frame.scrollback.screenLines,
    },
    interaction: toProtoInteractionFrameState(frame.interaction),
  });

const fromProtoRichLine = (line: NonNullable<ProtoTerminalFramePayload["richLines"]>[number]): TerminalTransportRichLine => ({
  spans: line.spans.map((span) => ({
    text: span.text,
    fg: span.fg,
    bg: span.bg,
    bold: span.bold,
    underline: span.underline,
    inverse: span.inverse,
  })),
});

const fromProtoCursor = (
  cursor: NonNullable<ProtoTerminalFramePayload["cursor"]>,
): TerminalTransportFramePayload["cursor"] => ({
  x: cursor.x,
  y: cursor.y,
  visible: cursor.visible,
  absY: cursor.absY,
});

const fromProtoScrollback = (
  scrollback: NonNullable<ProtoTerminalFramePayload["scrollback"]>,
): TerminalTransportFramePayload["scrollback"] => ({
  viewportOffset: scrollback.viewportOffset,
  totalLines: scrollback.totalLines,
  screenLines: scrollback.screenLines,
});

const fromProtoFramePayload = (frame: ProtoTerminalFramePayload): TerminalTransportFramePayload | null => {
  if (!frame?.cursor || !frame?.scrollback) {
    return null;
  }
  return {
    seq: frame.seq,
    timestamp: frame.timestamp,
    cols: frame.cols,
    rows: frame.rows,
    lines: [...frame.lines],
    richLines: frame.richLines.length > 0 ? frame.richLines.map(fromProtoRichLine) : undefined,
    cursor: fromProtoCursor(frame.cursor),
    scrollback: fromProtoScrollback(frame.scrollback),
    interaction: fromProtoInteractionFrameState(frame.interaction),
  };
};

const toProtoTraceField = ([key, value]: [string, TerminalTransportTraceValue]): ProtoTerminalTraceField => {
  if (typeof value === "string") {
    return create(TerminalTraceFieldSchema, {
      key,
      value: {
        case: "stringValue",
        value,
      },
    });
  }
  if (typeof value === "number") {
    return create(TerminalTraceFieldSchema, {
      key,
      value: {
        case: "numberValue",
        value,
      },
    });
  }
  if (typeof value === "boolean") {
    return create(TerminalTraceFieldSchema, {
      key,
      value: {
        case: "boolValue",
        value,
      },
    });
  }
  return create(TerminalTraceFieldSchema, {
    key,
    value: {
      case: "nullValue",
      value: true,
    },
  });
};

const fromProtoTraceField = (field: ProtoTerminalTraceField): [string, TerminalTransportTraceValue] | null => {
  if (!field.key) {
    return null;
  }
  switch (field.value.case) {
    case "stringValue":
    case "numberValue":
    case "boolValue":
      return [field.key, field.value.value];
    case "nullValue":
      return [field.key, null];
    default:
      return null;
  }
};

const toProtoRichLine = (line: TerminalTransportRichLine) => ({
  spans: line.spans.map((span) => ({
    text: span.text,
    fg: span.fg,
    bg: span.bg,
    bold: span.bold ?? false,
    underline: span.underline ?? false,
    inverse: span.inverse ?? false,
  })),
});

const toProtoFramePatch = (patch: TerminalTransportFramePatch): ProtoTerminalFramePatch => {
  if (patch.type === "full") {
    return create(TerminalFramePatchSchema, {
      body: {
        case: "full",
        value: {
          frame: toProtoFramePayload(patch.frame),
        },
      },
    });
  }
  if (patch.type === "rows") {
    return create(TerminalFramePatchSchema, {
      body: {
        case: "rows",
        value: {
          baseFrameSeq: patch.baseFrameSeq,
          rowPatches: patch.rowPatches.map((rowPatch) => ({
            row: rowPatch.row,
            line: rowPatch.line,
            richLine: rowPatch.richLine ? toProtoRichLine(rowPatch.richLine) : undefined,
          })),
          cols: patch.cols,
          rows: patch.rows,
          cursor: { ...patch.cursor },
          scrollback: { ...patch.scrollback },
          interaction: toProtoInteractionFrameState(patch.interaction),
          timestamp: patch.timestamp,
        },
      },
    });
  }
  if (patch.type === "scrollRows") {
    return create(TerminalFramePatchSchema, {
      body: {
        case: "scrollRows",
        value: {
          baseFrameSeq: patch.baseFrameSeq,
          deltaRows: patch.deltaRows,
          insertedLines: [...patch.insertedLines],
          insertedRichLines: (patch.insertedRichLines ?? []).map(toProtoRichLine),
          cols: patch.cols,
          rows: patch.rows,
          cursor: { ...patch.cursor },
          scrollback: { ...patch.scrollback },
          interaction: toProtoInteractionFrameState(patch.interaction),
          timestamp: patch.timestamp,
        },
      },
    });
  }
  if (patch.type === "rowCache") {
    return create(TerminalFramePatchSchema, {
      body: {
        case: "rowCache",
        value: {
          baseFrameSeq: patch.baseFrameSeq,
          cachedRows: patch.cachedRows.map((row) => ({
            cid: row.cid,
            line: row.line,
            richLine: row.richLine ? toProtoRichLine(row.richLine) : undefined,
          })),
          cols: patch.cols,
          rows: patch.rows,
          cursor: { ...patch.cursor },
          scrollback: { ...patch.scrollback },
          interaction: toProtoInteractionFrameState(patch.interaction),
          timestamp: patch.timestamp,
        },
      },
    });
  }
  return create(TerminalFramePatchSchema, {
    body: {
      case: "notModified",
      value: {
        baseFrameSeq: patch.baseFrameSeq,
        timestamp: patch.timestamp,
      },
    },
  });
};

const cloneRichLine = (line: TerminalTransportRichLine): TerminalTransportRichLine => ({
  spans: line.spans.map((span) => ({ ...span })),
});

const cloneCachedRow = (row: TerminalTransportFrameCachedRow): TerminalTransportFrameCachedRow => ({
  cid: row.cid,
  line: row.line,
  richLine: row.richLine ? cloneRichLine(row.richLine) : undefined,
});

const cloneFramePayload = (frame: TerminalTransportFramePayload): TerminalTransportFramePayload => ({
  seq: frame.seq,
  timestamp: frame.timestamp,
  cols: frame.cols,
  rows: frame.rows,
  lines: [...frame.lines],
  richLines: frame.richLines?.map(cloneRichLine),
  cursor: { ...frame.cursor },
  scrollback: { ...frame.scrollback },
  interaction: cloneInteractionFrameState(frame.interaction),
});

export const cloneTerminalTransportFramePayload = cloneFramePayload;

const EMPTY_ROW_CID = 0;
const RICH_LINE_SEPARATOR = "\u0000";

const richLineKey = (line: TerminalTransportRichLine | undefined): string =>
  JSON.stringify(
    line?.spans.map((span) => [
      span.text,
      span.fg ?? "",
      span.bg ?? "",
      span.bold === true,
      span.underline === true,
      span.inverse === true,
    ]) ?? [],
  );

const isEmptyRichLine = (line: TerminalTransportRichLine | undefined): boolean =>
  !line || line.spans.length === 0;

const isEmptyTransportRow = (line: string, richLine: TerminalTransportRichLine | undefined): boolean =>
  line.length === 0 && isEmptyRichLine(richLine);

const rowCodeFor = (line: string, richLine: TerminalTransportRichLine | undefined): string =>
  `${line}${RICH_LINE_SEPARATOR}${richLineKey(richLine)}`;

const frameRowToCachedContent = (
  frame: TerminalTransportFramePayload,
  rowIndex: number,
): { line: string; richLine?: TerminalTransportRichLine } => {
  const line = frame.lines[rowIndex] ?? "";
  const richLine = frame.richLines?.[rowIndex] ? cloneRichLine(frame.richLines[rowIndex]) : undefined;
  return richLine ? { line, richLine } : { line };
};

export interface TerminalTransportRowCacheEncoder {
  encode(frame: TerminalTransportFramePayload): Extract<
    TerminalTransportFramePatch,
    { type: "rowCache" } | { type: "notModified" }
  >;
  reset(): void;
}

export interface TerminalTransportRowCacheDecoder {
  apply(
    patch: Extract<TerminalTransportFramePatch, { type: "rowCache" }>,
    frameSeq: number,
  ): TerminalTransportFramePayload | null;
  reset(): void;
}

export const createTerminalTransportRowCacheEncoder = (): TerminalTransportRowCacheEncoder => {
  let previousRowCodeToCid = new Map<string, number>();
  let nextCid = 1;
  let lastRowCacheFrameSeq = 0;
  let lastVisibleKey = "";

  return {
    encode(frame) {
      const currentRowCodeToCid = new Map<string, number>();
      const rowCodes: string[] = [];
      const cachedRows = frame.lines.map((line, rowIndex): TerminalTransportFrameCachedRow => {
        const richLine = frame.richLines?.[rowIndex];
        if (isEmptyTransportRow(line, richLine)) {
          rowCodes.push("");
          return { cid: EMPTY_ROW_CID };
        }
        const rowCode = rowCodeFor(line, richLine);
        rowCodes.push(rowCode);
        const knownCid = previousRowCodeToCid.get(rowCode) ?? currentRowCodeToCid.get(rowCode);
        if (knownCid !== undefined) {
          currentRowCodeToCid.set(rowCode, knownCid);
          return { cid: knownCid };
        }
        const cid = nextCid;
        nextCid += 1;
        currentRowCodeToCid.set(rowCode, cid);
        return { cid, ...frameRowToCachedContent(frame, rowIndex) };
      });
      previousRowCodeToCid = currentRowCodeToCid;
      const visibleKey = JSON.stringify({
        rowCodes,
        cols: frame.cols,
        rows: frame.rows,
        cursor: frame.cursor,
        scrollback: frame.scrollback,
        interaction: frame.interaction,
      });
      if (visibleKey === lastVisibleKey) {
        const patch: Extract<TerminalTransportFramePatch, { type: "notModified" }> = {
          type: "notModified",
          baseFrameSeq: lastRowCacheFrameSeq,
          timestamp: frame.timestamp,
        };
        return patch;
      }
      lastVisibleKey = visibleKey;
      const patch: Extract<TerminalTransportFramePatch, { type: "rowCache" }> = {
        type: "rowCache",
        baseFrameSeq: lastRowCacheFrameSeq,
        cachedRows,
        cols: frame.cols,
        rows: frame.rows,
        cursor: { ...frame.cursor },
        scrollback: { ...frame.scrollback },
        interaction: cloneInteractionFrameState(frame.interaction),
        timestamp: frame.timestamp,
      };
      lastRowCacheFrameSeq = frame.seq;
      return patch;
    },
    reset() {
      previousRowCodeToCid = new Map<string, number>();
      nextCid = 1;
      lastRowCacheFrameSeq = 0;
      lastVisibleKey = "";
    },
  };
};

export const createTerminalTransportRowCacheDecoder = (): TerminalTransportRowCacheDecoder => {
  let previousRowsByCid = new Map<number, { line: string; richLine?: TerminalTransportRichLine }>();
  let lastAppliedFrameSeq = 0;

  return {
    apply(patch, frameSeq) {
      if (patch.baseFrameSeq !== lastAppliedFrameSeq) {
        return null;
      }
      const nextRowsByCid = new Map<number, { line: string; richLine?: TerminalTransportRichLine }>();
      const lines: string[] = [];
      const richLines: TerminalTransportRichLine[] = [];
      let hasRichLines = false;
      for (const cachedRow of patch.cachedRows) {
        const row = cloneCachedRow(cachedRow);
        const cid = Math.trunc(row.cid);
        if (!Number.isFinite(cid) || cid < 0) {
          return null;
        }
        const hasContent = row.line !== undefined || row.richLine !== undefined;
        const resolved =
          cid === EMPTY_ROW_CID && !hasContent
            ? { line: "" }
            : hasContent
              ? { line: row.line ?? "", richLine: row.richLine }
              : nextRowsByCid.get(cid) ?? previousRowsByCid.get(cid);
        if (!resolved) {
          return null;
        }
        lines.push(resolved.line);
        const resolvedRichLine = resolved.richLine ? cloneRichLine(resolved.richLine) : { spans: [] };
        richLines.push(resolvedRichLine);
        if (resolvedRichLine.spans.length > 0) {
          hasRichLines = true;
        }
        if (cid !== EMPTY_ROW_CID) {
          nextRowsByCid.set(cid, {
            line: resolved.line,
            richLine: resolved.richLine ? cloneRichLine(resolved.richLine) : undefined,
          });
        }
      }
      previousRowsByCid = nextRowsByCid;
      lastAppliedFrameSeq = frameSeq;
      return {
        seq: frameSeq,
        timestamp: patch.timestamp,
        cols: patch.cols,
        rows: patch.rows,
        lines,
        richLines: hasRichLines ? richLines : undefined,
        cursor: { ...patch.cursor },
        scrollback: { ...patch.scrollback },
        interaction: cloneInteractionFrameState(patch.interaction),
      };
    },
    reset() {
      previousRowsByCid = new Map<number, { line: string; richLine?: TerminalTransportRichLine }>();
      lastAppliedFrameSeq = 0;
    },
  };
};

export const applyTerminalFramePatch = (
  base: TerminalTransportFramePayload | null,
  patch: TerminalTransportFramePatch,
  frameSeq: number,
  rowCacheDecoder?: TerminalTransportRowCacheDecoder,
): TerminalTransportFramePayload | null => {
  if (patch.type === "full") {
    return cloneFramePayload(patch.frame);
  }
  if (patch.type === "rowCache") {
    return rowCacheDecoder?.apply(patch, frameSeq) ?? null;
  }
  if (patch.type === "notModified") {
    return base && base.seq === patch.baseFrameSeq ? cloneFramePayload(base) : null;
  }
  if (!base || base.seq !== patch.baseFrameSeq) {
    return null;
  }
  if (patch.type === "rows") {
    const lines = [...base.lines];
    const richLines = base.richLines?.map(cloneRichLine);
    for (const rowPatch of patch.rowPatches) {
      lines[rowPatch.row] = rowPatch.line;
      if (richLines && rowPatch.richLine) {
        richLines[rowPatch.row] = cloneRichLine(rowPatch.richLine);
      }
    }
    return {
      seq: frameSeq,
      timestamp: patch.timestamp,
      cols: patch.cols,
      rows: patch.rows,
      lines,
      richLines,
      cursor: { ...patch.cursor },
      scrollback: { ...patch.scrollback },
      interaction: cloneInteractionFrameState(patch.interaction),
    };
  }
  const delta = Math.trunc(patch.deltaRows);
  const lines =
    delta > 0
      ? [...base.lines.slice(delta), ...patch.insertedLines]
      : delta < 0
        ? [...patch.insertedLines, ...base.lines.slice(0, Math.max(0, base.lines.length + delta))]
        : [...base.lines];
  const richLines =
    base.richLines && patch.insertedRichLines
      ? delta > 0
        ? [...base.richLines.slice(delta).map(cloneRichLine), ...patch.insertedRichLines.map(cloneRichLine)]
        : delta < 0
          ? [
              ...patch.insertedRichLines.map(cloneRichLine),
              ...base.richLines.slice(0, Math.max(0, base.richLines.length + delta)).map(cloneRichLine),
            ]
          : base.richLines.map(cloneRichLine)
      : undefined;
  return {
    seq: frameSeq,
    timestamp: patch.timestamp,
    cols: patch.cols,
    rows: patch.rows,
    lines,
    richLines,
    cursor: { ...patch.cursor },
    scrollback: { ...patch.scrollback },
    interaction: cloneInteractionFrameState(patch.interaction),
  };
};

const fromProtoFramePatch = (patch: ProtoTerminalFramePatch | undefined): TerminalTransportFramePatch | null => {
  if (!patch) {
    return null;
  }
  switch (patch.body.case) {
    case "full": {
      const frame = patch.body.value.frame ? fromProtoFramePayload(patch.body.value.frame) : null;
      return frame ? { type: "full", frame } : null;
    }
    case "rows":
      if (!patch.body.value.cursor || !patch.body.value.scrollback) {
        return null;
      }
      return {
        type: "rows",
        baseFrameSeq: patch.body.value.baseFrameSeq,
        rowPatches: patch.body.value.rowPatches.map((rowPatch) => ({
          row: rowPatch.row,
          line: rowPatch.line,
          richLine: rowPatch.richLine ? fromProtoRichLine(rowPatch.richLine) : undefined,
        })),
        cols: patch.body.value.cols,
        rows: patch.body.value.rows,
        cursor: fromProtoCursor(patch.body.value.cursor),
        scrollback: fromProtoScrollback(patch.body.value.scrollback),
        interaction: fromProtoInteractionFrameState(patch.body.value.interaction),
        timestamp: patch.body.value.timestamp,
      };
    case "scrollRows":
      if (!patch.body.value.cursor || !patch.body.value.scrollback) {
        return null;
      }
      return {
        type: "scrollRows",
        baseFrameSeq: patch.body.value.baseFrameSeq,
        deltaRows: patch.body.value.deltaRows,
        insertedLines: [...patch.body.value.insertedLines],
        insertedRichLines:
          patch.body.value.insertedRichLines.length > 0
            ? patch.body.value.insertedRichLines.map(fromProtoRichLine)
            : undefined,
        cols: patch.body.value.cols,
        rows: patch.body.value.rows,
        cursor: fromProtoCursor(patch.body.value.cursor),
        scrollback: fromProtoScrollback(patch.body.value.scrollback),
        interaction: fromProtoInteractionFrameState(patch.body.value.interaction),
        timestamp: patch.body.value.timestamp,
      };
    case "rowCache":
      if (!patch.body.value.cursor || !patch.body.value.scrollback) {
        return null;
      }
      return {
        type: "rowCache",
        baseFrameSeq: patch.body.value.baseFrameSeq,
        cachedRows: patch.body.value.cachedRows.map((row) => ({
          cid: row.cid,
          line: row.line,
          richLine: row.richLine ? fromProtoRichLine(row.richLine) : undefined,
        })),
        cols: patch.body.value.cols,
        rows: patch.body.value.rows,
        cursor: fromProtoCursor(patch.body.value.cursor),
        scrollback: fromProtoScrollback(patch.body.value.scrollback),
        interaction: fromProtoInteractionFrameState(patch.body.value.interaction),
        timestamp: patch.body.value.timestamp,
      };
    case "notModified":
      return {
        type: "notModified",
        baseFrameSeq: patch.body.value.baseFrameSeq,
        timestamp: patch.body.value.timestamp,
      };
    default:
      return null;
  }
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

const encodePointAction = (
  message: Extract<
    TerminalTransportInteractionClientMessage,
    { type: "selectionStart" | "selectionUpdate" | "selectionEnd" | "selectWordAt" | "selectLineAt" }
  >,
): TerminalClientFrame => {
  const caseName = message.type;
  return create(TerminalClientFrameSchema, {
    body: {
      case: caseName,
      value: create(TerminalSelectionPointActionSchema, {
        point: toProtoOwnerCoordinate(message.point),
      }),
    },
  });
};

export const encodeTerminalTransportClientMessage = (message: TerminalTransportClientMessage): Uint8Array => {
  let frame: TerminalClientFrame;
  switch (message.type) {
    case "inputBytes":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "inputBytes",
          value: {
            data: message.data,
          },
        },
      });
      break;
    case "resize":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "resize",
          value: {
            cols: message.cols,
            rows: message.rows,
          },
        },
      });
      break;
    case "viewportDelta":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "viewportDelta",
          value: {
            deltaRows: message.deltaRows,
          },
        },
      });
      break;
    case "viewportTarget":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "viewportTarget",
          value: {
            viewportStart: message.viewportStart,
          },
        },
      });
      break;
    case "followCursor":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "followCursor",
          value: {},
        },
      });
      break;
    case "selectionStart":
    case "selectionUpdate":
    case "selectionEnd":
    case "selectWordAt":
    case "selectLineAt":
      frame = encodePointAction(message);
      break;
    case "selectRange":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "selectRange",
          value: create(TerminalSelectionRangeActionSchema, {
            range: toProtoSelectionRange(message.range),
          }),
        },
      });
      break;
    case "copySelection":
    case "clearSelection":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: message.type,
          value: create(TerminalOwnerActionSchema, {
            ownerId: message.ownerId,
          }),
        },
      });
      break;
    case "hello":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "hello",
          value: {
            terminalId: message.terminalId,
            geometryRole: protoGeometryRoleFromDomain(message.geometryRole),
            geometryOrder: message.geometryOrder,
            debugTrace: message.debugTrace ?? false,
            runtimeJson: encodeJsonField(message.runtime),
            directJson: encodeJsonField(message.direct),
          },
        },
      });
      break;
    case "pullFrame":
      frame = create(TerminalClientFrameSchema, {
        body: {
          case: "pullFrame",
          value: {
            lastAppliedFrameSeq: message.lastAppliedFrameSeq,
            cols: message.cols,
            rows: message.rows,
            maxPatchBytes: message.maxPatchBytes,
          },
        },
      });
      break;
    default:
      message satisfies never;
      frame = create(TerminalClientFrameSchema);
  }
  return toBinary(TerminalClientFrameSchema, frame);
};

export const encodeTerminalTransportServerMessage = (message: TerminalTransportServerMessage): Uint8Array => {
  const frame: TerminalServerFrame =
    message.type === "frameDirty"
      ? create(TerminalServerFrameSchema, {
          body: {
            case: "frameDirty",
            value: {
              terminalId: message.terminalId,
              frameSeq: message.frameSeq,
              reason: message.reason,
              timestamp: message.timestamp,
            },
          },
        })
      : message.type === "frame"
        ? create(TerminalServerFrameSchema, {
            body: {
              case: "frame",
              value: {
                terminalId: message.terminalId,
                frameSeq: message.frameSeq,
                status: protoStatusFromDomain(message.status),
                patch: toProtoFramePatch(message.patch),
              },
            },
          })
        : message.type === "selectionText"
          ? create(TerminalServerFrameSchema, {
              body: {
                case: "selectionText",
                value: {
                  terminalId: message.terminalId,
                  ownerId: message.ownerId,
                  text: message.text,
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
            : message.type === "trace"
              ? create(TerminalServerFrameSchema, {
                  body: {
                    case: "trace",
                    value: {
                      terminalId: message.terminalId,
                      event: message.event,
                      fields: Object.entries(message.fields).map(toProtoTraceField),
                      timestamp: message.timestamp,
                    },
                  },
                })
              : create(TerminalServerFrameSchema, {
                  body: {
                    case: "helloAck",
                    value: {
                      terminalId: message.terminalId,
                      attachmentId: message.attachmentId,
                      effectiveGeometryRole: protoGeometryRoleFromDomain(message.effectiveGeometryRole),
                      geometryAuthorityAttachmentId: message.geometryAuthorityAttachmentId,
                      geometryOrder: message.geometryOrder,
                      authorityReason: message.authorityReason,
                      directJson: encodeJsonField(message.direct),
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
      case "viewportDelta":
        return {
          type: "viewportDelta",
          deltaRows: frame.body.value.deltaRows,
        };
      case "viewportTarget":
        return {
          type: "viewportTarget",
          viewportStart: frame.body.value.viewportStart,
        };
      case "followCursor":
        return {
          type: "followCursor",
        };
      case "selectionStart":
      case "selectionUpdate":
      case "selectionEnd":
      case "selectWordAt":
      case "selectLineAt": {
        const point = fromProtoOwnerCoordinate(frame.body.value.point);
        return point ? { type: frame.body.case, point } : null;
      }
      case "selectRange": {
        const range = fromProtoSelectionRange(frame.body.value.range);
        return range ? { type: "selectRange", range } : null;
      }
      case "copySelection":
        return {
          type: "copySelection",
          ownerId: frame.body.value.ownerId,
        };
      case "clearSelection":
        return {
          type: "clearSelection",
          ownerId: frame.body.value.ownerId,
        };
      case "pullFrame":
        return {
          type: "pullFrame",
          lastAppliedFrameSeq: frame.body.value.lastAppliedFrameSeq,
          cols: frame.body.value.cols,
          rows: frame.body.value.rows,
          maxPatchBytes: frame.body.value.maxPatchBytes,
        };
      case "hello":
        return {
          type: "hello",
          terminalId: frame.body.value.terminalId,
          geometryRole: domainGeometryRoleFromProto(frame.body.value.geometryRole),
          geometryOrder: frame.body.value.geometryOrder,
          debugTrace: frame.body.value.debugTrace,
          runtime: decodeHelloRuntime(frame.body.value.runtimeJson),
          direct: decodeHelloDirect(frame.body.value.directJson),
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
      case "frameDirty":
        return {
          type: "frameDirty",
          terminalId: frame.body.value.terminalId,
          frameSeq: frame.body.value.frameSeq,
          reason: frame.body.value.reason,
          timestamp: frame.body.value.timestamp,
        };
      case "frame": {
        const status = domainStatusFromProto(frame.body.value.status);
        const patch = fromProtoFramePatch(frame.body.value.patch);
        if (!status || !patch) {
          return null;
        }
        return {
          type: "frame",
          terminalId: frame.body.value.terminalId,
          frameSeq: frame.body.value.frameSeq,
          status,
          patch,
        };
      }
      case "selectionText":
        return {
          type: "selectionText",
          terminalId: frame.body.value.terminalId,
          ownerId: frame.body.value.ownerId,
          text: frame.body.value.text,
        };
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
      case "trace":
        return {
          type: "trace",
          terminalId: frame.body.value.terminalId,
          event: frame.body.value.event,
          fields: Object.fromEntries(
            frame.body.value.fields
              .map(fromProtoTraceField)
              .filter((field): field is [string, TerminalTransportTraceValue] => field !== null),
          ),
          timestamp: frame.body.value.timestamp,
        };
      case "helloAck":
        if (!frame.body.value.attachmentId) {
          return null;
        }
        return {
          type: "helloAck",
          terminalId: frame.body.value.terminalId,
          attachmentId: frame.body.value.attachmentId,
          effectiveGeometryRole:
            domainGeometryRoleFromProto(frame.body.value.effectiveGeometryRole) ?? "projection-only",
          geometryAuthorityAttachmentId: frame.body.value.geometryAuthorityAttachmentId,
          geometryOrder: frame.body.value.geometryOrder,
          authorityReason: frame.body.value.authorityReason,
          direct: decodeHelloAckDirect(frame.body.value.directJson),
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};

export const binaryStringToBytes = (input: string): Uint8Array =>
  Uint8Array.from(input, (char) => char.charCodeAt(0) & 0xff);

export {
  createTerminalTransportClientSession,
  type TerminalTransportClientConnectionState,
  type TerminalTransportClientSession,
  type TerminalTransportClientSessionEvents,
  type TerminalTransportClientSocketLike,
} from "./client-session";
export {
  canUseTerminalTransportDirectRegistry,
  getTerminalTransportDirectRegistry,
  TERMINAL_TRANSPORT_DIRECT_REGISTRY_KEY,
  type TerminalTransportDirectConnection,
  type TerminalTransportDirectEndpoint,
  type TerminalTransportDirectRegistry,
} from "./direct-registry";
