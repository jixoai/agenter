import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionRange,
  TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";
import {
  createTerminalHostInputController,
  type TerminalHostInputTarget,
  type TerminalHostKeyEvent,
  type TerminalHostPointerDispatchResult,
  type TerminalHostPointerInput,
  type TerminalKeyboardInteractionView,
} from "@agenter/termless-backend-utils";
import {
  OPENCOMPOSE_PRODUCT_DYNAMIC_QUIET_MS,
  createOpenComposeLiveTerminalMirror,
  type OpenComposeLiveTerminalMirror,
  type OpenComposeLiveTerminalPacingOptions,
  type OpenComposeLiveTerminalTransportSessionFactory,
} from "../opencompose/terminal-frame/live-terminal-mirror";

import type {
  PaneSourceId,
  TerminalCopyTarget,
  TerminalFrameSnapshot,
  TerminalInputChunk,
  TerminalPaneSize,
  TerminalProtocolPaneSource,
  TerminalSelectionTextEvent,
} from "../renderable-mux/pane-source";
import { ConflatedResizeDispatcher } from "./conflated-resize-dispatcher";

const LIVE_TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS = 25;

export interface ShellNextLiveTerminalProtocolSourceInput {
  readonly id: PaneSourceId;
  readonly terminalId: string;
  readonly transportUrl: string;
  readonly initialSnapshot?: TerminalTransportSnapshot | null;
  readonly initialTitle?: string | null;
  readonly configuredTitle?: string | null;
  readonly currentTitle?: string | null;
  readonly readTitle?: () => string | null;
  readonly terminateTerminal?: () => void | Promise<void>;
  readonly onSelectionText?: (event: TerminalSelectionTextEvent) => void;
  readonly geometryRole?: "projection-only" | "authority";
  readonly pacing?: OpenComposeLiveTerminalPacingOptions;
  readonly createTransportSession?: OpenComposeLiveTerminalTransportSessionFactory;
}

export class ShellNextLiveTerminalProtocolSource implements TerminalProtocolPaneSource {
  readonly kind = "terminal-protocol" as const;
  readonly id: PaneSourceId;
  readonly #mirror: OpenComposeLiveTerminalMirror;
  readonly #listeners = new Set<() => void>();
  readonly ready: Promise<void>;
  readonly #releaseMirror: () => void;
  readonly #configuredTitle: string | null;
  readonly #currentTitle: string | null;
  readonly #initialTitle: string | null;
  readonly #readTitle: (() => string | null) | undefined;
  readonly #terminateTerminal: (() => void | Promise<void>) | undefined;
  readonly #selectionTextListeners = new Set<(event: TerminalSelectionTextEvent) => void>();
  readonly #resizeDispatcher: ConflatedResizeDispatcher;
  readonly #hostInput = createTerminalHostInputController();
  #pendingCopyTarget: TerminalCopyTarget | null = null;
  #terminated = false;
  #disposed = false;

