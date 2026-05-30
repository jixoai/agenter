import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { TerminalTransportSelectionOverlay } from "@agenter/terminal-transport-protocol";
import { BoxRenderable, type BoxOptions, type MouseEvent, type PasteEvent, type RenderContext } from "@opentui/core";

import { BackendScrollbarRenderable } from "./backend-scrollbar";
import {
  isCliShellImagePastePayload,
  readCliShellPastePayload,
  type CliShellPastePayload,
} from "./paste-input";
import { ShellTerminalViewRenderable } from "./shell-terminal-view";

export interface BackendTerminalFrameState {
  lines: readonly TerminalRenderRichLine[];
  cursorCol: number;
  cursorAbsRow: number;
  cursorVisible: boolean;
  viewportStart: number;
  scrollbackRows: number;
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
}

export interface BackendTerminalFrameBridge {
  sendInputText?: (text: string) => boolean;
  handleUnsupportedMediaPaste?: (payload: Extract<CliShellPastePayload, { kind: "media" }>) => boolean;
  scrollViewport(deltaRows: number): boolean;
  setViewportStart(viewportStart: number): boolean;
  followCursor?: () => boolean;
  copySelection?: (ownerId?: string) => boolean;
}

export interface BackendTerminalFrameUpdateResult {
  terminalPaintMs: number;
  terminalPaintRows: number;
  terminalPaintSpans: number;
  terminalPaintGlyphs: number;
}

export interface BackendTerminalFrameOptions extends BoxOptions {
  state: BackendTerminalFrameState;
  bridge: BackendTerminalFrameBridge;
  scrollbarVisible?: boolean;
}

const normalizeDimension = (value: number): number => Math.max(1, Math.trunc(value));

const resolveViewportSize = (state: BackendTerminalFrameState, height: number): number =>
  Math.max(1, Math.min(normalizeDimension(height), state.lines.length || normalizeDimension(height)));

const resolveScrollSize = (state: BackendTerminalFrameState, viewportSize: number): number =>
  Math.max(viewportSize, Math.trunc(state.scrollbackRows));

const normalizeViewportStart = (state: BackendTerminalFrameState, viewportSize: number): number => {
  const scrollSize = resolveScrollSize(state, viewportSize);
  const maxPosition = Math.max(0, scrollSize - viewportSize);
  return Math.max(0, Math.min(maxPosition, Math.trunc(state.viewportStart)));
};

export class BackendTerminalFrameRenderable extends BoxRenderable {
  readonly terminalView: ShellTerminalViewRenderable;
  readonly scrollbar: BackendScrollbarRenderable;
  #state: BackendTerminalFrameState;
  #bridge: BackendTerminalFrameBridge;
  #scrollbarVisible: boolean;

  constructor(ctx: RenderContext, options: BackendTerminalFrameOptions) {
    const { state, bridge, scrollbarVisible = true, ...boxOptions } = options;
    super(ctx, boxOptions);
    this.#state = state;
    this.#bridge = bridge;
    this.#scrollbarVisible = scrollbarVisible;
    this.terminalView = new ShellTerminalViewRenderable(ctx, {
      id: `${this.id}-terminal-view`,
      position: "absolute",
      top: 0,
      left: 0,
      width: this.resolveTerminalWidth(),
      height: normalizeDimension(this.height),
      focused: true,
      lines: state.lines,
      onMouseScroll: (event) => this.handleTerminalMouseScroll(event),
      onPaste: (event) => this.handleTerminalPaste(event),
    });
    this.scrollbar = new BackendScrollbarRenderable(ctx, {
      id: `${this.id}-scrollbar`,
      position: "absolute",
      top: 0,
      left: this.resolveScrollbarLeft(),
      width: 1,
      height: normalizeDimension(this.height),
      orientation: "vertical",
      showArrows: false,
      backendState: this.resolveScrollbarState(),
      onBackendChange: (position) => {
        this.#bridge.setViewportStart(position);
      },
    });
    this.add(this.terminalView);
    this.add(this.scrollbar);
    this.applyLayout();
  }

