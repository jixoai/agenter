import type { ResolvedTerminalAppearance, TerminalResolvedRenderer } from "./terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "./terminal-view-types";

export const TERMINAL_PUBLIC_INPUT_ATTRIBUTE = "data-terminal-input-surface";
export const TERMINAL_PUBLIC_SCROLL_ATTRIBUTE = "data-terminal-renderer-scroll";
export const TERMINAL_PUBLIC_SCREEN_ATTRIBUTE = "data-terminal-renderer-screen";

export interface TerminalRendererSessionInput {
  host: HTMLElement;
  cols: number;
  rows: number;
  scrollback: number;
  appearance: ResolvedTerminalAppearance;
  onInputBytes: (data: Uint8Array) => void;
}

// Renderer-private DOM, selection, metrics, and hidden input mechanics must end
// inside this contract so hosts never depend on one engine's internal structure.
export interface TerminalRendererSession {
  readonly resolvedRenderer: TerminalResolvedRenderer;
  readonly cols: number;
  readonly rows: number;
  readonly inputElement: HTMLElement | null;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  reset(): void;
  focus(): void;
  setScrollback(scrollback: number): void;
  applyAppearance(appearance: ResolvedTerminalAppearance): void;
  getScreenMetrics(): TerminalViewScreenMetrics | null;
  dispose(): void;
}

export interface TerminalRendererAdapter {
  readonly renderer: TerminalResolvedRenderer;
  readonly styles: string;
  ensureReady?(): Promise<void>;
  createSession(input: TerminalRendererSessionInput): TerminalRendererSession;
}

export const markPublicTerminalSurface = (element: Element | null | undefined, attribute: string): void => {
  if (!element) {
    return;
  }
  element.setAttribute(attribute, "true");
};
