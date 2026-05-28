import type { KeyEvent } from "@opentui/core";
import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionRange,
} from "@agenter/terminal-transport-protocol";

export interface ShellNextTerminalSelectionState {
  readonly anchor: TerminalTransportOwnerCoordinate | null;
}

export interface ShellNextTerminalInteractionView {
  readonly cursorAbsRow: number;
  readonly cursorCol: number;
  readonly viewportStart: number;
  readonly plainLines: readonly string[];
}

export interface ShellNextTerminalInteractionBridge {
  selectRange(range: TerminalTransportSelectionRange): boolean;
  followCursor(): boolean;
  writeInput(chunk: string): void | Promise<void>;
}

export interface ShellNextTerminalWordNavigationResult {
  readonly encodedInput: string;
  readonly selectionRange: TerminalTransportSelectionRange | null;
  readonly selectionAnchor: TerminalTransportOwnerCoordinate;
}

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

const isOptionWordNavigationKey = (key: KeyEvent): boolean =>
  key.name === "left" || key.name === "right" ? key.option === true || key.meta === true : false;

const resolveModifiedArrowKey = (key: KeyEvent): { direction: "left" | "right"; shift: boolean; option: boolean } | null => {
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

const resolveShiftArrowKey = (key: KeyEvent): { direction: "left" | "right" } | null =>
  key.shift === true && (key.name === "left" || key.name === "right") ? { direction: key.name } : null;

const resolveOptionWordKey = (key: KeyEvent): { direction: "left" | "right"; shift: boolean; option: boolean } | null => {
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

const resolveWordBoundary = (
  view: ShellNextTerminalInteractionView,
  key: KeyEvent,
): { direction: "left" | "right"; cursorAbsRow: number; cursorCol: number; cursorIndex: number; targetCol: number; delta: number } | null => {
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
    cursorIndex,
    targetCol,
    delta,
  };
};

export const createShellNextTerminalInteractionController = (input: {
  readonly view: ShellNextTerminalInteractionView;
  readonly bridge: ShellNextTerminalInteractionBridge;
  readonly selectionState: ShellNextTerminalSelectionState;
  readonly onSelectionAnchorChange: (anchor: TerminalTransportOwnerCoordinate | null) => void;
}): {
  handleKey(key: KeyEvent): boolean;
} => {
  const routeCellSelection = (key: KeyEvent): boolean => {
    if (resolveOptionWordKey(key)) {
      return false;
    }
    const shiftArrow = resolveShiftArrowKey(key);
    if (!shiftArrow) {
      return false;
    }
    const cursorAbsRow = Math.max(0, Math.trunc(input.view.cursorAbsRow));
    const cursorCol = Math.max(0, Math.trunc(input.view.cursorCol));
    const targetCol = shiftArrow.direction === "left" ? Math.max(0, cursorCol - 1) : cursorCol + 1;
    const anchor =
      input.selectionState.anchor && input.selectionState.anchor.row === cursorAbsRow
        ? input.selectionState.anchor
        : { ownerId: "terminal", row: cursorAbsRow, col: cursorCol };
    const startCol = Math.min(anchor.col, targetCol);
    const endCol = Math.max(anchor.col, targetCol);
    if (startCol === endCol) {
      input.onSelectionAnchorChange(null);
      return false;
    }
    const sent = input.bridge.selectRange({
      ownerId: "terminal",
      startRow: anchor.row,
      startCol,
      endRow: cursorAbsRow,
      endCol,
    });
    if (sent) {
      input.onSelectionAnchorChange(anchor);
      void input.bridge.writeInput(shiftArrow.direction === "left" ? "\u001b[D" : "\u001b[C");
      void input.bridge.followCursor();
    }
    return sent;
  };

  const routeWordSelection = (key: KeyEvent): boolean => {
    const optionWordKey = resolveOptionWordKey(key);
    if (!optionWordKey?.shift) {
      return false;
    }
    const boundary = resolveWordBoundary(input.view, key);
    if (!boundary) {
      return false;
    }
    const anchor =
      input.selectionState.anchor && input.selectionState.anchor.row === boundary.cursorAbsRow
        ? input.selectionState.anchor
        : { ownerId: "terminal", row: boundary.cursorAbsRow, col: boundary.cursorCol };
    const startCol = Math.min(anchor.col, boundary.targetCol);
    const endCol = Math.max(anchor.col, boundary.targetCol);
    if (startCol === endCol) {
      input.onSelectionAnchorChange(null);
      return false;
    }
    const sent = input.bridge.selectRange({
      ownerId: "terminal",
      startRow: anchor.row,
      startCol,
      endRow: boundary.cursorAbsRow,
      endCol,
    });
    const cursorInput =
      sent && boundary.delta > 0
        ? repeatTerminalKey("\u001b[C", boundary.delta)
        : sent && boundary.delta < 0
          ? repeatTerminalKey("\u001b[D", Math.abs(boundary.delta))
          : null;
    if (cursorInput) {
      input.onSelectionAnchorChange(anchor);
      void input.bridge.writeInput(cursorInput);
      void input.bridge.followCursor();
    }
    return sent;
  };

  const resolveOptionNavigation = (key: KeyEvent): string | null => {
    const boundary = resolveWordBoundary(input.view, key);
    if (!boundary) {
      return null;
    }
    const delta = boundary.delta;
    return delta > 0 ? repeatTerminalKey("\u001b[C", delta) : repeatTerminalKey("\u001b[D", Math.abs(delta));
  };

  return {
    handleKey(key: KeyEvent): boolean {
      if (routeCellSelection(key)) {
        return true;
      }
      if (routeWordSelection(key)) {
        return true;
      }
      const encoded = resolveOptionNavigation(key);
      if (!encoded) {
        return false;
      }
      void input.bridge.writeInput(encoded);
      void input.bridge.followCursor();
      return true;
    },
  };
};