  updateBackendState(state: BackendTerminalFrameState): BackendTerminalFrameUpdateResult {
    this.#state = state;
    const scrollbarState = this.resolveScrollbarState();
    const paintStats = this.terminalView.updateProjection({
      lines: state.lines,
      cursor: {
        row: state.cursorAbsRow - state.viewportStart,
        col: state.cursorCol,
        visible: state.cursorVisible,
      },
      selectionOverlays: state.selectionOverlays,
    });
    this.scrollbar.applyBackendState(scrollbarState);
    this.scrollbar.visible = this.shouldRenderScrollbar(scrollbarState);
    this.applyLayout();
    return {
      terminalPaintMs: paintStats.durationMs,
      terminalPaintRows: paintStats.rows,
      terminalPaintSpans: paintStats.spans,
      terminalPaintGlyphs: paintStats.glyphs,
    };
  }

  set bridge(bridge: BackendTerminalFrameBridge) {
    this.#bridge = bridge;
  }

  set scrollbarVisible(scrollbarVisible: boolean) {
    this.#scrollbarVisible = scrollbarVisible;
    this.applyLayout();
  }

  focusTerminal(): void {
    this.terminalView.focus();
  }

  syncSize(width: number, height: number): void {
    this.width = normalizeDimension(width);
    this.height = normalizeDimension(height);
    this.applyLayout();
  }

  resolveCursorPosition(): { x: number; y: number; visible: boolean } {
    return {
      x: Math.max(1, Math.trunc(this.#state.cursorCol) + 1),
      y: Math.max(1, Math.trunc(this.#state.cursorAbsRow - this.#state.viewportStart) + 1),
      visible: this.#state.cursorVisible,
    };
  }

  copySelectionViaOsc52(): boolean {
    return this.#bridge.copySelection?.("terminal") ?? false;
  }

  pasteText(text: string): boolean {
    if (text.length === 0) {
      return false;
    }
    const sent = this.#bridge.sendInputText?.(text) ?? false;
    if (sent) {
      this.#bridge.followCursor?.();
    }
    return sent;
  }

  pastePayload(payload: CliShellPastePayload): boolean {
    if (payload.kind === "text") {
      return this.pasteText(payload.text);
    }
    if (payload.kind === "media") {
      return this.#bridge.handleUnsupportedMediaPaste?.(payload) ?? false;
    }
    return false;
  }

  private handleTerminalMouseScroll(event: MouseEvent): void {
    const direction = event.scroll?.direction;
    const delta = event.scroll?.delta ?? 1;
    const signedDelta = direction === "up" ? -delta : direction === "down" ? delta : 0;
    if (signedDelta !== 0 && this.#bridge.scrollViewport(signedDelta)) {
      event.preventDefault();
    }
  }

  private handleTerminalPaste(event: PasteEvent): void {
    const payload = readCliShellPastePayload(event);
    if (isCliShellImagePastePayload(payload)) {
      event.preventDefault();
    }
    if (this.pastePayload(payload)) {
      event.preventDefault();
    }
  }

  private resolveTerminalWidth(): number {
    const width = normalizeDimension(this.width);
    return this.#scrollbarVisible ? Math.max(1, width - 1) : width;
  }

  private resolveScrollbarLeft(): number {
    return this.#scrollbarVisible ? Math.max(0, normalizeDimension(this.width) - 1) : normalizeDimension(this.width);
  }

  private resolveScrollbarState(): { scrollSize: number; viewportSize: number; scrollPosition: number } {
    const viewportSize = resolveViewportSize(this.#state, normalizeDimension(this.height));
    return {
      scrollSize: resolveScrollSize(this.#state, viewportSize),
      viewportSize,
      scrollPosition: normalizeViewportStart(this.#state, viewportSize),
    };
  }

  private applyLayout(): void {
    const width = normalizeDimension(this.width);
    const height = normalizeDimension(this.height);
    const scrollbarState = this.resolveScrollbarState();
    this.terminalView.left = 0;
    this.terminalView.top = 0;
    this.terminalView.width = this.resolveTerminalWidth();
    this.terminalView.height = height;
    this.scrollbar.left = this.resolveScrollbarLeft();
    this.scrollbar.top = 0;
    this.scrollbar.width = 1;
    this.scrollbar.height = height;
    this.scrollbar.visible = this.shouldRenderScrollbar(scrollbarState);
    this.requestRender();
  }

  private shouldRenderScrollbar(state: { scrollSize: number; viewportSize: number }): boolean {
    return this.#scrollbarVisible && state.scrollSize > state.viewportSize;
  }

}
