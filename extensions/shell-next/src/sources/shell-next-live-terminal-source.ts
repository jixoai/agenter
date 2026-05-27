import type { TerminalTransportOwnerCoordinate, TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";
import {
  OPENCOMPOSE_PRODUCT_DYNAMIC_QUIET_MS,
  createOpenComposeLiveTerminalMirror,
  type OpenComposeLiveTerminalMirror,
  type OpenComposeLiveTerminalPacingOptions,
  type OpenComposeLiveTerminalTransportSessionFactory,
} from "../opencompose/terminal-frame/live-terminal-mirror";

import type {
  PaneSourceId,
  TerminalFrameSnapshot,
  TerminalInputChunk,
  TerminalPaneSize,
  TerminalProtocolPaneSource,
} from "../renderable-mux/pane-source";

export interface ShellNextLiveTerminalProtocolSourceInput {
  readonly id: PaneSourceId;
  readonly terminalId: string;
  readonly transportUrl: string;
  readonly initialSnapshot?: TerminalTransportSnapshot | null;
  readonly initialTitle?: string | null;
  readonly configuredTitle?: string | null;
  readonly currentTitle?: string | null;
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
  #disposed = false;

  constructor(input: ShellNextLiveTerminalProtocolSourceInput) {
    this.id = input.id;
    this.#initialTitle = input.initialTitle ?? null;
    this.#configuredTitle = input.configuredTitle ?? null;
    this.#currentTitle = input.currentTitle ?? null;
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
    return this.#currentTitle ?? this.#configuredTitle ?? this.#initialTitle ?? this.id.value;
  }

  writeInput(chunk: TerminalInputChunk): void {
    if (this.#disposed) {
      return;
    }
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    this.#mirror.sendInputBytes(bytes);
  }

  resize(size: TerminalPaneSize): void {
    if (this.#disposed) {
      return;
    }
    this.#mirror.resize(size.cols, size.rows);
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

  clearSelection(ownerId?: string): boolean {
    return !this.#disposed && this.#mirror.clearSelection(ownerId);
  }

  copySelection(ownerId?: string): boolean {
    return !this.#disposed && this.#mirror.copySelection(ownerId);
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
    this.#releaseMirror();
    this.#mirror.disconnect();
  }

  #emit(): void {
    if (this.#disposed) {
      return;
    }
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
