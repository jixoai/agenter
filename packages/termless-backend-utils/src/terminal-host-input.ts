import type {
  TerminalInteractionController,
  TerminalOwnerCoordinate,
  TerminalPointerButton,
  TerminalSelectionRange,
} from "@agenter/termless-core";

const CTRL_A_CODE = "a".charCodeAt(0);
const DEFAULT_OWNER_ID = "terminal";
const DEFAULT_SEMANTIC_CLICK_MAX_MS = 450;
const DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS = 1;

const arrowMap: Record<string, string> = {
  up: "\u001b[A",
  down: "\u001b[B",
  right: "\u001b[C",
  left: "\u001b[D",
  home: "\x01",
  end: "\x05",
  delete: "\u001b[3~",
  pageup: "\u001b[5~",
  pagedown: "\u001b[6~",
};

export interface TerminalHostKeyEvent {
  readonly name: string;
  readonly sequence: string;
  readonly raw: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly option: boolean;
  readonly shift: boolean;
}

export interface TerminalKeyboardInteractionView {
  readonly cursorAbsRow: number;
  readonly cursorCol: number;
  readonly viewportStart: number;
  readonly plainLines: readonly string[];
}

export interface TerminalHostPointerInput {
  readonly button: TerminalPointerButton;
  readonly point: TerminalOwnerCoordinate | null;
  readonly clickCount?: number;
  readonly timestampMs?: number;
}

export interface TerminalHostPointerDispatchResult {
  readonly handled: boolean;
  readonly preventDefault: boolean;
}

export interface TerminalHostInputTarget extends Pick<
  TerminalInteractionController,
  | "startSelection"
  | "updateSelection"
  | "endSelection"
  | "selectRange"
  | "selectWordAt"
  | "selectLineAt"
  | "clearSelection"
  | "getSelectionOverlay"
> {
  readKeyboardInteractionView(): TerminalKeyboardInteractionView | null;
  writeInput(chunk: string | Uint8Array): boolean;
  followCursor?(): boolean;
}

export interface TerminalHostInputController {
  handleKey(target: TerminalHostInputTarget, key: TerminalHostKeyEvent): boolean;
  pasteText(target: TerminalHostInputTarget, text: string): boolean;
  handlePointerDown(
    target: TerminalHostInputTarget,
    input: TerminalHostPointerInput,
  ): TerminalHostPointerDispatchResult;
  handlePointerDrag(
    target: TerminalHostInputTarget,
    input: TerminalHostPointerInput,
  ): TerminalHostPointerDispatchResult;
  handlePointerUp(target: TerminalHostInputTarget, input: TerminalHostPointerInput): TerminalHostPointerDispatchResult;
}

export interface TerminalHostKeyboardOptions {
  readonly keyEncoding?: boolean;
  readonly wordNavigation?: boolean;
  readonly keyboardSelection?: boolean;
  readonly clearSelectionOnInput?: boolean;
  readonly followCursorOnInput?: boolean;
}

export interface TerminalHostPointerOptions {
  readonly dragSelection?: boolean;
  readonly semanticSelection?: boolean;
  readonly clearSelectionOnClick?: boolean;
}

export interface TerminalHostInputControllerOptions {
  readonly ownerId?: string;
  readonly keyboard?: boolean | TerminalHostKeyboardOptions;
  readonly pointer?: boolean | TerminalHostPointerOptions;
  readonly semanticClickMaxDistanceCells?: number;
  readonly semanticClickMaxMs?: number;
}

interface NormalizedKeyboardOptions {
  readonly enabled: boolean;
  readonly keyEncoding: boolean;
  readonly wordNavigation: boolean;
  readonly keyboardSelection: boolean;
  readonly clearSelectionOnInput: boolean;
  readonly followCursorOnInput: boolean;
}

interface NormalizedPointerOptions {
  readonly enabled: boolean;
  readonly dragSelection: boolean;
  readonly semanticSelection: boolean;
  readonly clearSelectionOnClick: boolean;
}

interface TerminalClickTracker {
  readonly timeMs: number;
  readonly ownerId: string;
  readonly row: number;
  readonly col: number;
  readonly button: TerminalPointerButton;
  readonly count: number;
}

interface DragSelectionState {
  readonly anchor: TerminalOwnerCoordinate | null;
  readonly focus: TerminalOwnerCoordinate | null;
  readonly active: boolean;
}

const nativeSequence = (key: TerminalHostKeyEvent): string | null => {
  if (key.sequence.length > 0) {
    return key.sequence;
  }
  if (key.raw.length > 0) {
    return key.raw;
  }
  return null;
};

