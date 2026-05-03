import { Terminal, type ITheme } from "@xterm/xterm";
import xtermStyles from "@xterm/xterm/css/xterm.css?inline";
import { binaryStringToBytes } from "@agenter/terminal-transport-protocol";
import type { IDisposable } from "@xterm/xterm";

import {
  TERMINAL_PUBLIC_INPUT_ATTRIBUTE,
  TERMINAL_PUBLIC_SCREEN_ATTRIBUTE,
  TERMINAL_PUBLIC_SCROLL_ATTRIBUTE,
  markPublicTerminalSurface,
  type TerminalRendererAdapter,
  type TerminalRendererSession,
  type TerminalRendererSessionInput,
} from "../terminal-renderer-adapter";
import type { ResolvedTerminalAppearance } from "../terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "../terminal-view-types";

interface XtermRenderDimensions {
  css?: {
    canvas?: {
      width?: number;
      height?: number;
    };
  };
}

interface XtermInternalShape {
  _core?: {
    _renderService?: {
      dimensions?: XtermRenderDimensions;
    };
  };
}

const TERMINAL_FONT_SIZE = 12;
const TERMINAL_LINE_HEIGHT = 1.25;

const PROGRAMMING_LIGATURES = Object.freeze([
  "<!--",
  "!==",
  "-->",
  "...",
  "<<<",
  "<=>",
  "===",
  ">>>",
  "!!",
  "!=",
  "##",
  "&&",
  "++",
  "--",
  "->",
  "::",
  ":=",
  "<-",
  "<<",
  "<=",
  "==",
  "=>",
  ">=",
  ">>",
  "?.",
  "??",
  "||",
]);

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PROGRAMMING_LIGATURE_REGEX = new RegExp(
  [...PROGRAMMING_LIGATURES]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .map(escapeRegex)
    .join("|"),
  "g",
);

const collectProgrammingLigatureRanges = (text: string): [number, number][] => {
  if (text.length < 2) {
    return [];
  }

  const ranges: [number, number][] = [];
  PROGRAMMING_LIGATURE_REGEX.lastIndex = 0;

  for (const match of text.matchAll(PROGRAMMING_LIGATURE_REGEX)) {
    if (typeof match.index !== "number") {
      continue;
    }
    ranges.push([match.index, match.index + match[0].length]);
  }

  return ranges;
};

const toXtermTheme = (appearance: ResolvedTerminalAppearance): ITheme => appearance.theme;

class XtermRendererSession implements TerminalRendererSession {
  readonly resolvedRenderer = "xterm" as const;
  readonly terminal: Terminal;
  readonly host: HTMLElement;
  readonly inputDataDisposable: IDisposable;
  readonly inputBinaryDisposable: IDisposable;
  readonly ligatureJoinerId: number;

  constructor(input: TerminalRendererSessionInput) {
    this.host = input.host;
    this.terminal = new Terminal({
      allowTransparency: true,
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: input.appearance.cursorStyle,
      cols: input.cols,
      rows: input.rows,
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
      fontSize: TERMINAL_FONT_SIZE,
      fontWeight: "400",
      fontWeightBold: "700",
      lineHeight: TERMINAL_LINE_HEIGHT,
      scrollback: input.scrollback,
      theme: toXtermTheme(input.appearance),
    });
    this.host.replaceChildren();
    this.terminal.open(this.host);
    this.ligatureJoinerId = this.terminal.registerCharacterJoiner(collectProgrammingLigatureRanges);
    this.inputDataDisposable = this.terminal.onData((data) => {
      input.onInputBytes(new TextEncoder().encode(data));
    });
    this.inputBinaryDisposable = this.terminal.onBinary((data) => {
      input.onInputBytes(binaryStringToBytes(data));
    });
    this.decoratePublicSurfaces();
  }

  get cols(): number {
    return this.terminal.cols;
  }

  get rows(): number {
    return this.terminal.rows;
  }

  get inputElement(): HTMLElement | null {
    return this.terminal.textarea ?? null;
  }

  write(data: string | Uint8Array): void {
    this.terminal.write(data);
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
    this.decoratePublicSurfaces();
  }

  reset(): void {
    this.terminal.reset();
  }

  focus(): void {
    this.terminal.focus();
  }

  setScrollback(scrollback: number): void {
    this.terminal.options.scrollback = scrollback;
  }

  applyAppearance(appearance: ResolvedTerminalAppearance): void {
    this.terminal.options.theme = toXtermTheme(appearance);
    this.terminal.options.cursorStyle = appearance.cursorStyle;
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    const internal = this.terminal as unknown as XtermInternalShape;
    const width = internal._core?._renderService?.dimensions?.css?.canvas?.width;
    const height = internal._core?._renderService?.dimensions?.css?.canvas?.height;
    if (typeof width === "number" && width > 0 && typeof height === "number" && height > 0) {
      return {
        width: Math.round(width),
        height: Math.round(height),
      };
    }
    const screen = this.terminal.element?.querySelector(".xterm-screen");
    if (!(screen instanceof HTMLElement)) {
      return null;
    }
    const rect = screen.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }

  dispose(): void {
    this.inputDataDisposable.dispose();
    this.inputBinaryDisposable.dispose();
    this.terminal.deregisterCharacterJoiner(this.ligatureJoinerId);
    this.terminal.dispose();
  }

  private decoratePublicSurfaces(): void {
    markPublicTerminalSurface(this.terminal.textarea, TERMINAL_PUBLIC_INPUT_ATTRIBUTE);
    markPublicTerminalSurface(this.terminal.element?.querySelector(".xterm-screen"), TERMINAL_PUBLIC_SCREEN_ATTRIBUTE);
    markPublicTerminalSurface(this.terminal.element?.querySelector(".xterm-viewport"), TERMINAL_PUBLIC_SCROLL_ATTRIBUTE);
  }
}

export const XTERM_RENDERER_STYLES = xtermStyles;
const XTERM_RENDERER_LAYOUT_STYLES = `
  .xterm,
  .xterm-screen,
  .xterm-viewport {
    height: 100%;
  }

  .xterm-viewport {
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, currentColor 28%, transparent) transparent;
  }

  .xterm-viewport::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .xterm-viewport::-webkit-scrollbar-track {
    background: transparent;
  }

  .xterm-viewport::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in srgb, #cbd5e1 24%, transparent);
  }
`;

export const xtermRendererAdapter: TerminalRendererAdapter = {
  renderer: "xterm",
  styles: `${XTERM_RENDERER_STYLES}\n${XTERM_RENDERER_LAYOUT_STYLES}`,
  createSession(input) {
    return new XtermRendererSession(input);
  },
};
