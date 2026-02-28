import type { KeyEvent } from "@opentui/core";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";

import type { RenderResult, RichLine, RichSpan, TerminalStatus } from "../types";

export const ATI_TUI_VIEWPORT_COLS_RESERVED = 2;
export const ATI_TUI_VIEWPORT_ROWS_RESERVED = 4;

export const resolveAtiTuiViewportSize = (
  width: number,
  height: number,
): { cols: number; rows: number } => ({
  cols: Math.max(1, width - ATI_TUI_VIEWPORT_COLS_RESERVED),
  rows: Math.max(1, height - ATI_TUI_VIEWPORT_ROWS_RESERVED),
});

interface AtiTuiOptions {
  metaLine: string;
  onInput: (data: string) => void;
  onQuit: () => void;
  onResize: (cols: number, rows: number) => void;
}

interface AtiSnapshot {
  metaLine: string;
  status: TerminalStatus;
  cursorRow: number;
  cursorCol: number;
  cursorVisible: boolean;
  cursorSource: "inverse" | "hardware" | "sticky" | "none";
  rawCursorRow: number;
  rawCursorCol: number;
  lines: RichLine[];
}

const CTRL_A_CODE = "a".charCodeAt(0);

const arrowMap: Record<string, string> = {
  up: "\u001b[A",
  down: "\u001b[B",
  right: "\u001b[C",
  left: "\u001b[D",
  home: "\u001b[H",
  end: "\u001b[F",
  delete: "\u001b[3~",
  pageup: "\u001b[5~",
  pagedown: "\u001b[6~",
};

const encodeTerminalKey = (key: KeyEvent): string | null => {
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

  if (arrowMap[key.name]) {
    return arrowMap[key.name];
  }

  if (key.ctrl && key.name.length === 1 && /^[a-z]$/.test(key.name)) {
    const code = key.name.charCodeAt(0) - CTRL_A_CODE + 1;
    return String.fromCharCode(code);
  }

  if (key.sequence && key.sequence.length > 0 && !key.meta) {
    return key.sequence;
  }
  if (key.raw && key.raw.length > 0 && !key.meta) {
    return key.raw;
  }
  return null;
};

const cloneSpan = (span: RichSpan, text: string): RichSpan => ({
  text,
  fg: span.fg,
  bg: span.bg,
  bold: span.bold,
  underline: span.underline,
});