const repeatTerminalKey = (key: "\u001b[C" | "\u001b[D", count: number): string | null => {
  const safeCount = Math.max(0, Math.trunc(count));
  return safeCount > 0 ? key.repeat(safeCount) : null;
};

const terminalColumnToStringIndex = (line: string, targetCol: number): number => {
  let col = 0;
  let index = 0;
  for (const char of Array.from(line)) {
    const width = Math.max(1, Bun.stringWidth(char));
    const nextCol = col + width;
    if (targetCol < nextCol) {
      return index;
    }
    col = nextCol;
    index += char.length;
  }
  return line.length;
};

const stringIndexToTerminalColumn = (line: string, targetIndex: number): number => {
  let col = 0;
  let index = 0;
  for (const char of Array.from(line)) {
    if (index >= targetIndex) {
      break;
    }
    col += Math.max(1, Bun.stringWidth(char));
    index += char.length;
  }
  return col;
};

const wordSegments = (line: string): Array<{ start: number; end: number }> => {
  const segments: Array<{ start: number; end: number }> = [];
  for (const segment of new Intl.Segmenter(undefined, { granularity: "word" }).segment(line)) {
    if (!segment.isWordLike) {
      continue;
    }
    segments.push({
      start: segment.index,
      end: segment.index + segment.segment.length,
    });
  }
  return segments;
};

const findPreviousTerminalWordBoundary = (line: string, charIndex: number): number | null => {
  const target = Math.max(0, Math.min(line.length, charIndex));
  let previous: number | null = null;
  for (const segment of wordSegments(line)) {
    if (segment.start < target) {
      previous = segment.start;
    }
    if (segment.start >= target) {
      break;
    }
  }
  return previous;
};

const findNextTerminalWordBoundary = (line: string, charIndex: number): number | null => {
  const target = Math.max(0, Math.min(line.length, charIndex));
  for (const segment of wordSegments(line)) {
    if (segment.end > target) {
      return segment.end;
    }
  }
  return null;
};

const isOptionWordNavigationKey = (key: TerminalHostKeyEvent): boolean =>
  key.name === "left" || key.name === "right" ? key.option === true || key.meta === true : false;

const isDirectionalTerminalKey = (key: TerminalHostKeyEvent): boolean =>
  key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right";

const isModifiedDirectionalTerminalKey = (key: TerminalHostKeyEvent): boolean =>
  isDirectionalTerminalKey(key) && (key.shift || key.option || key.meta);

const resolveModifiedArrowKey = (
  key: TerminalHostKeyEvent,
): { direction: "left" | "right"; shift: boolean; option: boolean } | null => {
  const sequence = key.sequence || key.raw;
  const match = /^\u001b\[1;(\d+)([CD])$/.exec(sequence);
  if (!match) {
    return null;
  }
  const modifierValue = Number(match[1]);
  if (!Number.isInteger(modifierValue) || modifierValue <= 1) {
    return null;
  }
  const modifier = modifierValue - 1;
  return {
    direction: match[2] === "D" ? "left" : "right",
    shift: (modifier & 1) !== 0,
    option: (modifier & 2) !== 0,
  };
};

const resolveShiftArrowKey = (key: TerminalHostKeyEvent): { direction: "left" | "right" } | null =>
  key.shift === true && (key.name === "left" || key.name === "right") ? { direction: key.name } : null;

const resolveOptionWordKey = (
  key: TerminalHostKeyEvent,
): { direction: "left" | "right"; shift: boolean; option: boolean } | null => {
  const modifiedArrow = resolveModifiedArrowKey(key);
  if (modifiedArrow?.option) {
    return modifiedArrow;
  }
  const sequence = key.sequence || key.raw;
  if (sequence === "\u001bb") {
    return { direction: "left", shift: key.shift === true, option: true };
  }
  if (sequence === "\u001bf") {
    return { direction: "right", shift: key.shift === true, option: true };
  }
  if (sequence === "\u001bB") {
    return { direction: "left", shift: true, option: true };
  }
  if (sequence === "\u001bF") {
    return { direction: "right", shift: true, option: true };
  }
  if ((key.name === "left" || key.name === "right") && isOptionWordNavigationKey(key)) {
    return { direction: key.name, shift: key.shift === true, option: true };
  }
  return null;
};

const encodeTerminalHostKey = (key: TerminalHostKeyEvent): string | null => {
  if (key.name === "return") {
    return "\r";
  }
  if (key.name === "linefeed") {
    return "\n";
  }
  if (key.name === "backspace") {
    return "\u007f";
  }
  if (key.name === "tab") {
    return "\t";
  }
  if (key.name === "space") {
    return " ";
  }
  if (key.name === "escape") {
    return "\u001b";
  }
  if (isModifiedDirectionalTerminalKey(key)) {
    return nativeSequence(key);
  }
  if ((key.name === "home" || key.name === "end") && nativeSequence(key)) {
    return nativeSequence(key);
  }
  if (arrowMap[key.name]) {
    return arrowMap[key.name];
  }
  if (key.ctrl && key.name.length === 1 && /^[a-z]$/i.test(key.name)) {
    const code = key.name.toLowerCase().charCodeAt(0) - CTRL_A_CODE + 1;
    return String.fromCharCode(code);
  }
  if (key.sequence.length > 0 && !key.meta) {
    return key.sequence;
  }
  if (key.raw.length > 0 && !key.meta) {
    return key.raw;
  }
  return null;
};

const normalizeSemanticClickMaxDistance = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS;
  }
  return Math.max(0, Math.trunc(value));
};

