import { Terminal, type FontWeight, type ITheme } from "@xterm/xterm";
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
import { resolveTerminalFontSignature, waitForBrowserTerminalFont } from "./browser-terminal-font";

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
const toXtermFontWeight = (value: string): FontWeight => value as FontWeight;

class XtermRendererSession implements TerminalRendererSession {
  readonly resolvedRenderer = "xterm" as const;
  readonly terminal: Terminal;
  readonly host: HTMLElement;
  readonly inputDataDisposable: IDisposable;
  readonly inputBinaryDisposable: IDisposable;
  readonly ligatureJoinerId: number;
  private fontProfile: ResolvedTerminalAppearance["font"];
  private lastSettledFontSignature = "";

  constructor(input: TerminalRendererSessionInput) {
    this.host = input.host;
    this.fontProfile = input.appearance.font;
    this.terminal = new Terminal({
      allowTransparency: true,
      allowProposedApi: true,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: input.appearance.cursorStyle,
      cols: input.cols,
      rows: input.rows,
      fontFamily: input.appearance.font.family,
      fontSize: input.appearance.font.sizePx,
      fontWeight: toXtermFontWeight(input.appearance.font.weight),
      fontWeightBold: toXtermFontWeight(input.appearance.font.weightBold),
      lineHeight: input.appearance.font.lineHeight,
      letterSpacing: input.appearance.font.letterSpacing,
      customGlyphs: input.appearance.font.ligatures,
      rescaleOverlappingGlyphs: true,
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

  applyViewport(viewportStart: number): void {
    this.terminal.scrollToLine(Math.max(0, Math.trunc(viewportStart)));
  }

  applyAppearance(appearance: ResolvedTerminalAppearance): void {
    this.fontProfile = appearance.font;
    this.terminal.options.theme = toXtermTheme(appearance);
    this.terminal.options.cursorStyle = appearance.cursorStyle;
    this.terminal.options.fontFamily = appearance.font.family;
    this.terminal.options.fontSize = appearance.font.sizePx;
    this.terminal.options.fontWeight = toXtermFontWeight(appearance.font.weight);
    this.terminal.options.fontWeightBold = toXtermFontWeight(appearance.font.weightBold);
    this.terminal.options.lineHeight = appearance.font.lineHeight;
    this.terminal.options.letterSpacing = appearance.font.letterSpacing;
    this.terminal.options.customGlyphs = appearance.font.ligatures;
    this.decoratePublicSurfaces();
  }

  async settlePresentation(): Promise<void> {
    const nextFontSignature = resolveTerminalFontSignature(this.fontProfile);
    if (this.lastSettledFontSignature !== nextFontSignature) {
      // xterm can keep the existing session alive, but its grid still needs one
      // explicit post-load settle pass when the browser finishes a webfont swap.
      await waitForBrowserTerminalFont(this.fontProfile);
      this.lastSettledFontSignature = nextFontSignature;
    }
    this.terminal.options.fontFamily = this.fontProfile.family;
    this.terminal.options.fontSize = this.fontProfile.sizePx;
    this.terminal.options.fontWeight = toXtermFontWeight(this.fontProfile.weight);
    this.terminal.options.fontWeightBold = toXtermFontWeight(this.fontProfile.weightBold);
    this.terminal.options.lineHeight = this.fontProfile.lineHeight;
    this.terminal.options.letterSpacing = this.fontProfile.letterSpacing;
    this.terminal.options.customGlyphs = this.fontProfile.ligatures;
    this.terminal.clearTextureAtlas();
    this.terminal.refresh(0, Math.max(0, this.terminal.rows - 1));
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    const internal = this.terminal as unknown as XtermInternalShape;
    const measuredWidth = internal._core?._renderService?.dimensions?.css?.canvas?.width;
    const measuredHeight = internal._core?._renderService?.dimensions?.css?.canvas?.height;
    if (
      typeof measuredWidth === "number" &&
      measuredWidth > 0 &&
      typeof measuredHeight === "number" &&
      measuredHeight > 0
    ) {
      return {
        width: Math.round(measuredWidth),
        height: Math.round(measuredHeight),
      };
    }
    const screen = this.terminal.element?.querySelector(".xterm-screen");
    if (!(screen instanceof HTMLElement)) {
      return null;
    }
    const width = screen.clientWidth || screen.offsetWidth;
    const height = screen.clientHeight || screen.offsetHeight;
    if (width <= 0 || height <= 0) {
      return null;
    }
    return {
      width: Math.round(width),
      height: Math.round(height),
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
  presentationMutationPolicy: {
    theme: "live-apply",
    cursor: "live-apply",
    font: "live-apply",
  },
  createSession(input) {
    void waitForBrowserTerminalFont(input.appearance.font);
    return new XtermRendererSession(input);
  },
};
