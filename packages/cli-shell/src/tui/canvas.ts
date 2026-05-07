import { fitTerminalText, measureTerminalText } from "./cell-width";

export interface TerminalCanvasCell {
  char: string;
  fg?: string;
  bg?: string;
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
      };
    }
    col += width;
  }
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

export const renderCanvasLines = (canvas: TerminalCanvas): string[] =>
  canvas.rows.map((row) => row.map((cell) => cell.char).join(""));

export const renderCanvasStyledLines = (canvas: TerminalCanvas): TerminalCanvasStyledLine[] =>
  canvas.rows.map((row) => {
    const spans: TerminalCanvasSpan[] = [];
    for (const cell of row) {
      if (cell.char.length === 0) {
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
