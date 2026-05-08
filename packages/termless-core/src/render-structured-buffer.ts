import type { Cell, TerminalReadable } from "./termless-types.js";

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

export const renderStructuredBuffer = (bridge: Pick<TerminalReadable, "getCursor" | "getLines" | "getScrollback"> & { rows: number; cols: number }): TerminalStructuredRender => {
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
