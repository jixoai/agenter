import type { Cell } from "./termless-types.js";

export type TerminalInteractionOwnerId = string;

export const TERMINAL_INTERACTION_DEFAULT_OWNER_ID = "terminal" as const;

export type TerminalInteractionOwnership =
  | "backend-native"
  | "backend-adapter-owned"
  | "unavailable"
  | "host-projection-only";

export type TerminalPointerButton =
  | "left"
  | "middle"
  | "right"
  | "wheel-up"
  | "wheel-down"
  | "wheel-left"
  | "wheel-right"
  | "unknown";

export type TerminalMouseTrackingProtocol = "none" | "vt200" | "drag" | "any";

export type TerminalMouseTrackingEncoding = "default" | "sgr";

export interface TerminalMouseTrackingState {
  readonly protocol: TerminalMouseTrackingProtocol;
  readonly encoding: TerminalMouseTrackingEncoding;
}

export const TERMINAL_MOUSE_TRACKING_NONE: TerminalMouseTrackingState = Object.freeze({
  protocol: "none",
  encoding: "default",
});

export type TerminalSemanticSelectionKind = "word" | "line";

export interface TerminalOwnerCoordinate {
  ownerId: TerminalInteractionOwnerId;
  row: number;
  col: number;
}

export interface TerminalPointerEvent {
  ownerId: TerminalInteractionOwnerId;
  row: number;
  col: number;
  button: TerminalPointerButton;
  modifiers?: {
    alt?: boolean;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
  };
}

export interface TerminalSelectionRange {
  ownerId: TerminalInteractionOwnerId;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  rectangular?: boolean;
}

export interface TerminalSelectionOverlayRow {
  row: number;
  startCol: number;
  endCol: number;
}

export interface TerminalSelectionOverlay {
  ownerId: TerminalInteractionOwnerId;
  ownership: Extract<TerminalInteractionOwnership, "backend-native" | "backend-adapter-owned">;
  rows: TerminalSelectionOverlayRow[];
  selectedText?: string;
}

export type TerminalInteractionEvent =
  | {
      type: "selectionStart" | "selectionUpdate" | "selectionEnd" | "selectWordAt" | "selectLineAt";
      point: TerminalOwnerCoordinate;
    }
  | {
      type: "selectRange";
      range: TerminalSelectionRange;
    }
  | {
      type: "copySelection" | "clearSelection";
      ownerId?: TerminalInteractionOwnerId;
    }
  | {
      type: "followCursor";
    };

export interface TerminalInteractionResult {
  ok: boolean;
  selectedText?: string;
}

export interface TerminalInteractionCapabilities {
  ownership: TerminalInteractionOwnership;
  selection: boolean;
  copy: boolean;
  semanticSelection: boolean;
  cursorFollow: boolean;
  overlay: boolean;
  reason?: string;
}

export interface TerminalInteractionFrameState {
  activeOwnerId?: TerminalInteractionOwnerId;
  mouseTracking?: TerminalMouseTrackingState;
  selectionOverlays?: TerminalSelectionOverlay[];
  capabilities?: Record<TerminalInteractionOwnerId, TerminalInteractionCapabilities>;
}

export interface TerminalInteractionReadable {
  getLine(row: number): Cell[];
  getScrollback(): { viewportOffset: number; totalLines: number; screenLines: number };
}

export interface TerminalInteractionController {
  readonly interactionCapabilities: TerminalInteractionCapabilities;
  startSelection(point: TerminalOwnerCoordinate): boolean;
  updateSelection(point: TerminalOwnerCoordinate): boolean;
  endSelection(point: TerminalOwnerCoordinate): boolean;
  selectRange(range: TerminalSelectionRange): boolean;
  selectWordAt(point: TerminalOwnerCoordinate): boolean;
  selectLineAt(point: TerminalOwnerCoordinate): boolean;
  clearSelection(ownerId?: TerminalInteractionOwnerId): boolean;
  copySelection(ownerId?: TerminalInteractionOwnerId): string;
  getSelectionOverlay(ownerId?: TerminalInteractionOwnerId): TerminalSelectionOverlay | null;
  getMouseTrackingState?(): TerminalMouseTrackingState;
  followCursor?(): boolean;
}

