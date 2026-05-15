import type { Cell, ScrollbackState, TerminalReadable } from "./termless-types.js";

export interface TerminalRenderRichSpan {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export interface TerminalRenderRichLine {
  spans: TerminalRenderRichSpan[];
}

export interface TerminalStructuredRender {
  richLines: TerminalRenderRichLine[];
  cursor: {
    x: number;
    y: number;
    visible: boolean | null;
  };
  scrollback: {
    viewportOffset: number;
    totalLines: number;
    screenLines: number;
  };
  rows: number;
  cols: number;
}

export interface TerminalLinesRangeReadable {
  getLinesRange(startRow: number, rowCount: number): Cell[][];
  getViewportLines(): Cell[][];
}

export type TerminalStructuredReadable = Pick<
  TerminalReadable,
  "getCursor" | "getLine" | "getLines" | "getScrollback"
> &
  Partial<TerminalLinesRangeReadable> & {
    rows: number;
    cols: number;
  };

interface CellStyle {
  fg?: string;
  bg?: string;
  bold: boolean;
  underline: boolean;
  inverse: boolean;
}

const styleEquals = (a: CellStyle, b: CellStyle): boolean =>
  a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.underline === b.underline && a.inverse === b.inverse;

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

const toStyle = (cell: Cell): CellStyle => ({
  fg: cell.fg ? rgbToHex(cell.fg.r, cell.fg.g, cell.fg.b) : undefined,
  bg: cell.bg ? rgbToHex(cell.bg.r, cell.bg.g, cell.bg.b) : undefined,
  bold: cell.bold,
  underline: cell.underline !== false,
  inverse: cell.inverse,
});

const renderLine = (cells: readonly Cell[]): TerminalRenderRichLine => {
  const spans: TerminalRenderRichSpan[] = [];
  let currentStyle: CellStyle | null = null;
  let currentText = "";

  const flush = (): void => {
    if (!currentStyle || currentText.length === 0) {
      return;
    }
    spans.push({
      text: currentText,
      fg: currentStyle.fg,
      bg: currentStyle.bg,
      bold: currentStyle.bold,
      underline: currentStyle.underline,
      inverse: currentStyle.inverse,
    });
    currentText = "";
  };

  for (const cell of cells) {
    if (cell.continuation) {
      continue;
    }
    const style = toStyle(cell);
    if (!currentStyle || !styleEquals(currentStyle, style)) {
      flush();
      currentStyle = style;
    }
    currentText += cell.char.length === 0 ? " " : cell.char;
  }

  flush();
  return { spans };
};

const createEmptyLine = (cols: number): Cell[] =>
  Array.from({ length: Math.max(1, Math.trunc(cols)) }, () => ({
    char: "",
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    underlineColor: null,
    strikethrough: false,
    inverse: false,
    blink: false,
    hidden: false,
    wide: false,
    continuation: false,
    hyperlink: null,
  }));

const normalizeViewportLines = (lines: Cell[][], rows: number, cols: number): Cell[][] => {
  const safeRows = Math.max(1, Math.trunc(rows));
  const normalized = lines.slice(0, safeRows);
  while (normalized.length < safeRows) {
    normalized.push(createEmptyLine(cols));
  }
  return normalized;
};

export const readTerminalLinesRange = (
  bridge: TerminalStructuredReadable,
  startRow: number,
  rowCount: number,
): Cell[][] => {
  const safeStart = Math.max(0, Math.trunc(startRow));
  const safeRows = Math.max(1, Math.trunc(rowCount));
  if (typeof bridge.getLinesRange === "function") {
    return bridge.getLinesRange(safeStart, safeRows);
  }
  return Array.from({ length: safeRows }, (_, index) => bridge.getLine(safeStart + index));
};

const readViewportLines = (
  bridge: TerminalStructuredReadable,
  scrollback: ScrollbackState,
): Cell[][] => {
  if (typeof bridge.getViewportLines === "function") {
    return normalizeViewportLines(bridge.getViewportLines(), bridge.rows, bridge.cols);
  }
  return normalizeViewportLines(
    readTerminalLinesRange(bridge, scrollback.viewportOffset, bridge.rows),
    bridge.rows,
    bridge.cols,
  );
};

export const renderStructuredViewportBuffer = (bridge: TerminalStructuredReadable): TerminalStructuredRender => {
  const cursor = bridge.getCursor();
  const scrollback = bridge.getScrollback();
  const lines = readViewportLines(bridge, scrollback);
  const cursorY = Math.max(0, cursor.y - scrollback.viewportOffset);
  return {
    richLines: lines.map((line: Cell[]) => renderLine(line)),
    cursor: {
      x: cursor.x,
      y: cursorY,
      visible: cursor.visible,
    },
    scrollback,
    rows: bridge.rows,
    cols: bridge.cols,
  };
};

export const renderStructuredBuffer = (bridge: TerminalStructuredReadable): TerminalStructuredRender => {
  const lines = bridge.getLines();
  const cursor = bridge.getCursor();
  const scrollback = bridge.getScrollback();
  return {
    richLines: lines.map((line: Cell[]) => renderLine(line)),
    cursor: {
      x: cursor.x,
      y: cursor.y,
      visible: cursor.visible,
    },
    scrollback,
    rows: bridge.rows,
    cols: bridge.cols,
  };
};
