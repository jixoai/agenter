import type { KeyEvent } from "@opentui/core";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useTerminalDimensions } from "@opentui/react";
import { projectTerminalViewport } from "@agenter/termless-core";
import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";

import type { RenderResult, RichLine, RichSpan, TerminalStatus } from "../types";

export const ATI_TUI_VIEWPORT_COLS_RESERVED = 2;
export const ATI_TUI_VIEWPORT_ROWS_RESERVED = 4;

export const resolveAtiTuiViewportSize = (width: number, height: number): { cols: number; rows: number } => ({
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
    const projection = projectTerminalViewport({
      lines: render.richLines,
      cursorAbsRow: render.cursorAbsRow,
      cursorCol: render.cursorCol,
      cursorVisible: render.cursorVisible,
      viewportRows,
      stickyCursor: this.stickyCursor,
    });

    if (projection.cursor.source === "inverse" || projection.cursor.source === "hardware") {
      this.stickyCursor = { row: projection.cursor.row, col: projection.cursor.col };
    }

    this.snapshot = {
      ...this.snapshot,
      status,
      cursorRow: projection.cursor.row + 1,
      cursorCol: projection.cursor.col + 1,
      cursorVisible: render.cursorVisible,
      cursorSource: projection.cursor.source as AtiSnapshot["cursorSource"],
      rawCursorRow: render.cursorAbsRow + 1,
      rawCursorCol: render.cursorCol + 1,
      lines: projection.lines as RichLine[],
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
        status={state.status} cursor=({state.cursorRow},{state.cursorCol}) source={state.cursorSource} raw=(
        {state.rawCursorRow},{state.rawCursorCol}) visible={state.cursorVisible ? "yes" : "no"} ctrl+q=quit
      </text>
      <box flexGrow={1} border borderColor="cyan">
        <text selectable>
          {state.lines.map((line, lineIndex) => (
            <span key={`line-${lineIndex}`}>
              {line.spans.map((span, spanIndex) => {
                const resolvedFg = span.inverse ? (span.bg ?? "#111111") : span.fg;
                const resolvedBg = span.inverse ? (span.fg ?? "#f3f6fb") : span.bg;
                let content: ReactNode = (
                  <span key={`text-${lineIndex}-${spanIndex}`} fg={resolvedFg} bg={resolvedBg}>
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