export const TERMINAL_INTERACTION_UNAVAILABLE: TerminalInteractionCapabilities = Object.freeze({
  ownership: "unavailable",
  selection: false,
  copy: false,
  semanticSelection: false,
  cursorFollow: false,
  overlay: false,
  reason: "backend interaction is unavailable",
});

export const TERMINAL_INTERACTION_HOST_PROJECTION_ONLY: TerminalInteractionCapabilities = Object.freeze({
  ownership: "host-projection-only",
  selection: false,
  copy: false,
  semanticSelection: false,
  cursorFollow: false,
  overlay: false,
  reason: "host projection can capture events but cannot own terminal interaction truth",
});

export const createTerminalInteractionCapabilities = (
  ownership: TerminalInteractionOwnership,
  input: Partial<Omit<TerminalInteractionCapabilities, "ownership">> = {},
): TerminalInteractionCapabilities => {
  const backendOwned = ownership === "backend-native" || ownership === "backend-adapter-owned";
  return {
    ownership,
    selection: input.selection ?? backendOwned,
    copy: input.copy ?? backendOwned,
    semanticSelection: input.semanticSelection ?? backendOwned,
    cursorFollow: input.cursorFollow ?? backendOwned,
    overlay: input.overlay ?? backendOwned,
    reason: input.reason,
  };
};

export const isBackendOwnedTerminalInteraction = (capabilities: TerminalInteractionCapabilities): boolean =>
  capabilities.ownership === "backend-native" || capabilities.ownership === "backend-adapter-owned";

export const isTerminalInteractionController = (value: unknown): value is TerminalInteractionController => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<TerminalInteractionController>;
  return (
    candidate.interactionCapabilities !== undefined &&
    typeof candidate.startSelection === "function" &&
    typeof candidate.updateSelection === "function" &&
    typeof candidate.endSelection === "function" &&
    typeof candidate.selectRange === "function" &&
    typeof candidate.selectWordAt === "function" &&
    typeof candidate.selectLineAt === "function" &&
    typeof candidate.clearSelection === "function" &&
    typeof candidate.copySelection === "function" &&
    typeof candidate.getSelectionOverlay === "function"
  );
};

export const applyTerminalInteractionEvent = (
  controller: TerminalInteractionController,
  event: TerminalInteractionEvent,
): TerminalInteractionResult => {
  switch (event.type) {
    case "selectionStart":
      return { ok: controller.startSelection(event.point) };
    case "selectionUpdate":
      return { ok: controller.updateSelection(event.point) };
    case "selectionEnd":
      return { ok: controller.endSelection(event.point) };
    case "selectWordAt":
      return { ok: controller.selectWordAt(event.point) };
    case "selectLineAt":
      return { ok: controller.selectLineAt(event.point) };
    case "selectRange":
      return { ok: controller.selectRange(event.range) };
    case "copySelection": {
      const selectedText = controller.copySelection(event.ownerId);
      return { ok: selectedText.length > 0, selectedText };
    }
    case "clearSelection":
      return { ok: controller.clearSelection(event.ownerId) };
    case "followCursor":
      return { ok: controller.followCursor?.() ?? false };
    default:
      return event satisfies never;
  }
};

export const cloneTerminalSelectionOverlay = (
  overlay: TerminalSelectionOverlay | null | undefined,
): TerminalSelectionOverlay | null =>
  overlay
    ? {
        ownerId: overlay.ownerId,
        ownership: overlay.ownership,
        rows: overlay.rows.map((row) => ({ ...row })),
        selectedText: overlay.selectedText,
      }
    : null;

export const cloneTerminalInteractionCapabilities = (
  capabilities: TerminalInteractionCapabilities,
): TerminalInteractionCapabilities => ({ ...capabilities });