const normalizeKeyboardOptions = (
  keyboard: boolean | TerminalHostKeyboardOptions | undefined,
): NormalizedKeyboardOptions => {
  if (keyboard === false) {
    return {
      enabled: false,
      keyEncoding: false,
      wordNavigation: false,
      keyboardSelection: false,
      clearSelectionOnInput: false,
      followCursorOnInput: false,
    };
  }
  const input = typeof keyboard === "object" ? keyboard : {};
  return {
    enabled: true,
    keyEncoding: input.keyEncoding ?? true,
    wordNavigation: input.wordNavigation ?? true,
    keyboardSelection: input.keyboardSelection ?? true,
    clearSelectionOnInput: input.clearSelectionOnInput ?? true,
    followCursorOnInput: input.followCursorOnInput ?? true,
  };
};

const normalizePointerOptions = (
  pointer: boolean | TerminalHostPointerOptions | undefined,
): NormalizedPointerOptions => {
  if (pointer === false) {
    return {
      enabled: false,
      dragSelection: false,
      semanticSelection: false,
      clearSelectionOnClick: false,
    };
  }
  const input = typeof pointer === "object" ? pointer : {};
  return {
    enabled: true,
    dragSelection: input.dragSelection ?? true,
    semanticSelection: input.semanticSelection ?? true,
    clearSelectionOnClick: input.clearSelectionOnClick ?? true,
  };
};

const unhandledPointerResult = (): TerminalHostPointerDispatchResult => ({ handled: false, preventDefault: false });

