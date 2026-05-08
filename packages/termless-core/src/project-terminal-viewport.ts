import stringWidth from "string-width";

import type { TerminalRenderRichLine, TerminalRenderRichSpan } from "./render-structured-buffer.js";

export type TerminalViewportCursorSource = "inverse" | "hardware" | "sticky" | "none";

export interface ProjectedTerminalViewport {
  lines: TerminalRenderRichLine[];
  cursor: {
    row: number;
    col: number;
    visible: boolean;
    source: TerminalViewportCursorSource;
    rawRow: number;
    rawCol: number;
  };
  viewport: {
    start: number;
    end: number;
    totalLines: number;
    rows: number;
  };
}

interface StickyCursor {
  row: number;
  col: number;
}

const cloneSpan = (span: TerminalRenderRichSpan, text: string): TerminalRenderRichSpan => ({
  text,
  fg: span.fg,
  bg: span.bg,
  bold: span.bold,
  underline: span.underline,
  inverse: span.inverse,
});

const findInverseCursor = (lines: readonly TerminalRenderRichLine[]): StickyCursor | null => {
  for (let row = lines.length - 1; row >= 0; row -= 1) {
    const spans = lines[row]?.spans ?? [];
    let col = 0;
    for (const span of spans) {
      if (span.inverse && span.text.length > 0) {
        return { row, col };
      }
      col += stringWidth(span.text);
    }
  }
  return null;
};

const injectCursor = (line: TerminalRenderRichLine, col: number): TerminalRenderRichLine => {
  const safeCol = Math.max(0, col);
  const out: TerminalRenderRichSpan[] = [];
  let consumed = 0;
  let inserted = false;

  for (const span of line.spans) {
    if (inserted) {
      out.push({ ...span });
      consumed += stringWidth(span.text);
      continue;
    }
    const spanWidth = stringWidth(span.text);
    const next = consumed + spanWidth;
    if (safeCol > next) {
      out.push({ ...span });
      consumed = next;
      continue;
    }

    let left = "";
    let right = "";
    let used = consumed;
    let cursorCoveredByWideGlyph = false;
    for (const char of Array.from(span.text)) {
      const width = Math.max(1, stringWidth(char));
      const nextUsed = used + width;
      if (!cursorCoveredByWideGlyph && safeCol >= used && safeCol < nextUsed) {
        cursorCoveredByWideGlyph = true;
        right += char;
      } else if (!cursorCoveredByWideGlyph) {
        left += char;
      } else {
        right += char;
      }
      used = nextUsed;
    }

    if (left.length > 0) {
      out.push(cloneSpan(span, left));
    }
    out.push({
      text: "█",
      fg: span.bg ?? "#000000",
      bg: span.fg ?? "#ffffff",
      bold: true,
    });
    if (right.length > 0) {
      out.push(cloneSpan(span, right));
    }
    inserted = true;
    consumed = next;
  }

  if (!inserted) {
    out.push({
      text: "█",
      fg: "#000000",
      bg: "#ffffff",
      bold: true,
    });
  }

  return { spans: out };
};

export const projectTerminalViewport = (input: {
  lines: readonly TerminalRenderRichLine[];
  cursorAbsRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  viewportRows: number;
  stickyCursor?: StickyCursor | null;
}): ProjectedTerminalViewport => {
  const safeRows = Math.max(1, input.viewportRows);
  const inverseCursor = findInverseCursor(input.lines);
  let resolvedCursor = {
    row: input.cursorAbsRow,
    col: input.cursorCol,
    source: "none" as TerminalViewportCursorSource,
  };
  if (inverseCursor) {
    resolvedCursor = {
      row: inverseCursor.row,
      col: inverseCursor.col,
      source: "inverse",
    };
  } else if (input.cursorVisible) {
    resolvedCursor = {
      row: input.cursorAbsRow,
      col: input.cursorCol,
      source: "hardware",
    };
  } else if (input.stickyCursor) {
    resolvedCursor = {
      row: input.stickyCursor.row,
      col: input.stickyCursor.col,
      source: "sticky",
    };
  }

  const maxRow = Math.max(0, input.lines.length - 1);
  const focusRow = Math.max(0, Math.min(maxRow, resolvedCursor.row));
  const start = Math.max(0, focusRow - safeRows + 1);
  const end = Math.min(input.lines.length, start + safeRows);
  const view = input.lines.slice(start, end).map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  }));
  const cursorRowInView = resolvedCursor.row - start;
  if (resolvedCursor.source === "hardware" && cursorRowInView >= 0 && cursorRowInView < view.length) {
    const raw = view[cursorRowInView] ?? { spans: [] };
    view[cursorRowInView] = injectCursor(raw, resolvedCursor.col);
  }

  return {
    lines: view,
    cursor: {
      row: resolvedCursor.row,
      col: resolvedCursor.col,
      visible: input.cursorVisible,
      source: resolvedCursor.source,
      rawRow: input.cursorAbsRow,
      rawCol: input.cursorCol,
    },
    viewport: {
      start,
      end,
      totalLines: input.lines.length,
      rows: safeRows,
    },
  };
};
