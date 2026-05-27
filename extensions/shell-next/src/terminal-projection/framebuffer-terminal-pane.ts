import type { TerminalRenderRichLine } from "@agenter/termless-core";
import { BoxRenderable, type CliRenderer, type MouseEvent, type Renderable } from "@opentui/core";
import { OpenComposeTerminalFrameRenderable } from "../opencompose/terminal-frame/terminal-frame-renderable";

import { readSystemClipboardText } from "../app/system-clipboard";
import type { ChildLayoutNode, LayoutRect } from "../renderable-mux/layout";
import type { TerminalPaneFactory, TerminalPaneFactoryInput } from "../renderable-mux/mux-renderable";
import {
  ShellNextPaneChromeController,
  resolveShellNextPaneChromeClick,
  shellNextPaneCloseAction,
  type ShellNextPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { PaneFrameRenderEvent } from "../renderable-mux/pane-renderable";
import type { TerminalInputChunk, TerminalPaneSize, TerminalProtocolPaneSource } from "../renderable-mux/pane-source";

const clampFrameWidth = (rect: LayoutRect): number => resolveBorderedPaneContentSize(rect).width;

const clampFrameHeight = (rect: LayoutRect): number => resolveBorderedPaneContentSize(rect).height;

// Match the terminal-instance panel law: keep one stable gutter column for
// scrollbar chrome so backend PTY width equals the visible terminal viewport.
const resolveTerminalViewportWidth = (frameWidth: number): number => Math.max(1, Math.trunc(frameWidth) - 1);

const resolveTerminalViewportHeight = (frameHeight: number): number => Math.max(1, Math.trunc(frameHeight));

const lineToRichLine = (line: string): TerminalRenderRichLine => ({
  spans: line.length > 0 ? [{ text: line }] : [],
});

const emptyFrameState = {
  lines: [],
  cursorCol: 0,
  cursorAbsRow: 0,
  cursorVisible: false,
  viewportStart: 0,
  scrollbackRows: 1,
  selectionOverlays: [],
};

const sanitizeSize = (rect: LayoutRect): TerminalPaneSize => {
  const frameWidth = clampFrameWidth(rect);
  const frameHeight = clampFrameHeight(rect);
  return {
    cols: resolveTerminalViewportWidth(frameWidth),
    rows: resolveTerminalViewportHeight(frameHeight),
  };
};

const TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS = 25;

export interface ShellNextFrameBufferTerminalPaneInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly source: TerminalProtocolPaneSource;
  readonly title: string;
  readonly accentColor?: string;
  readonly onFocus?: (paneId: string) => void;
  readonly onCloseRequest?: (paneId: string) => void;
  readonly onFrameRendered?: (event: PaneFrameRenderEvent) => void;
}

export class ShellNextFrameBufferTerminalPane {
  readonly #renderer: CliRenderer;
  readonly #source: TerminalProtocolPaneSource;
  readonly #root: BoxRenderable;
  readonly #frame: OpenComposeTerminalFrameRenderable;
  readonly #chrome: ShellNextPaneChromeController;
  readonly #input: Omit<ShellNextFrameBufferTerminalPaneInput, "renderer" | "node" | "source">;
  #node: ChildLayoutNode;
  #lastSize: TerminalPaneSize | null = null;
  #lastDeliveredSize: TerminalPaneSize | null = null;
  #pendingResize: TerminalPaneSize | null = null;
  #resizeTimer: ReturnType<typeof setTimeout> | null = null;
  #disposed = false;
  #title: string;
  #chromeRegions: readonly ShellNextPaneChromeHitRegion[] = [];
  #hoveredChromeAction: string | null = null;