export const createTerminalHostInputController = (
  options: TerminalHostInputControllerOptions = {},
): TerminalHostInputController => {
  const ownerId = options.ownerId ?? DEFAULT_OWNER_ID;
  const keyboardOptions = normalizeKeyboardOptions(options.keyboard);
  const pointerOptions = normalizePointerOptions(options.pointer);
  const semanticClickMaxDistanceCells = normalizeSemanticClickMaxDistance(options.semanticClickMaxDistanceCells);
  const semanticClickMaxMs =
    typeof options.semanticClickMaxMs === "number" && Number.isFinite(options.semanticClickMaxMs)
      ? Math.max(1, Math.trunc(options.semanticClickMaxMs))
      : DEFAULT_SEMANTIC_CLICK_MAX_MS;
  let selectionAnchor: TerminalOwnerCoordinate | null = null;
  let dragState: DragSelectionState = { anchor: null, focus: null, active: false };
  let lastClick: TerminalClickTracker | null = null;

  const clearKeyboardAnchor = (): void => {
    selectionAnchor = null;
  };

  const sendInput = (
    target: TerminalHostInputTarget,
    chunk: string | Uint8Array,
    inputOptions: { preserveSelectionAnchor?: boolean } = {},
  ): boolean => {
    if (inputOptions.preserveSelectionAnchor !== true) {
      clearKeyboardAnchor();
      if (keyboardOptions.clearSelectionOnInput) {
        target.clearSelection(ownerId);
      }
    }
    const accepted = target.writeInput(chunk);
    if (accepted && keyboardOptions.followCursorOnInput) {
      target.followCursor?.();
    }
    return accepted;
  };

  const resolveWordBoundary = (
    view: TerminalKeyboardInteractionView,
    key: TerminalHostKeyEvent,
  ): {
    direction: "left" | "right";
    cursorAbsRow: number;
    cursorCol: number;
    targetCol: number;
    delta: number;
  } | null => {
    const optionWordKey = resolveOptionWordKey(key);
    if (!optionWordKey) {
      return null;
    }
    const localCursorRow = Math.max(0, Math.trunc(view.cursorAbsRow - view.viewportStart));
    const line = view.plainLines[localCursorRow] ?? "";
    const cursorCol = Math.max(0, Math.trunc(view.cursorCol));
    const cursorIndex = terminalColumnToStringIndex(line, cursorCol);
    const targetIndex =
      optionWordKey.direction === "left"
        ? findPreviousTerminalWordBoundary(line, cursorIndex)
        : findNextTerminalWordBoundary(line, cursorIndex);
    if (targetIndex === null) {
      return null;
    }
    const targetCol = stringIndexToTerminalColumn(line, targetIndex);
    const delta = targetCol - cursorCol;
    if (delta === 0) {
      return null;
    }
    return {
      direction: optionWordKey.direction,
      cursorAbsRow: view.cursorAbsRow,
      cursorCol,
      targetCol,
      delta,
    };
  };

  const handleSelectionKey = (target: TerminalHostInputTarget, key: TerminalHostKeyEvent): boolean => {
    const view = target.readKeyboardInteractionView();
    if (!view) {
      return false;
    }
    const optionWordKey = resolveOptionWordKey(key);
    if (optionWordKey?.shift && keyboardOptions.keyboardSelection && keyboardOptions.wordNavigation) {
      const boundary = resolveWordBoundary(view, key);
      if (!boundary) {
        return false;
      }
      const anchor =
        selectionAnchor && selectionAnchor.row === boundary.cursorAbsRow
          ? selectionAnchor
          : { ownerId, row: boundary.cursorAbsRow, col: boundary.cursorCol };
      const range: TerminalSelectionRange = {
        ownerId,
        startRow: anchor.row,
        startCol: Math.min(anchor.col, boundary.targetCol),
        endRow: boundary.cursorAbsRow,
        endCol: Math.max(anchor.col, boundary.targetCol),
      };
      if (range.startCol === range.endCol && range.startRow === range.endRow) {
        clearKeyboardAnchor();
        return false;
      }
      const selected = target.selectRange(range);
      const cursorInput =
        selected && boundary.delta > 0
          ? repeatTerminalKey("\u001b[C", boundary.delta)
          : selected && boundary.delta < 0
            ? repeatTerminalKey("\u001b[D", Math.abs(boundary.delta))
            : null;
      if (!cursorInput) {
        return false;
      }
      const moved = sendInput(target, cursorInput, { preserveSelectionAnchor: true });
      if (moved) {
        selectionAnchor = anchor;
      }
      return moved;
    }
    if (optionWordKey && !optionWordKey.shift && keyboardOptions.wordNavigation) {
      const boundary = resolveWordBoundary(view, key);
      if (!boundary) {
        return false;
      }
      const encoded =
        boundary.delta > 0
          ? repeatTerminalKey("\u001b[C", boundary.delta)
          : repeatTerminalKey("\u001b[D", Math.abs(boundary.delta));
      if (!encoded) {
        return false;
      }
      return sendInput(target, encoded, { preserveSelectionAnchor: true });
    }
    const shiftArrow = resolveShiftArrowKey(key);
    if (!shiftArrow || !keyboardOptions.keyboardSelection) {
      return false;
    }
    const cursorAbsRow = Math.max(0, Math.trunc(view.cursorAbsRow));
    const cursorCol = Math.max(0, Math.trunc(view.cursorCol));
    const targetCol = shiftArrow.direction === "left" ? Math.max(0, cursorCol - 1) : cursorCol + 1;
    const anchor =
      selectionAnchor && selectionAnchor.row === cursorAbsRow
        ? selectionAnchor
        : { ownerId, row: cursorAbsRow, col: cursorCol };
    const range: TerminalSelectionRange = {
      ownerId,
      startRow: anchor.row,
      startCol: Math.min(anchor.col, targetCol),
      endRow: cursorAbsRow,
      endCol: Math.max(anchor.col, targetCol),
    };
    if (range.startCol === range.endCol) {
      clearKeyboardAnchor();
      return false;
    }
    const selected = target.selectRange(range);
    if (!selected) {
      return false;
    }
    const moved = sendInput(target, shiftArrow.direction === "left" ? "\u001b[D" : "\u001b[C", {
      preserveSelectionAnchor: true,
    });
    if (moved) {
      selectionAnchor = anchor;
    }
    return moved;
  };

  const resolveNextClickCount = (input: TerminalHostPointerInput): number => {
    if (!input.point) {
      lastClick = null;
      return 1;
    }
    const now = input.timestampMs ?? performance.now();
    const providedClickCount =
      typeof input.clickCount === "number" && Number.isFinite(input.clickCount)
        ? Math.max(1, Math.trunc(input.clickCount))
        : null;
    const previous = lastClick;
    const sameCluster =
      previous !== null &&
      previous.button === input.button &&
      previous.ownerId === input.point.ownerId &&
      previous.row === input.point.row &&
      now - previous.timeMs <= semanticClickMaxMs &&
      Math.abs(previous.col - input.point.col) <= semanticClickMaxDistanceCells;
    const nextCount =
      sameCluster && providedClickCount !== null
        ? Math.max(previous.count + 1, providedClickCount)
        : sameCluster
          ? previous.count + 1
          : 1;
    lastClick = {
      timeMs: now,
      ownerId: input.point.ownerId,
      row: input.point.row,
      col: input.point.col,
      button: input.button,
      count: Math.min(nextCount, 3),
    };
    return lastClick.count;
  };

  const hasSelection = (target: TerminalHostInputTarget): boolean => target.getSelectionOverlay(ownerId) !== null;

  return {
    handleKey(target, key): boolean {
      if (!keyboardOptions.enabled) {
        return false;
      }
      if (handleSelectionKey(target, key)) {
        return true;
      }
      if (!keyboardOptions.keyEncoding) {
        return false;
      }
      const encoded = encodeTerminalHostKey(key);
      if (!encoded) {
        return false;
      }
      return sendInput(target, encoded);
    },
    pasteText(target, text): boolean {
      if (!keyboardOptions.enabled) {
        return false;
      }
      if (text.length === 0) {
        return false;
      }
      return sendInput(target, text);
    },
    handlePointerDown(target, input): TerminalHostPointerDispatchResult {
      if (!pointerOptions.enabled) {
        return unhandledPointerResult();
      }
      if (input.button !== "left") {
        return unhandledPointerResult();
      }
      if (!input.point) {
        dragState = { anchor: null, focus: null, active: false };
        lastClick = null;
        return unhandledPointerResult();
      }
      const clickCount = pointerOptions.semanticSelection ? resolveNextClickCount(input) : 1;
      clearKeyboardAnchor();
      if (pointerOptions.semanticSelection && clickCount >= 3 && target.selectLineAt(input.point)) {
        dragState = { anchor: null, focus: null, active: false };
        return { handled: true, preventDefault: true };
      }
      if (pointerOptions.semanticSelection && clickCount === 2 && target.selectWordAt(input.point)) {
        dragState = { anchor: null, focus: null, active: false };
        return { handled: true, preventDefault: true };
      }
      dragState = {
        anchor: input.point,
        focus: null,
        active: false,
      };
      return unhandledPointerResult();
    },
    handlePointerDrag(target, input): TerminalHostPointerDispatchResult {
      if (!pointerOptions.enabled || !pointerOptions.dragSelection) {
        return unhandledPointerResult();
      }
      if (input.button !== "left") {
        return unhandledPointerResult();
      }
      const anchor = dragState.anchor;
      const focus = input.point;
      if (!anchor || !focus || focus.ownerId !== anchor.ownerId) {
        return unhandledPointerResult();
      }
      const moved = focus.row !== anchor.row || focus.col !== anchor.col;
      if (!moved && !dragState.active) {
        return unhandledPointerResult();
      }
      if (!dragState.active) {
        if (!target.startSelection(anchor)) {
          dragState = { anchor: null, focus: null, active: false };
          return unhandledPointerResult();
        }
        dragState = {
          anchor,
          focus: anchor,
          active: true,
        };
      }
      const updated = target.updateSelection(focus);
      if (!updated) {
        return unhandledPointerResult();
      }
      dragState = {
        anchor,
        focus,
        active: true,
      };
      return { handled: true, preventDefault: true };
    },
    handlePointerUp(target, input): TerminalHostPointerDispatchResult {
      if (!pointerOptions.enabled) {
        return unhandledPointerResult();
      }
      const anchor = dragState.anchor;
      const focus = dragState.focus;
      const active = dragState.active;
      dragState = { anchor: null, focus: null, active: false };
      clearKeyboardAnchor();
      if (active && focus) {
        const ended = target.endSelection(focus);
        return { handled: ended, preventDefault: ended };
      }
      if (anchor && pointerOptions.clearSelectionOnClick && hasSelection(target) && target.clearSelection(ownerId)) {
        return { handled: true, preventDefault: true };
      }
      return unhandledPointerResult();
    },
  };
};