export const cloneTerminalMouseTrackingState = (
  state: TerminalMouseTrackingState | null | undefined,
): TerminalMouseTrackingState | undefined =>
  state ? { protocol: state.protocol, encoding: state.encoding } : undefined;

export const cloneTerminalInteractionFrameState = (
  state: TerminalInteractionFrameState | null | undefined,
): TerminalInteractionFrameState | undefined => {
  if (!state) {
    return undefined;
  }
  return {
    activeOwnerId: state.activeOwnerId,
    mouseTracking: cloneTerminalMouseTrackingState(state.mouseTracking),
    selectionOverlays: state.selectionOverlays
      ?.map((overlay) => cloneTerminalSelectionOverlay(overlay))
      .filter((overlay): overlay is TerminalSelectionOverlay => overlay !== null),
    capabilities: state.capabilities
      ? Object.fromEntries(
          Object.entries(state.capabilities).map(([ownerId, capabilities]) => [
            ownerId,
            cloneTerminalInteractionCapabilities(capabilities),
          ]),
        )
      : undefined,
  };
};

const normalizeCoordinate = (point: TerminalOwnerCoordinate): TerminalOwnerCoordinate => ({
  ownerId: point.ownerId,
  row: Math.max(0, Math.trunc(point.row)),
  col: Math.max(0, Math.trunc(point.col)),
});

const normalizeRange = (range: TerminalSelectionRange): TerminalSelectionRange => {
  const startRow = Math.max(0, Math.trunc(range.startRow));
  const endRow = Math.max(0, Math.trunc(range.endRow));
  const startCol = Math.max(0, Math.trunc(range.startCol));
  const endCol = Math.max(0, Math.trunc(range.endCol));
  const startBeforeEnd = startRow < endRow || (startRow === endRow && startCol <= endCol);
  return {
    ownerId: range.ownerId,
    startRow: startBeforeEnd ? startRow : endRow,
    startCol: startBeforeEnd ? startCol : endCol,
    endRow: startBeforeEnd ? endRow : startRow,
    endCol: startBeforeEnd ? endCol : startCol,
    rectangular: range.rectangular === true,
  };
};

const textWidth = (text: string): number => {
  let width = 0;
  for (const char of Array.from(text)) {
    width += Bun.stringWidth(char);
  }
  return width;
};

const lineToText = (cells: readonly Cell[]): string => cells.map((cell) => cell.char).join("");

const columnToStringIndex = (line: string, targetCol: number): number => {
  let col = 0;
  let index = 0;
  for (const char of Array.from(line)) {
    const width = Math.max(1, Bun.stringWidth(char));
    if (col + width > targetCol) {
      return index;
    }
    col += width;
    index += char.length;
  }
  return line.length;
};

const sliceByColumns = (line: string, startCol: number, endCol: number): string => {
  let result = "";
  let col = 0;
  for (const char of Array.from(line)) {
    const width = Math.max(1, Bun.stringWidth(char));
    const nextCol = col + width;
    if (nextCol > startCol && col < endCol) {
      result += char;
    }
    if (nextCol >= endCol) {
      break;
    }
    col = nextCol;
  }
  return result;
};

export const findWordInTerminalLine = (
  text: string,
  charIndex: number,
): { word: string; start: number; end: number } | null => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  const segments = segmenter.segment(text);
  const segmentInfo = segments.containing(Math.max(0, Math.min(text.length, Math.trunc(charIndex))));
  if (segmentInfo?.isWordLike) {
    return {
      word: segmentInfo.segment,
      start: segmentInfo.index,
      end: segmentInfo.index + segmentInfo.segment.length,
    };
  }
  return null;
};

export interface BackendInteractionAdapterOptions {
  ownerId: TerminalInteractionOwnerId;
  readable: TerminalInteractionReadable;
  followCursor?: () => boolean;
}

