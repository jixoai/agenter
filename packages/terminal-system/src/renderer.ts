import { renderStructuredBuffer as renderStructuredBufferCore } from "@agenter/termless-core";
import type { Cell } from "@agenter/termless-core";

import type { RenderResult, RichLine, RichSpan, StructuredRenderResult, TerminalLogStyle } from "./types";
import type { XtermBridge } from "./xterm-bridge";

type ColorTag = string | undefined;
type ColorHex = string | undefined;

interface CellStyle {
  fgTag: ColorTag;
  bgTag: ColorTag;
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

const FG_TAGS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "bright-black",
  "bright-red",
  "bright-green",
  "bright-yellow",
  "bright-blue",
  "bright-magenta",
  "bright-cyan",
  "bright-white",
] as const;

const BG_TAGS = FG_TAGS.map((name) => `bg-${name}`);

const COLOR_ANCHORS: Array<{ tag: (typeof FG_TAGS)[number]; rgb: [number, number, number] }> = [
  { tag: "black", rgb: [0, 0, 0] },
  { tag: "red", rgb: [205, 49, 49] },
  { tag: "green", rgb: [13, 188, 121] },
  { tag: "yellow", rgb: [229, 229, 16] },
  { tag: "blue", rgb: [36, 114, 200] },
  { tag: "magenta", rgb: [188, 63, 188] },
  { tag: "cyan", rgb: [17, 168, 205] },
  { tag: "white", rgb: [229, 229, 229] },
  { tag: "bright-black", rgb: [102, 102, 102] },
  { tag: "bright-red", rgb: [241, 76, 76] },
  { tag: "bright-green", rgb: [35, 209, 139] },
  { tag: "bright-yellow", rgb: [245, 245, 67] },
  { tag: "bright-blue", rgb: [59, 142, 234] },
  { tag: "bright-magenta", rgb: [214, 112, 214] },
  { tag: "bright-cyan", rgb: [41, 184, 219] },
  { tag: "bright-white", rgb: [255, 255, 255] },
];

const emptyStyle: CellStyle = {
  fgTag: undefined,
  bgTag: undefined,
  fgColor: undefined,
  bgColor: undefined,
  bold: false,
  underline: false,
  inverse: false,
};

const styleEquals = (a: CellStyle, b: CellStyle): boolean =>
  a.fgTag === b.fgTag &&
  a.bgTag === b.bgTag &&
  a.fgColor === b.fgColor &&
  a.bgColor === b.bgColor &&
  a.bold === b.bold &&
  a.underline === b.underline &&
  a.inverse === b.inverse;

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const wrapByStyle = (text: string, style: CellStyle): string => {
  let output = escapeHtml(text);
  if (style.fgTag) {
    output = `<${style.fgTag}>${output}</${style.fgTag}>`;
  }
  if (style.bgTag) {
    output = `<${style.bgTag}>${output}</${style.bgTag}>`;
  }
  if (style.bold) {
    output = `<b>${output}</b>`;
  }
  if (style.underline) {
    output = `<u>${output}</u>`;
  }
  if (style.inverse) {
    output = `<inverse>${output}</inverse>`;
  }
  return output;
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

const toFgColor = (cell: Cell): ColorHex =>
  cell.fg ? rgbToHex(cell.fg.r, cell.fg.g, cell.fg.b) : undefined;

const toBgColor = (cell: Cell): ColorHex =>
  cell.bg ? rgbToHex(cell.bg.r, cell.bg.g, cell.bg.b) : undefined;

const toTagFromHex = (hex: string | undefined): ColorTag => {
  if (!hex) {
    return undefined;
  }
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return undefined;
  }
  return nearestSemanticTag(rgb[0], rgb[1], rgb[2]);
};

const toFgTag = (cell: Cell): ColorTag => toTagFromHex(toFgColor(cell));