  constructor(input: ShellNextFrameBufferTerminalPaneInput) {
    this.#renderer = input.renderer;
    this.#source = input.source;
    this.#node = input.node;
    this.#input = input;
    this.#title = input.title;
    this.#chrome = new ShellNextPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-framebuffer-terminal-chrome`,
      bg: "#020617",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
    const accentColor = input.accentColor ?? "#38bdf8";
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-framebuffer-terminal-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? accentColor : "#475569",
      focusedBorderColor: accentColor,
      backgroundColor: "#020617",
      titleAlignment: "left",
      focusable: true,
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
    this.#frame = new OpenComposeTerminalFrameRenderable(this.#renderer, {
      id: `${input.node.id}-framebuffer-terminal-frame`,
      position: "absolute",
      top: PANE_CONTENT_ORIGIN,
      left: PANE_CONTENT_ORIGIN,
      width: clampFrameWidth(input.node.rect),
      height: Math.max(1, clampFrameHeight(input.node.rect)),
      state: emptyFrameState,
      bridge: {
        sendInputText: (text) => {
          void this.writeInput(text);
          this.#source.followCursor?.();
          return true;
        },
        scrollViewport: (deltaRows) => this.#source.scrollViewport?.(deltaRows) ?? false,
        setViewportStart: (viewportStart) => this.#source.setViewportStart?.(viewportStart) ?? false,
        followCursor: () => this.#source.followCursor?.() ?? false,
        selectionStart: (point) => this.#source.selectionStart?.(point) ?? false,
        selectionUpdate: (point) => this.#source.selectionUpdate?.(point) ?? false,
        selectionEnd: (point) => this.#source.selectionEnd?.(point) ?? false,
        selectWordAt: (point) => this.#source.selectWordAt?.(point) ?? false,
        selectLineAt: (point) => this.#source.selectLineAt?.(point) ?? false,
        clearSelection: (point) => this.#source.clearSelection?.(point.ownerId) ?? false,
        copySelection: (ownerId) => this.#copySelection(ownerId),
        handleUnsupportedMediaPaste: () => false,
      },
    });
    this.#root.add(this.#frame);
    this.#renderer.keyInput.on("paste", this.#handlePaste);
    this.syncNode(input.node);
  }

  get root(): Renderable {
    return this.#root;
  }

  get frame(): OpenComposeTerminalFrameRenderable {
    return this.#frame;
  }

  syncNode(node: ChildLayoutNode): void {
    if (this.#disposed) {
      return;
    }
    this.#node = node;
    const accentColor = this.#input.accentColor ?? "#38bdf8";
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = node.rect.width;
    this.#root.height = node.rect.height;
    this.#root.borderColor = node.focused ? accentColor : "#475569";
    if (node.focused) {
      this.#root.focus();
      this.#frame.focusTerminal();
    }
    const frameWidth = clampFrameWidth(node.rect);
    const frameHeight = Math.max(1, clampFrameHeight(node.rect));
    this.#syncTitleChrome();
    this.#frame.left = PANE_CONTENT_ORIGIN;
    this.#frame.top = PANE_CONTENT_ORIGIN;
    this.#frame.syncSize(frameWidth, frameHeight);
    const size = sanitizeSize(node.rect);
    if (!this.#lastSize || this.#lastSize.cols !== size.cols || this.#lastSize.rows !== size.rows) {
      this.#lastSize = size;
      this.#scheduleBackendResize(size);
    }
    this.refresh();
  }

  refresh(): void {
    if (this.#disposed) {
      return;
    }
    this.#syncTitleChrome();
    const size = this.#lastSize ?? sanitizeSize(this.#node.rect);
    const startedAt = performance.now();
    const frame = this.#source.readFrame();
    const viewportStart = Math.max(0, Math.trunc(frame.viewportStart ?? 0));
    const cursor = frame.cursor ?? { x: 0, y: 0, visible: false };
    const update = this.#frame.updateBackendState({
      lines:
        frame.richLines?.map((line) => ({ spans: line.spans.map((span) => ({ ...span })) })) ??
        frame.lines.map(lineToRichLine),
      cursorCol: Math.max(0, Math.trunc(cursor.x)),
      cursorAbsRow: viewportStart + Math.max(0, Math.trunc(cursor.y)),
      cursorVisible: cursor.visible,
      viewportStart,
      scrollbackRows: Math.max(size.rows, Math.trunc(frame.scrollbackRows ?? frame.lines.length)),
      selectionOverlays: frame.selectionOverlays,
    });
    this.#input.onFrameRendered?.({
      paneId: this.#node.id,
      revision: frame.revision,
      cols: size.cols,
      rows: size.rows,
      elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
    });
    if (update.terminalPaintRows > 0) {
      this.#renderer.requestRender();
    }
    this.#source.notifyPaintCommitted?.();
  }

  writeInput(chunk: TerminalInputChunk): void | Promise<void> {
    return this.#source.writeInput(chunk);
  }

  destroy(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    if (this.#resizeTimer) {
      clearTimeout(this.#resizeTimer);
      this.#resizeTimer = null;
    }
    this.#pendingResize = null;
    this.#renderer.keyInput.off("paste", this.#handlePaste);
    this.#chrome.destroy();
    this.#root.destroyRecursively();
    void this.#source.dispose();
  }

  #handleMouseDown(event: MouseEvent): void {
    if (resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions }) === "close") {
      event.preventDefault();
      this.#input.onCloseRequest?.(this.#node.id);
      return;
    }
    this.#input.onFocus?.(this.#node.id);
  }

  #handleMouseMove(event: MouseEvent): void {
    const action = resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions });
    if (action !== this.#hoveredChromeAction) {
      this.#hoveredChromeAction = action;
      this.#syncTitleChrome();
      this.#renderer.requestRender();
    }
    this.#root.borderColor = this.#node.focused ? (this.#input.accentColor ?? "#38bdf8") : "#475569";
    if (action) {
      event.preventDefault();
    }
  }

  #syncTitleChrome(): void {
    const title = this.#source.readTitle?.() ?? this.#title;
    if (title && title !== this.#title) {
      this.#title = title;
    }
    this.#chromeRegions = this.#chrome.sync({
      root: this.#root,
      rect: this.#node.rect,
      state: {
        title: this.#title,
        hoveredActionId: this.#hoveredChromeAction,
        actions: [shellNextPaneCloseAction()],
      },
    });
  }

  #scheduleBackendResize(size: TerminalPaneSize): void {
    if (this.#lastDeliveredSize === null) {
      this.#deliverBackendResize(size);
      return;
    }
    if (this.#lastDeliveredSize.cols === size.cols && this.#lastDeliveredSize.rows === size.rows) {
      this.#pendingResize = null;
      if (this.#resizeTimer) {
        clearTimeout(this.#resizeTimer);
        this.#resizeTimer = null;
      }
      return;
    }
    this.#pendingResize = size;
    if (this.#resizeTimer) {
      return;
    }
    this.#resizeTimer = setTimeout(() => {
      this.#resizeTimer = null;
      const pending = this.#pendingResize;
      this.#pendingResize = null;
      if (!pending || this.#disposed) {
        return;
      }
      this.#deliverBackendResize(pending);
      this.refresh();
    }, TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS);
  }

  #deliverBackendResize(size: TerminalPaneSize): void {
    this.#lastDeliveredSize = size;
    void this.#source.resize(size);
  }

  #copySelection(ownerId?: string): boolean {
    const copied = this.#source.copySelection?.(ownerId) ?? false;
    if (typeof copied === "string") {
      return copied.length > 0 && this.#renderer.copyToClipboardOSC52(copied);
    }
    return copied;
  }

  #handlePaste = async (): Promise<void> => {
    if (this.#disposed || !this.#node.focused) {
      return;
    }
    const text = await readSystemClipboardText();
    if (!text) {
      return;
    }
    this.#frame.pasteText(text);
  };
}

export const createShellNextFrameBufferTerminalPane: TerminalPaneFactory = (input: TerminalPaneFactoryInput) =>
  new ShellNextFrameBufferTerminalPane(input);