export const createBackendInteractionAdapter = (
  options: BackendInteractionAdapterOptions,
): TerminalInteractionController => {
  let anchor: TerminalOwnerCoordinate | null = null;
  let selection: TerminalSelectionRange | null = null;

  const capabilities = createTerminalInteractionCapabilities("backend-adapter-owned");

  const lineAt = (row: number): string => lineToText(options.readable.getLine(row));

  const setSelection = (range: TerminalSelectionRange): boolean => {
    if (range.ownerId !== options.ownerId) {
      return false;
    }
    const normalized = normalizeRange(range);
    if (normalized.startRow === normalized.endRow && normalized.startCol === normalized.endCol) {
      selection = null;
      return false;
    }
    selection = normalized;
    return true;
  };

  const controller: TerminalInteractionController = {
    interactionCapabilities: capabilities,
    startSelection(point) {
      const normalized = normalizeCoordinate(point);
      if (normalized.ownerId !== options.ownerId) {
        return false;
      }
      anchor = normalized;
      selection = null;
      return true;
    },
    updateSelection(point) {
      const normalized = normalizeCoordinate(point);
      if (!anchor || normalized.ownerId !== anchor.ownerId || normalized.ownerId !== options.ownerId) {
        return false;
      }
      return setSelection({
        ownerId: options.ownerId,
        startRow: anchor.row,
        startCol: anchor.col,
        endRow: normalized.row,
        endCol: normalized.col + 1,
      });
    },
    endSelection(point) {
      const updated = this.updateSelection(point);
      anchor = null;
      return updated;
    },
    selectRange: setSelection,
    selectWordAt(point) {
      const normalized = normalizeCoordinate(point);
      if (normalized.ownerId !== options.ownerId) {
        return false;
      }
      const line = lineAt(normalized.row);
      const charIndex = columnToStringIndex(line, normalized.col);
      const word = findWordInTerminalLine(line, charIndex);
      if (!word) {
        selection = null;
        return false;
      }
      return setSelection({
        ownerId: options.ownerId,
        startRow: normalized.row,
        endRow: normalized.row,
        startCol: textWidth(line.slice(0, word.start)),
        endCol: textWidth(line.slice(0, word.end)),
      });
    },
    selectLineAt(point) {
      const normalized = normalizeCoordinate(point);
      if (normalized.ownerId !== options.ownerId) {
        return false;
      }
      const line = lineAt(normalized.row);
      const endCol = Math.max(1, textWidth(line.trimEnd()));
      return setSelection({
        ownerId: options.ownerId,
        startRow: normalized.row,
        endRow: normalized.row,
        startCol: 0,
        endCol,
      });
    },
    clearSelection(ownerId) {
      if (ownerId && ownerId !== options.ownerId) {
        return false;
      }
      selection = null;
      anchor = null;
      return true;
    },
    copySelection(ownerId) {
      if (ownerId && ownerId !== options.ownerId) {
        return "";
      }
      if (!selection) {
        return "";
      }
      const lines: string[] = [];
      for (let row = selection.startRow; row <= selection.endRow; row += 1) {
        const line = lineAt(row);
        const startCol = row === selection.startRow ? selection.startCol : 0;
        const endCol = row === selection.endRow ? selection.endCol : textWidth(line);
        lines.push(sliceByColumns(line, startCol, endCol).trimEnd());
      }
      return lines.join("\n");
    },
    getSelectionOverlay(ownerId) {
      if (ownerId && ownerId !== options.ownerId) {
        return null;
      }
      if (!selection) {
        return null;
      }
      const rows: TerminalSelectionOverlayRow[] = [];
      for (let row = selection.startRow; row <= selection.endRow; row += 1) {
        const line = lineAt(row);
        const startCol = row === selection.startRow ? selection.startCol : 0;
        const endCol = row === selection.endRow ? selection.endCol : textWidth(line);
        if (endCol > startCol) {
          rows.push({ row, startCol, endCol });
        }
      }
      if (rows.length === 0) {
        return null;
      }
      return {
        ownerId: options.ownerId,
        ownership: "backend-adapter-owned",
        rows,
        selectedText: controller.copySelection(options.ownerId),
      };
    },
    followCursor() {
      return options.followCursor?.() ?? false;
    },
  };

  return controller;
};