const toBgTag = (cell: Cell): ColorTag => {
  const fgTag = toTagFromHex(toBgColor(cell));
  return fgTag ? `bg-${fgTag}` : undefined;
};

const toStyle = (cell: Cell): CellStyle => ({
  fgTag: toFgTag(cell),
  bgTag: toBgTag(cell),
  fgColor: toFgColor(cell),
  bgColor: toBgColor(cell),
  bold: cell.bold,
  underline: cell.underline !== false,
  inverse: cell.inverse,
});

const readCell = (cell: Cell | undefined): StyledChar => {
  if (!cell) {
    return { text: " ", style: emptyStyle };
  }
  if (cell.continuation) {
    return { text: "", style: emptyStyle };
  }
  const text = cell.char.length === 0 ? " " : cell.char;
  return { text, style: toStyle(cell) };
};

const renderLine = (chars: StyledChar[]): { rich: RichSpan[] } => {
  const end = chars.length - 1;
  if (end < 0) {
    return {
      rich: [],
    };
  }

  const richOut: RichSpan[] = [];
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

  for (let index = 0; index <= end; index += 1) {
    const item = chars[index] ?? { text: " ", style: emptyStyle };
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
  return { rich: richOut };
};

export const stripHtmlTags = (text: string): string => text.replace(/<[^>]+>/g, "");

const trimRichLineTrailingWhitespace = (line: RichLine): RichLine => {
  const spans = line.spans.map((span) => ({ ...span }));
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index]!;
    const trimmed = span.text.replace(/\s+$/g, "");
    if (trimmed.length === 0) {
      spans.pop();
      continue;
    }
    span.text = trimmed;
    spans.length = index + 1;
    break;
  }
  return { spans };
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    return null;
  }
  const raw = match[1]!;
  const value = Number.parseInt(raw, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const toFgTagFromHex = (hex: string | undefined): ColorTag => {
  if (!hex) {
    return undefined;
  }
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return undefined;
  }
  return nearestSemanticTag(rgb[0], rgb[1], rgb[2]);
};

const toBgTagFromHex = (hex: string | undefined): ColorTag => {
  const fgTag = toFgTagFromHex(hex);
  return fgTag ? `bg-${fgTag}` : undefined;
};

const toSpanStyle = (span: RichSpan): CellStyle => ({
  fgTag: toFgTagFromHex(span.fg),
  bgTag: toBgTagFromHex(span.bg),
  fgColor: span.fg,
  bgColor: span.bg,
  bold: Boolean(span.bold),
  underline: Boolean(span.underline),
  inverse: Boolean(span.inverse),
});

const splitTextAtColumn = (text: string, column: number): [string, string] => {
  const chars = Array.from(text);
  const safeColumn = Math.max(0, Math.min(column, chars.length));
  return [chars.slice(0, safeColumn).join(""), chars.slice(safeColumn).join("")];
};

const richLineToHtml = (line: RichLine, cursorCol: number | null): string => {
  const normalizedCursor = cursorCol === null ? null : Math.max(0, cursorCol);
  let out = "";
  let offset = 0;
  let cursorInjected = normalizedCursor === null;

  for (const span of line.spans) {
    if (span.text.length === 0) {
      continue;
    }
    const style = toSpanStyle(span);
    const chars = Array.from(span.text);
    const spanWidth = chars.length;
    const spanEnd = offset + spanWidth;
    if (!cursorInjected && normalizedCursor !== null && normalizedCursor >= offset && normalizedCursor <= spanEnd) {
      const [left, right] = splitTextAtColumn(span.text, normalizedCursor - offset);
      if (left.length > 0) {
        out += wrapByStyle(left, style);
      }
      out += "<cursor/>";
      if (right.length > 0) {
        out += wrapByStyle(right, style);
      }
      cursorInjected = true;
      offset = spanEnd;
      continue;
    }
    out += wrapByStyle(span.text, style);
    offset = spanEnd;
  }

  if (!cursorInjected && normalizedCursor !== null && normalizedCursor >= offset) {
    out += "<cursor/>";
  }
  return out;
};

