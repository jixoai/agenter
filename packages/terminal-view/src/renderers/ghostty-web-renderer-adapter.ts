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

const TERMINAL_FONT_SIZE = 12;

class GhosttyRendererSession implements TerminalRendererSession {
  readonly resolvedRenderer = "ghostty-web" as const;
  readonly terminal: Terminal;
  readonly host: HTMLElement;
  readonly inputDataDisposable: { dispose(): void };

  constructor(input: TerminalRendererSessionInput) {
    this.host = input.host;
    this.terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: false,
      cursorStyle: input.appearance.cursorStyle,
      cols: input.cols,
      rows: input.rows,
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
      fontSize: TERMINAL_FONT_SIZE,
      scrollback: input.scrollback,
      smoothScrollDuration: 0,
      theme: input.appearance.theme,
    });
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
    this.terminal.options.theme = appearance.theme;
    this.terminal.options.cursorStyle = appearance.cursorStyle;
    this.terminal.renderer?.setTheme(appearance.theme);
    this.terminal.renderer?.setCursorStyle(appearance.cursorStyle);
    this.decoratePublicSurfaces();
  }

  getScreenMetrics(): TerminalViewScreenMetrics | null {
    const canvas = this.terminal.renderer?.getCanvas();
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }
    }
    const metrics = this.terminal.renderer?.getMetrics();
    if (!metrics || metrics.width <= 0 || metrics.height <= 0) {
      return null;
    }
    return {
      width: Math.round(metrics.width * this.terminal.cols),
      height: Math.round(metrics.height * this.terminal.rows),
    };
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
  ensureReady: primeGhosttyWebRuntime,
  createSession(input) {
    return new GhosttyRendererSession(input);
  },
};