  constructor(input: ShellNextLiveTerminalProtocolSourceInput) {
    this.id = input.id;
    this.#initialTitle = input.initialTitle ?? null;
    this.#configuredTitle = input.configuredTitle ?? null;
    this.#currentTitle = input.currentTitle ?? null;
    this.#readTitle = input.readTitle;
    this.#terminateTerminal = input.terminateTerminal;
    this.#resizeDispatcher = new ConflatedResizeDispatcher({
      delayMs: LIVE_TERMINAL_BACKEND_RESIZE_DEBOUNCE_MS,
      deliver: (size) => {
        if (!this.#disposed) {
          this.#mirror.resize(size.cols, size.rows);
        }
      },
    });
    this.#mirror = createOpenComposeLiveTerminalMirror({
      terminalId: input.terminalId,
      transportUrl: input.transportUrl,
      initialSnapshot: input.initialSnapshot ?? null,
      geometryRole: input.geometryRole ?? "authority",
      pacing: input.pacing ?? {
        mode: "dynamic",
        dynamicQuietMs: OPENCOMPOSE_PRODUCT_DYNAMIC_QUIET_MS,
      },
      createTransportSession: input.createTransportSession,
      onSelectionText: (event) => {
        const target = this.#pendingCopyTarget ?? "clipboard";
        this.#pendingCopyTarget = null;
        const targetedEvent = { ...event, target };
        input.onSelectionText?.(targetedEvent);
        this.#emitSelectionText(targetedEvent);
      },
      requestPaint: () => this.#emit(),
    });
    this.#releaseMirror = this.#mirror.subscribe(() => this.#emit());
    this.ready = this.#mirror.connect().catch((error: unknown) => {
      this.#releaseMirror();
      throw error;
    });
  }

  readFrame(): TerminalFrameSnapshot {
    const view = this.#mirror.getView();
    return {
      size: {
        cols: view.cols,
        rows: view.rows,
      },
      lines: view.plainLines,
      richLines: view.richLines,
      cursor: {
        x: view.cursorCol,
        y: Math.max(0, view.cursorAbsRow - view.viewportStart),
        visible: view.cursorVisible,
      },
      viewportStart: view.viewportStart,
      scrollbackRows: view.scrollbackRows,
      selectionOverlays: view.interaction?.selectionOverlays,
      revision: view.snapshotSeq,
    };
  }

  readTitle(): string | null {
    const liveTitle = this.#readTitle?.()?.trim();
    return liveTitle && liveTitle.length > 0
      ? liveTitle
      : (this.#currentTitle ?? this.#configuredTitle ?? this.#initialTitle ?? this.id.value);
  }

  writeInput(chunk: TerminalInputChunk): boolean {
    if (this.#disposed) {
      return false;
    }
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    return this.#mirror.sendInputBytes(bytes);
  }

  handleKey(key: TerminalHostKeyEvent): boolean {
    return this.#hostInput.handleKey(this.#inputTarget(), key);
  }

  pasteText(text: string): boolean {
    return this.#hostInput.pasteText(this.#inputTarget(), text);
  }

  pointerDown(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    return this.#hostInput.handlePointerDown(this.#inputTarget(), input);
  }

  pointerDrag(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    return this.#hostInput.handlePointerDrag(this.#inputTarget(), input);
  }

  pointerUp(input: TerminalHostPointerInput): TerminalHostPointerDispatchResult {
    return this.#hostInput.handlePointerUp(this.#inputTarget(), input);
  }

  resize(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    this.#resizeDispatcher.resize(size);
  }

  scrollViewport(deltaRows: number): boolean {
    return !this.#disposed && this.#mirror.scrollViewport(deltaRows);
  }

  setViewportStart(viewportStart: number): boolean {
    return !this.#disposed && this.#mirror.setViewportStart(viewportStart);
  }

  followCursor(): boolean {
    return !this.#disposed && this.#mirror.followCursor();
  }

  selectionStart(point: TerminalTransportOwnerCoordinate): boolean {
    return !this.#disposed && this.#mirror.selectionStart(point);
  }

  selectionUpdate(point: TerminalTransportOwnerCoordinate): boolean {
    return !this.#disposed && this.#mirror.selectionUpdate(point);
  }

  selectionEnd(point: TerminalTransportOwnerCoordinate): boolean {
    return !this.#disposed && this.#mirror.selectionEnd(point);
  }

  selectWordAt(point: TerminalTransportOwnerCoordinate): boolean {
    return !this.#disposed && this.#mirror.selectWordAt(point);
  }

  selectLineAt(point: TerminalTransportOwnerCoordinate): boolean {
    return !this.#disposed && this.#mirror.selectLineAt(point);
  }

  selectRange(range: TerminalTransportSelectionRange): boolean {
    return !this.#disposed && this.#mirror.selectRange(range);
  }

  clearSelection(ownerId?: string): boolean {
    return !this.#disposed && this.#mirror.clearSelection(ownerId);
  }

  copySelection(ownerId?: string, target: TerminalCopyTarget = "clipboard"): boolean {
    if (this.#disposed) {
      return false;
    }
    this.#pendingCopyTarget = target;
    const copied = this.#mirror.copySelection(ownerId);
    if (!copied) {
      this.#pendingCopyTarget = null;
    }
    return copied;
  }

  subscribeSelectionText(listener: (event: TerminalSelectionTextEvent) => void): () => void {
    this.#selectionTextListeners.add(listener);
    return () => {
      this.#selectionTextListeners.delete(listener);
    };
  }

  notifyPaintCommitted(): void {
    if (this.#disposed) {
      return;
    }
    this.#mirror.notifyPaintCommitted();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#listeners.clear();
    this.#selectionTextListeners.clear();
    this.#resizeDispatcher.dispose();
    this.#releaseMirror();
    this.#mirror.disconnect();
  }

  async terminate(): Promise<void> {
    if (this.#terminated) {
      this.dispose();
      return;
    }
    this.#terminated = true;
    try {
      await this.#terminateTerminal?.();
    } finally {
      this.dispose();
    }
  }

  #emit(): void {
    if (this.#disposed) {
      return;
    }
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #emitSelectionText(event: TerminalSelectionTextEvent): void {
    if (this.#disposed) {
      return;
    }
    for (const listener of this.#selectionTextListeners) {
      listener(event);
    }
  }

  #readKeyboardInteractionView(): TerminalKeyboardInteractionView | null {
    const view = this.#mirror.getView();
    return {
      cursorAbsRow: view.cursorAbsRow,
      cursorCol: view.cursorCol,
      viewportStart: view.viewportStart,
      plainLines: view.plainLines,
    };
  }

  #inputTarget(): TerminalHostInputTarget {
    return {
      readKeyboardInteractionView: () => this.#readKeyboardInteractionView(),
      writeInput: (chunk) => this.writeInput(chunk),
      followCursor: () => this.#mirror.followCursor(),
      startSelection: (point) => this.#mirror.selectionStart(point),
      updateSelection: (point) => this.#mirror.selectionUpdate(point),
      endSelection: (point) => this.#mirror.selectionEnd(point),
      selectRange: (range) => this.#mirror.selectRange(range),
      selectWordAt: (point) => this.#mirror.selectWordAt(point),
      selectLineAt: (point) => this.#mirror.selectLineAt(point),
      clearSelection: (ownerId) => this.#mirror.clearSelection(ownerId),
      getSelectionOverlay: (ownerId) =>
        this.#mirror
          .getView()
          .interaction?.selectionOverlays?.find((overlay) => ownerId === undefined || overlay.ownerId === ownerId) ??
        null,
    };
  }
}
