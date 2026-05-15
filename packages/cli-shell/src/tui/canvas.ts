import { fitTerminalText, measureTerminalText } from "./cell-width";

export interface TerminalCanvasCell {
  char: string;
  fg?: string;
  bg?: string;
  wideContinuation?: boolean;
}

type CanvasRow = TerminalCanvasCell[];

export interface TerminalCanvasSpan {
  text: string;
  fg?: string;
  bg?: string;
}

export interface TerminalCanvasStyledLine {
  spans: TerminalCanvasSpan[];
}

export interface TerminalCanvas {
  width: number;
  height: number;
  rows: CanvasRow[];
}

const toTerminalChars = (text: string): string[] => Array.from(text);
const isAsciiWhitespace = (text: string): boolean => /^[ \t]+$/.test(text);
const isAsciiWordCharacter = (char: string): boolean => /^[A-Za-z0-9_.,:;!?()[\]{}'"`~@#$%^&*+=/\\|-]$/.test(char);

const tokenizeWrappedText = (
  text: string,
): Array<{ kind: "newline" } | { kind: "space" | "word" | "glyph"; text: string }> => {
  const tokens: Array<{ kind: "newline" } | { kind: "space" | "word" | "glyph"; text: string }> = [];
  let buffer = "";
  let bufferKind: "space" | "word" | null = null;
  const flush = () => {
    if (bufferKind && buffer.length > 0) {
      tokens.push({ kind: bufferKind, text: buffer });
    }
    buffer = "";
    bufferKind = null;
  };
  for (const char of toTerminalChars(text)) {
    if (char === "\n") {
      flush();
      tokens.push({ kind: "newline" });
      continue;
    }
    const nextKind = isAsciiWhitespace(char) ? "space" : isAsciiWordCharacter(char) ? "word" : "glyph";
    if (nextKind === "glyph") {
      flush();
      tokens.push({ kind: "glyph", text: char });
      continue;
    }
    if (bufferKind !== nextKind) {
      flush();
      bufferKind = nextKind;
    }
    buffer += char;
  }
  flush();
  return tokens;
};

export const splitTerminalTextToWidth = (input: {
  text: string;
  width: number;
  maxRows?: number;
}): string[] => {
  if (input.width <= 0 || input.maxRows !== undefined && input.maxRows <= 0) {
    return [];
  }
  const rows: string[] = [];
  let current = "";
  let currentWidth = 0;
  const maxRows = input.maxRows ?? Number.POSITIVE_INFINITY;
  const pushCurrent = () => {
    if (rows.length >= maxRows) {
      return false;
    }
    rows.push(current);
    current = "";
    currentWidth = 0;
    return true;
  };
  const appendGlyph = (char: string): boolean => {
    const charWidth = Math.max(1, measureTerminalText(char));
    if (charWidth > input.width) {
      return true;
    }
    if (currentWidth > 0 && currentWidth + charWidth > input.width && !pushCurrent()) {
      return false;
    }
    if (rows.length >= maxRows) {
      return false;
    }
    current += char;
    currentWidth += charWidth;
    return true;
  };

  for (const token of tokenizeWrappedText(input.text)) {
    if (rows.length >= maxRows) {
      break;
    }
    if (token.kind === "newline") {
      if (!pushCurrent()) {
        break;
      }
      continue;
    }
    const tokenWidth = measureTerminalText(token.text);
    if (token.kind === "space" && currentWidth === 0) {
      continue;
    }
    if (token.kind !== "space" && currentWidth > 0 && tokenWidth <= input.width && currentWidth + tokenWidth > input.width) {
      if (!pushCurrent()) {
        break;
      }
    }
    if (token.kind === "space" && currentWidth + tokenWidth > input.width) {
      if (!pushCurrent()) {
        break;
      }
      continue;
    }
    for (const char of toTerminalChars(token.text)) {
      if (!appendGlyph(char)) {
        break;
      }
    }
  }
  if (rows.length < maxRows && (current.length > 0 || rows.length === 0)) {
    rows.push(current);
  }
  return rows;
};

export const cloneCanvasCell = (cell: TerminalCanvasCell): TerminalCanvasCell => ({
  char: cell.char,
  fg: cell.fg,
  bg: cell.bg,
  wideContinuation: cell.wideContinuation,
});

export const createTerminalCanvas = (width: number, height: number): TerminalCanvas => ({
  width: Math.max(0, width),
  height: Math.max(0, height),
  rows: Array.from({ length: Math.max(0, height) }, () =>
    Array.from({ length: Math.max(0, width) }, () => ({
      char: " ",
    })),
  ),
});

export const writeCanvasText = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col: number;
    text: string;
    width?: number;
    fg?: string;
    bg?: string;
  },
): void => {
  if (input.row < 0 || input.row >= canvas.height || input.col >= canvas.width) {
    return;
  }

  const maxWidth = Math.max(0, Math.min(canvas.width - input.col, input.width ?? canvas.width - input.col));
  if (maxWidth <= 0) {
    return;
  }

  let col = input.col;
  const clipped = fitTerminalText(input.text, maxWidth);
  for (const char of toTerminalChars(clipped)) {
    const width = Math.max(1, measureTerminalText(char));
    if (col + width > canvas.width) {
      break;
    }
      canvas.rows[input.row]![col] = {
        char,
        fg: input.fg,
        bg: input.bg,
      };
      for (let index = 1; index < width; index += 1) {
        canvas.rows[input.row]![col + index] = {
          char: "",
          fg: input.fg,
          bg: input.bg,
          wideContinuation: true,
        };
      }
    col += width;
  }
};