const richLineToPlainHtml = (line: RichLine, cursorCol: number | null): string => {
  const text = richLineToPlain(line);
  if (cursorCol === null) {
    return escapeHtml(text);
  }
  const [left, right] = splitTextAtColumn(text, cursorCol);
  return `${escapeHtml(left)}<cursor/>${escapeHtml(right)}`;
};

const cursorColForRow = (
  render: Pick<StructuredRenderResult, "cursorVisible" | "cursorAbsRow" | "cursorCol">,
  row: number,
): number | null => {
  if (!render.cursorVisible || render.cursorAbsRow !== row) {
    return null;
  }
  return render.cursorCol;
};

export const serializeStructuredLinesForLog = (
  render: Pick<StructuredRenderResult, "richLines" | "cursorVisible" | "cursorAbsRow" | "cursorCol">,
  logStyle: TerminalLogStyle,
): string[] => {
  const lines: string[] = [];
  for (let row = 0; row < render.richLines.length; row += 1) {
    const line = render.richLines[row] ?? { spans: [] };
    const cursorCol = cursorColForRow(render, row);
    lines.push(logStyle === "rich" ? richLineToHtml(line, cursorCol) : richLineToPlainHtml(line, cursorCol));
  }
  return lines;
};

export const serializeRenderLinesForLog = (render: RenderResult, logStyle: TerminalLogStyle): string[] =>
  serializeStructuredLinesForLog(render, logStyle);

const richLineToPlain = (line: RichLine): string => line.spans.map((span) => span.text).join("");

/**
 * Final persistence compaction:
 * - trims trailing whitespace from each line after render
 * - keeps cursor coordinates unchanged (still raw xterm-based)
 */
export const compactRenderForPersistence = (render: RenderResult): RenderResult => {
  const richLines = render.richLines.map((line) => trimRichLineTrailingWhitespace(line));
  const lines = serializeStructuredLinesForLog(
    {
      ...render,
      richLines,
    },
    "rich",
  );
  const plainLines = richLines.map((line) => richLineToPlain(line));
  return {
    ...render,
    lines,
    plainLines,
    richLines,
  };
};

export const renderStructuredBuffer = (bridge: XtermBridge): StructuredRenderResult => {
  const structured = renderStructuredBufferCore(bridge);
  return {
    richLines: structured.richLines,
    cursorAbsRow: structured.cursor.y,
    cursorCol: structured.cursor.x,
    cursorVisible: structured.cursor.visible ?? true,
    rows: structured.rows,
    cols: structured.cols,
    scrollback: structured.scrollback,
  };
};

export const renderSemanticBuffer = (bridge: XtermBridge): RenderResult => {
  const structured = renderStructuredBuffer(bridge);
  const lines = serializeStructuredLinesForLog(structured, "rich");
  const plainLines = structured.richLines.map((line) => richLineToPlain(line));
  return {
    lines,
    plainLines,
    richLines: structured.richLines,
    cursorAbsRow: structured.cursorAbsRow,
    cursorCol: structured.cursorCol,
    cursorVisible: structured.cursorVisible,
  };
};

const paletteIndexToRgb = (index: number): [number, number, number] => {
  if (index < 0 || index > 255) {
    return [255, 255, 255];
  }
  if (index < 16) {
    return COLOR_ANCHORS[index]?.rgb ?? [255, 255, 255];
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

const nearestSemanticTag = (r: number, g: number, b: number): (typeof FG_TAGS)[number] => {
  let best = COLOR_ANCHORS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const anchor of COLOR_ANCHORS) {
    const dr = r - anchor.rgb[0];
    const dg = g - anchor.rgb[1];
    const db = b - anchor.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = anchor;
    }
  }
  return best.tag;
};
