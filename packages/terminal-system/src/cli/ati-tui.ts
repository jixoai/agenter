import { projectTerminalViewport } from "@agenter/termless-core";
import {
  BoxRenderable,
  CliRenderEvents,
  RGBA,
  TextAttributes,
  TextRenderable,
  createCliRenderer,
  t,
  type CliRenderer,
  type KeyEvent,
  type StyledText,
  type TextChunk,
} from "@opentui/core";

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

const createInitialSnapshot = (metaLine: string): AtiSnapshot => ({
  metaLine,
  status: "IDLE",
  cursorRow: 1,
  cursorCol: 1,
  cursorVisible: true,
  cursorSource: "none",
  rawCursorRow: 1,
  rawCursorCol: 1,
  lines: [],
});

const toPlainLine = (line: RichLine): string => line.spans.map((span) => span.text).join("");

const toRgba = (color: string | undefined): RGBA | undefined => {
  if (!color) {
    return undefined;
  }
  try {
    return RGBA.fromHex(color);
  } catch {
    return undefined;
  }
};

const toTextChunk = (span: RichSpan): TextChunk => {
  const attributes =
    (span.bold ? TextAttributes.BOLD : TextAttributes.NONE) |
    (span.underline ? TextAttributes.UNDERLINE : TextAttributes.NONE) |
    (span.inverse ? TextAttributes.INVERSE : TextAttributes.NONE);
  return {
    __isChunk: true,
    text: span.text,
    fg: toRgba(span.fg),
    bg: toRgba(span.bg),
    attributes,
  };
};

const toStyledTerminalText = (lines: RichLine[]): StyledText | string => {
  if (lines.length === 0) {
    return "";
  }
  const chunks: Array<string | TextChunk> = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const span of line.spans) {
      chunks.push(toTextChunk(span));
    }
    if (lineIndex < lines.length - 1) {
      chunks.push("\n");
    }
  }
  return t(["", ...Array.from({ length: chunks.length }, () => "")] as unknown as TemplateStringsArray, ...chunks);
};

class AtiCoreTuiApp {
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #metaText: TextRenderable;
  readonly #statusText: TextRenderable;
  readonly #viewportBox: BoxRenderable;
  readonly #terminalText: TextRenderable;
  readonly #options: AtiTuiOptions;
  #snapshot: AtiSnapshot;
  #stickyCursor: { row: number; col: number } | null = null;
  #viewportRows: number;
  #disposed = false;

  constructor(renderer: CliRenderer, options: AtiTuiOptions) {
    this.#renderer = renderer;
    this.#options = options;
    this.#snapshot = createInitialSnapshot(options.metaLine);
    this.#viewportRows = resolveAtiTuiViewportSize(renderer.width, renderer.height).rows;
    const { cols, rows } = resolveAtiTuiViewportSize(renderer.width, renderer.height);
    options.onResize(cols, rows);

    this.#root = new BoxRenderable(renderer, {
      id: "ati-core-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
    });
    this.#metaText = new TextRenderable(renderer, {
      id: "ati-meta",
      content: options.metaLine,
      height: 1,
      truncate: true,
    });
    this.#statusText = new TextRenderable(renderer, {
      id: "ati-status",
      content: "",
      height: 1,
      truncate: true,
    });
    this.#viewportBox = new BoxRenderable(renderer, {
      id: "ati-terminal-frame",
      border: true,
      borderColor: "cyan",
      flexGrow: 1,
    });
    this.#terminalText = new TextRenderable(renderer, {
      id: "ati-terminal-text",
      content: "",
      selectable: true,
      wrapMode: "none",
      width: "100%",
      height: "100%",
    });

    this.#viewportBox.add(this.#terminalText);
    this.#root.add(this.#metaText);
    this.#root.add(this.#statusText);
    this.#root.add(this.#viewportBox);
    renderer.root.add(this.#root);
  }

  start(): void {
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.#render();
  }

  updateMeta(metaLine: string): void {
    this.#snapshot = { ...this.#snapshot, metaLine };
    this.#render();
  }

  updateRender(render: RenderResult, status: TerminalStatus): void {
    const projection = projectTerminalViewport({
      lines: render.richLines,
      cursorAbsRow: render.cursorAbsRow,
      cursorCol: render.cursorCol,
      cursorVisible: render.cursorVisible,
      viewportRows: this.#viewportRows,
      stickyCursor: this.#stickyCursor,
    });

    if (projection.cursor.source === "inverse" || projection.cursor.source === "hardware") {
      this.#stickyCursor = { row: projection.cursor.row, col: projection.cursor.col };
    }

    this.#snapshot = {
      ...this.#snapshot,
      status,
      cursorRow: projection.cursor.row + 1,
      cursorCol: projection.cursor.col + 1,
      cursorVisible: render.cursorVisible,
      cursorSource: projection.cursor.source as AtiSnapshot["cursorSource"],
      rawCursorRow: render.cursorAbsRow + 1,
      rawCursorCol: render.cursorCol + 1,
      lines: projection.lines as RichLine[],
    };
    this.#render();
  }

  destroy(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#root.destroyRecursively();
  }

  #handleKeypress = (key: KeyEvent): void => {
    if (key.ctrl && key.name === "q") {
      this.#options.onQuit();
      key.preventDefault();
      return;
    }
    const encoded = encodeTerminalKey(key);
    if (!encoded) {
      return;
    }
    this.#options.onInput(encoded);
    key.preventDefault();
  };

  #handleResize = (width: number, height: number): void => {
    const { cols, rows } = resolveAtiTuiViewportSize(width, height);
    this.#viewportRows = rows;
    this.#options.onResize(cols, rows);
    this.#render();
  };

  #render(): void {
    const state = this.#snapshot;
    this.#metaText.content = state.metaLine;
    this.#statusText.content = `status=${state.status} cursor=(${state.cursorRow},${state.cursorCol}) source=${state.cursorSource} raw=(${state.rawCursorRow},${state.rawCursorCol}) visible=${state.cursorVisible ? "yes" : "no"} ctrl+q=quit`;
    this.#terminalText.content = state.lines.some((line) => line.spans.some((span) => span.fg || span.bg || span.bold || span.underline || span.inverse))
      ? toStyledTerminalText(state.lines)
      : state.lines.map(toPlainLine).join("\n");
    this.#renderer.setCursorPosition(state.cursorCol, state.cursorRow + 2, state.cursorVisible);
    this.#renderer.requestRender();
  }
}

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
  const app = new AtiCoreTuiApp(renderer, options);
  app.start();

  return {
    updateMeta: (metaLine: string) => app.updateMeta(metaLine),
    updateRender: (render: RenderResult, status: TerminalStatus) => app.updateRender(render, status),
    destroy: () => {
      app.destroy();
      renderer.destroy();
    },
  };
};
