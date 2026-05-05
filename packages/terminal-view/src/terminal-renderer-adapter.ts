import type { ResolvedTerminalAppearance, TerminalResolvedRenderer } from "./terminal-renderer-profile";
import type { TerminalViewScreenMetrics } from "./terminal-view-types";

export const TERMINAL_PUBLIC_INPUT_ATTRIBUTE = "data-terminal-input-surface";
export const TERMINAL_PUBLIC_SCROLL_ATTRIBUTE = "data-terminal-renderer-scroll";
export const TERMINAL_PUBLIC_SCREEN_ATTRIBUTE = "data-terminal-renderer-screen";

export type TerminalPresentationMutationStrategy = "live-apply" | "rebuild-session";
export type TerminalPresentationMutationField = "theme" | "cursor" | "font";

export interface TerminalRendererPresentationMutationPolicy {
  theme: TerminalPresentationMutationStrategy;
  cursor: TerminalPresentationMutationStrategy;
  font: TerminalPresentationMutationStrategy;
}

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
// `getScreenMetrics()` in particular must report the renderer's native terminal
// content box, not the outer host/projection box that happens to contain it.
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
  settlePresentation?(): Promise<void> | void;
  getScreenMetrics(): TerminalViewScreenMetrics | null;
  dispose(): void;
}

export interface TerminalRendererAdapter {
  readonly renderer: TerminalResolvedRenderer;
  readonly styles: string;
  readonly presentationMutationPolicy: TerminalRendererPresentationMutationPolicy;
  ensureReady?(): Promise<void>;
  createSession(input: TerminalRendererSessionInput): Promise<TerminalRendererSession> | TerminalRendererSession;
}

export const markPublicTerminalSurface = (element: Element | null | undefined, attribute: string): void => {
  if (!element) {
    return;
  }
  element.setAttribute(attribute, "true");
};