export const writeCanvasStyledText = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col: number;
    spans: readonly TerminalCanvasSpan[];
    width?: number;
  },
): void => {
  if (input.row < 0 || input.row >= canvas.height || input.col >= canvas.width) {
    return;
  }
  const maxWidth = Math.max(0, Math.min(canvas.width - input.col, input.width ?? canvas.width - input.col));
  if (maxWidth <= 0) {
    return;
  }

  let col = input.col;
  let consumedWidth = 0;
  for (const span of input.spans) {
    if (consumedWidth >= maxWidth) {
      break;
    }
    const clipped = span.text;
    for (const char of toTerminalChars(clipped)) {
      const width = Math.max(1, measureTerminalText(char));
      if (col + width > canvas.width || consumedWidth + width > maxWidth) {
        break;
      }
      canvas.rows[input.row]![col] = {
        char,
        fg: span.fg,
        bg: span.bg,
      };
      for (let index = 1; index < width; index += 1) {
        canvas.rows[input.row]![col + index] = {
          char: "",
          fg: span.fg,
          bg: span.bg,
          wideContinuation: true,
        };
      }
      col += width;
      consumedWidth += width;
    }
  }
};

export const writeCanvasStyledWrappedText = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col: number;
    spans: readonly TerminalCanvasSpan[];
    width: number;
    maxRows: number;
  },
): number => {
  if (input.width <= 0 || input.maxRows <= 0) {
    return 0;
  }
  let rowOffset = 0;
  let colOffset = 0;
  const writeGlyph = (span: TerminalCanvasSpan, char: string): boolean => {
    if (rowOffset >= input.maxRows) {
      return false;
    }
    const charWidth = Math.max(1, measureTerminalText(char));
    if (charWidth > input.width) {
      return true;
    }
    if (colOffset > 0 && colOffset + charWidth > input.width) {
      rowOffset += 1;
      colOffset = 0;
    }
    if (rowOffset >= input.maxRows) {
      return false;
    }
    const targetRow = input.row + rowOffset;
    const targetCol = input.col + colOffset;
    if (targetRow >= 0 && targetRow < canvas.height && targetCol >= 0 && targetCol + charWidth <= canvas.width) {
      canvas.rows[targetRow]![targetCol] = {
        char,
        fg: span.fg,
        bg: span.bg,
      };
      for (let index = 1; index < charWidth; index += 1) {
        canvas.rows[targetRow]![targetCol + index] = {
          char: "",
          fg: span.fg,
          bg: span.bg,
          wideContinuation: true,
        };
      }
    }
    colOffset += charWidth;
    return true;
  };
  for (const span of input.spans) {
    for (const token of tokenizeWrappedText(span.text)) {
      if (rowOffset >= input.maxRows) {
        return rowOffset;
      }
      if (token.kind === "newline") {
        rowOffset += 1;
        colOffset = 0;
        continue;
      }
      const tokenWidth = measureTerminalText(token.text);
      if (token.kind === "space" && colOffset === 0) {
        continue;
      }
      if (token.kind !== "space" && colOffset > 0 && tokenWidth <= input.width && colOffset + tokenWidth > input.width) {
        rowOffset += 1;
        colOffset = 0;
      }
      if (rowOffset >= input.maxRows) {
        return rowOffset;
      }
      if (token.kind === "space" && colOffset + tokenWidth > input.width) {
        rowOffset += 1;
        colOffset = 0;
        continue;
      }
      for (const char of toTerminalChars(token.text)) {
        if (!writeGlyph(span, char)) {
          return rowOffset;
        }
      }
    }
  }
  return rowOffset + (colOffset > 0 ? 1 : 0);
};