const injectCursor = (line: RichLine, col: number): RichLine => {
  const safeCol = Math.max(0, col);
  const out: RichSpan[] = [];
  let consumed = 0;
  let inserted = false;

  for (const span of line.spans) {
    if (inserted) {
      out.push(span);
      consumed += span.text.length;
      continue;
    }
    const next = consumed + span.text.length;
    if (safeCol > next) {
      out.push(span);
      consumed = next;
      continue;
    }

    const cut = Math.max(0, Math.min(span.text.length, safeCol - consumed));
    const before = span.text.slice(0, cut);
    const after = span.text.slice(cut);
    if (before.length > 0) {
      out.push(cloneSpan(span, before));
    }
    out.push({
      text: "█",
      fg: span.bg ?? "#000000",
      bg: span.fg ?? "#ffffff",
      bold: true,
    });
    if (after.length > 0) {
      out.push(cloneSpan(span, after));
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

const findInverseCursor = (lines: RichLine[]): { row: number; col: number } | null => {
  for (let row = lines.length - 1; row >= 0; row -= 1) {
    const spans = lines[row]?.spans ?? [];
    let col = 0;
    for (const span of spans) {
      if (span.inverse && span.text.length > 0) {
        return { row, col };
      }
      col += span.text.length;
    }
  }
  return null;
};

class AtiTuiStore {
  private snapshot: AtiSnapshot;
  private stickyCursor: { row: number; col: number } | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(metaLine: string) {
    this.snapshot = {
      metaLine,
      status: "IDLE",
      cursorRow: 1,
      cursorCol: 1,
      cursorVisible: true,
      cursorSource: "none",
      rawCursorRow: 1,
      rawCursorCol: 1,
      lines: [],
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AtiSnapshot => this.snapshot;

  updateMeta(metaLine: string): void {
    this.snapshot = { ...this.snapshot, metaLine };
    this.emit();
  }

  updateRender(render: RenderResult, status: TerminalStatus, viewportRows: number): void {
    const lines = render.richLines;
    const safeRows = Math.max(1, viewportRows);
    const inverseCursor = findInverseCursor(lines);

    let resolvedCursor = {
      row: render.cursorAbsRow,
      col: render.cursorCol,
      source: "none" as AtiSnapshot["cursorSource"],
    };
    if (inverseCursor) {
      resolvedCursor = {
        row: inverseCursor.row,
        col: inverseCursor.col,
        source: "inverse",
      };
      this.stickyCursor = { row: inverseCursor.row, col: inverseCursor.col };
    } else if (render.cursorVisible) {
      resolvedCursor = {
        row: render.cursorAbsRow,
        col: render.cursorCol,
        source: "hardware",
      };
      this.stickyCursor = { row: render.cursorAbsRow, col: render.cursorCol };
    } else if (this.stickyCursor) {
      resolvedCursor = {
        row: this.stickyCursor.row,
        col: this.stickyCursor.col,
        source: "sticky",
      };
    }

    const maxRow = Math.max(0, lines.length - 1);
    const focusRow = Math.max(0, Math.min(maxRow, resolvedCursor.row));
    const start = Math.max(0, focusRow - safeRows + 1);
    const end = Math.min(lines.length, start + safeRows);
    const view = lines.slice(start, end).map((line) => ({ spans: [...line.spans] }));
    const cursorRowInView = resolvedCursor.row - start;
    if (resolvedCursor.source === "hardware" && cursorRowInView >= 0 && cursorRowInView < view.length) {
      const raw = view[cursorRowInView] ?? { spans: [] };
      view[cursorRowInView] = injectCursor(raw, resolvedCursor.col);
    }

    this.snapshot = {
      ...this.snapshot,
      status,
      cursorRow: resolvedCursor.row + 1,
      cursorCol: resolvedCursor.col + 1,
      cursorVisible: render.cursorVisible,
      cursorSource: resolvedCursor.source,
      rawCursorRow: render.cursorAbsRow + 1,
      rawCursorCol: render.cursorCol + 1,
      lines: view,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

interface AtiTerminalAppProps {
  store: AtiTuiStore;
  onInput: (data: string) => void;
  onQuit: () => void;
  onResize: (cols: number, rows: number) => void;
}

const AtiTerminalApp = ({ store, onInput, onQuit, onResize }: AtiTerminalAppProps) => {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { width, height } = useTerminalDimensions();
  const { cols: viewportCols, rows: viewportRows } = resolveAtiTuiViewportSize(width, height);

  useEffect(() => {
    onResize(viewportCols, viewportRows);
  }, [onResize, viewportCols, viewportRows]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "q") {
      onQuit();
      return true;
    }
    const encoded = encodeTerminalKey(key);
    if (!encoded) {
      return false;
    }
    onInput(encoded);
    return true;
  });

  return (
    <box width="100%" height="100%" flexDirection="column">
      <text>{state.metaLine}</text>
      <text>
        status={state.status} cursor=({state.cursorRow},{state.cursorCol}) source={state.cursorSource} raw=({state.rawCursorRow},{state.rawCursorCol})
        visible={state.cursorVisible ? "yes" : "no"} ctrl+q=quit
      </text>
      <box flexGrow={1} border borderColor="cyan">
        <text selectable>
          {state.lines.map((line, lineIndex) => (
            <span key={`line-${lineIndex}`}>
              {line.spans.map((span, spanIndex) => {
                const resolvedFg = span.inverse ? (span.bg ?? "#111111") : span.fg;
                const resolvedBg = span.inverse ? (span.fg ?? "#f3f6fb") : span.bg;
                let content: ReactNode = (
                  <span
                    key={`text-${lineIndex}-${spanIndex}`}
                    fg={resolvedFg}
                    bg={resolvedBg}
                  >
                    {span.text}
                  </span>
                );
                if (span.bold) {
                  content = <strong>{content}</strong>;
                }
                if (span.underline) {
                  content = <u>{content}</u>;
                }
                return <span key={`span-${lineIndex}-${spanIndex}`}>{content}</span>;
              })}
              {lineIndex < state.lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </text>
      </box>
    </box>
  );
};

export interface AtiTuiController {
  updateMeta(metaLine: string): void;
  updateRender(render: RenderResult, status: TerminalStatus): void;
  destroy(): void;
}

export const startAtiTui = async (options: AtiTuiOptions): Promise<AtiTuiController> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });

  const store = new AtiTuiStore(options.metaLine);
  let viewportRows = resolveAtiTuiViewportSize(process.stdout.columns ?? 120, process.stdout.rows ?? 24).rows;
  const root = createRoot(renderer);
  root.render(
    <AtiTerminalApp
      store={store}
      onInput={options.onInput}
      onQuit={options.onQuit}
      onResize={(cols, rows) => {
        viewportRows = rows;
        options.onResize(cols, rows);
      }}
    />,
  );

  return {
    updateMeta: (metaLine: string) => {
      store.updateMeta(metaLine);
    },
    updateRender: (render: RenderResult, status: TerminalStatus) => {
      store.updateRender(render, status, viewportRows);
    },
    destroy: () => {
      renderer.destroy();
    },
  };
};
