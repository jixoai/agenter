import type { TerminalTransportSelectionOverlay } from "@agenter/terminal-transport-protocol";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import { BoxRenderable, type BoxOptions, type MouseEvent, type PasteEvent, type RenderContext } from "@opentui/core";

import { OpenComposeScrollbarRenderable } from "./scrollbar-renderable";
import { isOpenComposeImagePastePayload, readOpenComposePastePayload, type OpenComposePastePayload } from "./paste-input";
import { OpenComposeTerminalViewRenderable } from "./terminal-view-renderable";

export interface OpenComposeTerminalFrameState {
  lines: readonly TerminalRenderRichLine[];
  cursorCol: number;
  cursorAbsRow: number;
  cursorVisible: boolean;
  viewportStart: number;
  scrollbackRows: number;
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
}

export interface OpenComposeTerminalFrameBridge {
  sendInputText?: (text: string) => boolean;
  handleUnsupportedMediaPaste?: (payload: Extract<OpenComposePastePayload, { kind: "media" }>) => boolean;
  scrollViewport(deltaRows: number): boolean;
  setViewportStart(viewportStart: number): boolean;
  followCursor?: () => boolean;
  copySelection?: (ownerId?: string, target?: "clipboard" | "primary") => boolean;
  selectionStart?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onSelectionStart"];
  selectionUpdate?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onSelectionUpdate"];
  selectionEnd?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onSelectionEnd"];
  selectWordAt?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onSelectWordAt"];
  selectLineAt?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onSelectLineAt"];
  clearSelection?: ConstructorParameters<typeof OpenComposeTerminalViewRenderable>[1]["onClearSelection"];
}

export interface OpenComposeTerminalFrameUpdateResult {
  terminalPaintMs: number;
  terminalPaintRows: number;
  terminalPaintSpans: number;
  terminalPaintGlyphs: number;
}

export interface OpenComposeTerminalFrameOptions extends BoxOptions {
  state: OpenComposeTerminalFrameState;
  bridge: OpenComposeTerminalFrameBridge;
  scrollbarVisible?: boolean;
}

const normalizeDimension = (value: number): number => Math.max(1, Math.trunc(value));

const resolveViewportSize = (state: OpenComposeTerminalFrameState, height: number): number =>
  Math.max(1, Math.min(normalizeDimension(height), state.lines.length || normalizeDimension(height)));

const resolveScrollSize = (state: OpenComposeTerminalFrameState, viewportSize: number): number =>
  Math.max(viewportSize, Math.trunc(state.scrollbackRows));

const normalizeViewportStart = (state: OpenComposeTerminalFrameState, viewportSize: number): number => {
  const scrollSize = resolveScrollSize(state, viewportSize);
  const maxPosition = Math.max(0, scrollSize - viewportSize);
  return Math.max(0, Math.min(maxPosition, Math.trunc(state.viewportStart)));
};

export class OpenComposeTerminalFrameRenderable extends BoxRenderable {
  readonly terminalView: OpenComposeTerminalViewRenderable;
  readonly scrollbar: OpenComposeScrollbarRenderable;
  #state: OpenComposeTerminalFrameState;
  #bridge: OpenComposeTerminalFrameBridge;
  #scrollbarVisible: boolean;

  constructor(ctx: RenderContext, options: OpenComposeTerminalFrameOptions) {
    const { state, bridge, scrollbarVisible = true, ...boxOptions } = options;
    super(ctx, boxOptions);
    this.#state = state;
    this.#bridge = bridge;
    this.#scrollbarVisible = scrollbarVisible;
    this.terminalView = new OpenComposeTerminalViewRenderable(ctx, {
      id: `${this.id}-terminal-view`,
      position: "absolute",
      top: 0,
      left: 0,
      width: this.resolveTerminalWidth(),
      height: normalizeDimension(this.height),
      focused: true,
      lines: state.lines,
      onSelectionStart: (point) => this.#bridge.selectionStart?.(point) ?? false,
      onSelectionUpdate: (point) => this.#bridge.selectionUpdate?.(point) ?? false,
      onSelectionEnd: (point) => this.#bridge.selectionEnd?.(point) ?? false,
      onSelectWordAt: (point) => this.#bridge.selectWordAt?.(point) ?? false,
      onSelectLineAt: (point) => this.#bridge.selectLineAt?.(point) ?? false,
      onClearSelection: (point) => this.#bridge.clearSelection?.(point) ?? false,
      onMouseScroll: (event) => this.handleTerminalMouseScroll(event),
      onPaste: (event) => this.handleTerminalPaste(event),
    });
    this.scrollbar = new OpenComposeScrollbarRenderable(ctx, {
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

  updateBackendState(state: OpenComposeTerminalFrameState): OpenComposeTerminalFrameUpdateResult {
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

  set bridge(bridge: OpenComposeTerminalFrameBridge) {
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

  copySelectionToPrimary(): boolean {
    return this.#bridge.copySelection?.("terminal", "primary") ?? false;
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

  pastePayload(payload: OpenComposePastePayload): boolean {
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
    const payload = readOpenComposePastePayload(event);
    if (isOpenComposeImagePastePayload(payload)) {
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