export const fillCanvasRow = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col?: number;
    width?: number;
    char?: string;
    fg?: string;
    bg?: string;
  },
): void => {
  if (input.row < 0 || input.row >= canvas.height) {
    return;
  }
  const col = Math.max(0, input.col ?? 0);
  const width = Math.max(0, Math.min(canvas.width - col, input.width ?? canvas.width - col));
  const char = input.char ?? " ";
  for (let index = 0; index < width; index += 1) {
    canvas.rows[input.row]![col + index] = {
      char,
      fg: input.fg,
      bg: input.bg,
    };
  }
};

export const drawCanvasVerticalLine = (
  canvas: TerminalCanvas,
  input: {
    col: number;
    row?: number;
    height?: number;
    char?: string;
    fg?: string;
    bg?: string;
  },
): void => {
  const col = input.col;
  if (col < 0 || col >= canvas.width) {
    return;
  }
  const row = Math.max(0, input.row ?? 0);
  const height = Math.max(0, Math.min(canvas.height - row, input.height ?? canvas.height - row));
  const char = input.char ?? "│";
  for (let index = 0; index < height; index += 1) {
    canvas.rows[row + index]![col] = {
      char,
      fg: input.fg,
      bg: input.bg,
    };
  }
};

export const drawCanvasHorizontalLine = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col?: number;
    width?: number;
    char?: string;
    fg?: string;
    bg?: string;
  },
): void => {
  fillCanvasRow(canvas, {
    row: input.row,
    col: input.col,
    width: input.width,
    char: input.char ?? "─",
    fg: input.fg,
    bg: input.bg,
  });
};

export const drawCanvasRectangle = (
  canvas: TerminalCanvas,
  input: {
    row: number;
    col: number;
    width: number;
    height: number;
    borderColor?: string;
    fillColor?: string;
    fillChar?: string;
  },
): void => {
  if (input.width <= 0 || input.height <= 0) {
    return;
  }
  const right = input.col + input.width - 1;
  const bottom = input.row + input.height - 1;
  if (input.fillColor || input.fillChar) {
    for (let row = input.row + 1; row < bottom; row += 1) {
      fillCanvasRow(canvas, {
        row,
        col: input.col + 1,
        width: Math.max(0, input.width - 2),
        char: input.fillChar ?? " ",
        bg: input.fillColor,
      });
    }
  }
  if (input.height >= 1) {
    drawCanvasHorizontalLine(canvas, {
      row: input.row,
      col: input.col,
      width: input.width,
      char: "─",
      fg: input.borderColor,
    });
    drawCanvasHorizontalLine(canvas, {
      row: bottom,
      col: input.col,
      width: input.width,
      char: "─",
      fg: input.borderColor,
    });
  }
  if (input.height >= 2) {
    drawCanvasVerticalLine(canvas, {
      col: input.col,
      row: input.row,
      height: input.height,
      char: "│",
      fg: input.borderColor,
    });
    drawCanvasVerticalLine(canvas, {
      col: right,
      row: input.row,
      height: input.height,
      char: "│",
      fg: input.borderColor,
    });
    canvas.rows[input.row]![input.col] = {
      char: "┌",
      fg: input.borderColor,
    };
    canvas.rows[input.row]![right] = {
      char: "┐",
      fg: input.borderColor,
    };
    canvas.rows[bottom]![input.col] = {
      char: "└",
      fg: input.borderColor,
    };
    canvas.rows[bottom]![right] = {
      char: "┘",
      fg: input.borderColor,
    };
  }
};

export const blitCanvas = (
  target: TerminalCanvas,
  input: {
    source: TerminalCanvas;
    row: number;
    col: number;
  },
): void => {
  for (let row = 0; row < input.source.height; row += 1) {
    const targetRow = input.row + row;
    if (targetRow < 0 || targetRow >= target.height) {
      continue;
    }
    for (let col = 0; col < input.source.width; col += 1) {
      const targetCol = input.col + col;
      if (targetCol < 0 || targetCol >= target.width) {
        continue;
      }
      const cell = input.source.rows[row]?.[col];
      if (!cell) {
        continue;
      }
      target.rows[targetRow]![targetCol] = cloneCanvasCell(cell);
    }
  }
};

export const renderCanvasLines = (canvas: TerminalCanvas): string[] =>
  canvas.rows.map((row) => row.map((cell) => (cell.wideContinuation ? "" : cell.char)).join(""));

export const renderCanvasStyledLines = (canvas: TerminalCanvas): TerminalCanvasStyledLine[] =>
  canvas.rows.map((row) => {
    const spans: TerminalCanvasSpan[] = [];
    for (const cell of row) {
      if (cell.wideContinuation) {
        continue;
      }
      const previous = spans.at(-1);
      if (previous && previous.fg === cell.fg && previous.bg === cell.bg) {
        previous.text += cell.char;
        continue;
      }
      spans.push({
        text: cell.char,
        fg: cell.fg,
        bg: cell.bg,
      });
    }
    return {
      spans,
    };
  });
