import { Terminal, init } from "ghostty-web";

import {
  TERMINAL_PUBLIC_INPUT_ATTRIBUTE,
  TERMINAL_PUBLIC_SCREEN_ATTRIBUTE,
  markPublicTerminalSurface,
  type TerminalRendererAdapter,
  type TerminalRendererSession,
  type TerminalRendererSessionInput,
} from "../terminal-renderer-adapter";
import type { ResolvedTerminalAppearance } from "../terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "../terminal-view-types";
import { resolveTerminalFontSignature, waitForBrowserTerminalFont } from "./browser-terminal-font";

type GhosttyTerminalRenderer = {
  getCanvas(): HTMLCanvasElement | null;
  getMetrics(): { width: number; height: number } | null;
  setTheme(theme: ResolvedTerminalAppearance["theme"]): void;
  setCursorStyle(style: ResolvedTerminalAppearance["cursorStyle"]): void;
  setFontFamily?(family: string): void;
  setFontSize?(size: number): void;
  remeasureFont?(): void;
  render?(
    buffer: unknown,
    forceAll?: boolean,
    viewportY?: number,
    scrollbackProvider?: unknown,
    scrollbarOpacity?: number,
  ): void;
};

type GhosttyTerminalShape = Terminal & {
  renderer?: GhosttyTerminalRenderer;
  wasmTerm?: unknown;
  viewportY?: number;
  scrollbackOpacity?: number;
};

class GhosttyRendererSession implements TerminalRendererSession {
  readonly resolvedRenderer = "ghostty-web" as const;
  readonly terminal: GhosttyTerminalShape;
  readonly host: HTMLElement;
  readonly inputDataDisposable: { dispose(): void };
  private fontProfile: ResolvedTerminalAppearance["font"];
  private lastSettledFontSignature = "";

  constructor(input: TerminalRendererSessionInput) {
    this.host = input.host;
    this.fontProfile = input.appearance.font;
    this.terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: input.appearance.cursorStyle,
      cols: input.cols,
      rows: input.rows,
      fontFamily: input.appearance.font.family,
      fontSize: input.appearance.font.sizePx,
      scrollback: input.scrollback,
      smoothScrollDuration: 0,
      theme: input.appearance.theme,
    }) as GhosttyTerminalShape;
    this.host.replaceChildren();
    this.terminal.open(this.host);
    this.inputDataDisposable = this.terminal.onData((data: string) => {
      input.onInputBytes(new TextEncoder().encode(data));
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
    this.fontProfile = appearance.font;
    this.terminal.options.theme = appearance.theme;
    this.terminal.options.cursorStyle = appearance.cursorStyle;
    this.terminal.options.fontFamily = appearance.font.family;
    this.terminal.options.fontSize = appearance.font.sizePx;
    this.terminal.renderer?.setTheme(appearance.theme);
    this.terminal.renderer?.setCursorStyle(appearance.cursorStyle);
    this.decoratePublicSurfaces();
  }

  async settlePresentation(): Promise<void> {
    const nextFontSignature = resolveTerminalFontSignature(this.fontProfile);
    if (this.lastSettledFontSignature !== nextFontSignature) {
      // Canvas metrics cannot trust stylesheet presence alone. Wait until the
      // browser has actually settled the configured font before remeasuring.
      await waitForBrowserTerminalFont(this.fontProfile);
      this.lastSettledFontSignature = nextFontSignature;
    }
    const renderer = this.terminal.renderer;
    renderer?.setFontFamily?.(this.fontProfile.family);
    renderer?.setFontSize?.(this.fontProfile.sizePx);
    renderer?.remeasureFont?.();
    renderer?.render?.(
      this.terminal.wasmTerm,
      true,
      this.terminal.viewportY ?? 0,
      this.terminal,
      0,
    );
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    const metrics = this.terminal.renderer?.getMetrics();
    if (metrics && metrics.width > 0 && metrics.height > 0) {
      return {
        width: Math.round(metrics.width * this.terminal.cols),
        height: Math.round(metrics.height * this.terminal.rows),
      };
    }
    const canvas = this.terminal.renderer?.getCanvas();
    if (canvas) {
      const width = canvas.clientWidth || canvas.offsetWidth;
      const height = canvas.clientHeight || canvas.offsetHeight;
      if (width > 0 && height > 0) {
        return {
          width: Math.round(width),
          height: Math.round(height),
        };
      }
    }
    return null;
  }

  dispose(): void {
    this.inputDataDisposable.dispose();
    this.terminal.dispose();
  }

  private decoratePublicSurfaces(): void {
    markPublicTerminalSurface(this.terminal.textarea, TERMINAL_PUBLIC_INPUT_ATTRIBUTE);
    markPublicTerminalSurface(this.terminal.renderer?.getCanvas(), TERMINAL_PUBLIC_SCREEN_ATTRIBUTE);
  }
}

let ghosttyRuntimeReadyPromise: Promise<void> | null = null;

export const primeGhosttyWebRuntime = async (): Promise<void> => {
  ghosttyRuntimeReadyPromise ??= init();
  await ghosttyRuntimeReadyPromise;
};

export const ghosttyWebRendererAdapter: TerminalRendererAdapter = {
  renderer: "ghostty-web",
  styles: "",
  // ghostty-web currently does not settle post-open theme swaps reliably enough to
  // treat them as host-authoritative live updates. Keep that capability law adapter-local.
  presentationMutationPolicy: {
    theme: "rebuild-session",
    cursor: "live-apply",
    // ghostty-web already exposes runtime font mutation and remeasurement; keep font
    // settle adapter-local instead of rebuilding the whole viewport stack.
    font: "live-apply",
  },
  ensureReady: primeGhosttyWebRuntime,
  createSession(input) {
    void waitForBrowserTerminalFont(input.appearance.font);
    return new GhosttyRendererSession(input);
  },
};
