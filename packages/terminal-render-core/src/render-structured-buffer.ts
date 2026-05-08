import type { IBufferCell, IBufferLine } from "./xterm-headless-module";
import type { TerminalRenderRichLine, TerminalRenderRichSpan, TerminalStructuredRender } from "./types";
import type { XtermBridge } from "./xterm-bridge";

type ColorHex = string | undefined;

interface CellStyle {
  fgColor: ColorHex;
  bgColor: ColorHex;
  bold: boolean;
  underline: boolean;
  inverse: boolean;
}

interface StyledChar {
  text: string;
  style: CellStyle;
}

const COLOR_ANCHORS: Array<[number, number, number]> = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
];

const emptyStyle: CellStyle = {
  fgColor: undefined,
  bgColor: undefined,
  bold: false,
  underline: false,
  inverse: false,
};

const styleEquals = (a: CellStyle, b: CellStyle): boolean =>
  a.fgColor === b.fgColor &&
  a.bgColor === b.bgColor &&
  a.bold === b.bold &&
  a.underline === b.underline &&
  a.inverse === b.inverse;

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

const paletteIndexToRgb = (index: number): [number, number, number] => {
  if (index < 0 || index > 255) {
    return [255, 255, 255];
  }
  if (index < 16) {
    return COLOR_ANCHORS[index] ?? [255, 255, 255];
  }
  if (index >= 16 && index <= 231) {
    const idx = index - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const level = (n: number): number => (n === 0 ? 0 : 55 + n * 40);
    return [level(r), level(g), level(b)];
  }
  const gray = 8 + (index - 232) * 10;
  return [gray, gray, gray];
};

const toFgColor = (cell: IBufferCell): ColorHex => {
  if (cell.isFgPalette()) {
    const rgb = paletteIndexToRgb(cell.getFgColor());
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  if (cell.isFgRGB()) {
    const color = cell.getFgColor();
    return rgbToHex((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  }
  return undefined;
};

const toBgColor = (cell: IBufferCell): ColorHex => {
  if (cell.isBgPalette()) {
    const rgb = paletteIndexToRgb(cell.getBgColor());
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  if (cell.isBgRGB()) {
    const color = cell.getBgColor();
    return rgbToHex((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  }
  return undefined;
};

const toStyle = (cell: IBufferCell): CellStyle => ({
  fgColor: toFgColor(cell),
  bgColor: toBgColor(cell),
  bold: cell.isBold() !== 0,
  underline: cell.isUnderline() !== 0,
  inverse: cell.isInverse() !== 0,
});

const readCell = (line: IBufferLine, index: number): StyledChar => {
  const cell = line.getCell(index);
  if (!cell || cell.getWidth() === 0) {
    return { text: cell?.getWidth() === 0 ? "" : " ", style: emptyStyle };
  }
  const chars = cell.getChars();
  return {
    text: chars.length === 0 ? " " : chars,
    style: toStyle(cell),
  };
};

const renderLine = (chars: readonly StyledChar[]): TerminalRenderRichSpan[] => {
  const richOut: TerminalRenderRichSpan[] = [];
  let currentStyle = emptyStyle;
  let currentText = "";

  const flush = (): void => {
    if (currentText.length === 0) {
      return;
    }
    richOut.push({
      text: currentText,
      fg: currentStyle.fgColor,
      bg: currentStyle.bgColor,
      bold: currentStyle.bold,
      underline: currentStyle.underline,
      inverse: currentStyle.inverse,
    });
    currentText = "";
  };

  for (const item of chars) {
    if (item.text.length === 0) {
      continue;
    }
    if (!styleEquals(currentStyle, item.style)) {
      flush();
      currentStyle = item.style;
    }
    currentText += item.text;
  }

  flush();
  return richOut;
};

export const renderStructuredBuffer = (bridge: XtermBridge): TerminalStructuredRender => {
  const buffer = bridge.buffer;
  const cursorAbsRow = buffer.baseY + buffer.cursorY;
  const cursorCol = buffer.cursorX;
  const cursorVisible = bridge.cursorVisible;
  const richLines: TerminalRenderRichLine[] = [];

  for (let row = 0; row < buffer.length; row += 1) {
    const line = buffer.getLine(row);
    if (!line) {
      richLines.push({ spans: [] });
      continue;
    }
    const cells: StyledChar[] = [];
    for (let col = 0; col < bridge.cols; col += 1) {
      cells[col] = readCell(line, col);
    }
    richLines.push({
      spans: renderLine(cells),
    });
  }

  return {
    richLines,
    cursorAbsRow,
    cursorCol,
    cursorVisible,
    rows: bridge.rows,
    cols: bridge.cols,
  };
};
