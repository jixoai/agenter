import type { TerminalHostPointerInput, TerminalRenderRichLine } from "@agenter/termless-core";
import { BoxRenderable, type CliRenderer, type MouseEvent, type Renderable } from "@opentui/core";
import { OpenComposeTerminalFrameRenderable } from "../opencompose/terminal-frame/terminal-frame-renderable";

import type { ChildLayoutNode, LayoutRect } from "../renderable-mux/layout";
import { ShellNextButtonPressController } from "../renderable-mux/button-press-controller";
import type { TerminalPaneFactory, TerminalPaneFactoryInput } from "../renderable-mux/mux-renderable";
import { SHELL_NEXT_CLIPBOARD_TARGETS } from "../renderable-mux/host-copy";
import {
  ShellNextPaneChromeController,
  resolveShellNextPaneChromeClick,
  shellNextPaneCloseAction,
  type ShellNextPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { PaneFrameRenderEvent } from "../renderable-mux/pane-renderable";
import type {
  TerminalCopyTarget,
  TerminalInputChunk,
  TerminalPaneSize,
  TerminalProtocolPaneSource,
} from "../renderable-mux/pane-source";
import { ShellNextResizeSendScheduler } from "./resize-send-scheduler";

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

export interface ShellNextFrameBufferTerminalPaneInput {
  readonly renderer: CliRenderer;
  readonly node: ChildLayoutNode;
  readonly source: TerminalProtocolPaneSource;
  readonly title: string;
  readonly sendInputText?: (text: string) => boolean;
  readonly accentColor?: string;
  readonly onFocus?: (paneId: string) => void;
  readonly onCloseRequest?: (paneId: string) => void;
  readonly onFrameRendered?: (event: PaneFrameRenderEvent) => void;
  readonly resizeDebounceMs?: number;
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
  #disposed = false;
  #title: string;
  #chromeRegions: readonly ShellNextPaneChromeHitRegion[] = [];
  #hoveredChromeAction: string | null = null;
  readonly #resizeScheduler: ShellNextResizeSendScheduler;
  readonly #buttonPress: ShellNextButtonPressController<string>;

  constructor(input: ShellNextFrameBufferTerminalPaneInput) {
    this.#renderer = input.renderer;
    this.#source = input.source;
    this.#node = input.node;
    this.#input = input;
    this.#title = input.title;
    this.#buttonPress = new ShellNextButtonPressController({
      resolveAction: (event) => resolveShellNextPaneChromeClick({ event, regions: this.#chromeRegions }),
      onClick: (action, event) => {
        if (action === "close") {
          event.preventDefault();
          this.#input.onCloseRequest?.(this.#node.id);
        }
      },
      onHoverChange: (action) => {
        if (action === this.#hoveredChromeAction) {
          return;
        }
        this.#hoveredChromeAction = action;
        this.#syncTitleChrome();
        this.#renderer.requestRender();
      },
    });
    this.#resizeScheduler = new ShellNextResizeSendScheduler({
      delayMs: input.resizeDebounceMs ?? 200,
      send: (size) => this.#source.resize(size),
    });
    this.#chrome = new ShellNextPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-framebuffer-terminal-chrome`,
      bg: "#020617",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
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
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
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
          return this.#input.sendInputText?.(text) ?? this.writeInput(text);
        },
        scrollViewport: (deltaRows) => this.#source.scrollViewport?.(deltaRows) ?? false,
        setViewportStart: (viewportStart) => this.#source.setViewportStart?.(viewportStart) ?? false,
        followCursor: () => this.#source.followCursor?.() ?? false,
        pointerDown: (input) => this.#source.pointerDown?.(input),
        pointerDrag: (input) => this.#source.pointerDrag?.(input),
        pointerUp: (input) => this.#handlePointerUp(input),
        copySelection: (ownerId, target) => this.#copySelection(ownerId, target),
        handleUnsupportedMediaPaste: () => false,
      },
    });
    this.#root.add(this.#frame);
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
      const firstSize = this.#lastSize === null;
      this.#lastSize = size;
      if (firstSize) {
        void this.#source.resize(size);
      } else {
        this.#resizeScheduler.schedule(size);
      }
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

  writeInput(chunk: TerminalInputChunk): boolean {
    return this.#source.writeInput(chunk);
  }

  destroy(options?: { preserveSource?: boolean }): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#resizeScheduler.dispose();
    this.#chrome.destroy();
    this.#root.destroyRecursively();
    if (options?.preserveSource !== true) {
      void this.#source.dispose();
    }
  }

  #handleMouseDown(event: MouseEvent): void {
    if (this.#buttonPress.handleMouseDown(event)) {
      return;
    }
    this.#input.onFocus?.(this.#node.id);
  }

  #handleMouseUp(event: MouseEvent): void {
    this.#buttonPress.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    this.#buttonPress.handleMouseMove(event);
    this.#root.borderColor = this.#node.focused ? (this.#input.accentColor ?? "#38bdf8") : "#475569";
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

  #handlePointerUp(input: TerminalHostPointerInput) {
    const result = this.#source.pointerUp?.(input);
    if (result?.handled) {
      this.#copySelection(input.point?.ownerId, "primary");
    }
    return result;
  }

  #copySelection(ownerId?: string, target: TerminalCopyTarget = "clipboard"): boolean {
    const copied = this.#source.copySelection?.(ownerId, target) ?? false;
    if (typeof copied === "string") {
      return (
        copied.length > 0 &&
        this.#renderer.copyToClipboardOSC52(
          copied,
          target === "primary" ? SHELL_NEXT_CLIPBOARD_TARGETS.primary : SHELL_NEXT_CLIPBOARD_TARGETS.clipboard,
        )
      );
    }
    return copied;
  }

}

export const createShellNextFrameBufferTerminalPane: TerminalPaneFactory = (input: TerminalPaneFactoryInput) =>
  new ShellNextFrameBufferTerminalPane(input);
