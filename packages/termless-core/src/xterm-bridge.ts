import { createTerminalBackend, DEFAULT_TERMINAL_BACKEND, type TerminalBackendKind } from "./backend-factory.js";
import type { TerminalLinesRangeReadable } from "./render-structured-buffer.js";
import {
  TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
  createBackendInteractionAdapter,
  isTerminalInteractionController,
  type TerminalInteractionCapabilities,
  type TerminalInteractionController,
  type TerminalOwnerCoordinate,
  type TerminalSelectionOverlay,
  type TerminalSelectionRange,
} from "./terminal-interaction.js";
import type { Cell, CursorState, ScrollbackState, TerminalBackend, TerminalMode, TerminalReadable } from "./termless-types.js";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 30;
const DEFAULT_SCROLLBACK = 10_000;

const textEncoder = new TextEncoder();

interface TerminalBackendWithRangeReads extends TerminalBackend {
  getLinesRange?: (startRow: number, rowCount: number) => Cell[][];
  getViewportLines?: () => Cell[][];
}

export interface XtermBridgeReadable extends TerminalReadable, TerminalLinesRangeReadable {
  readonly cols: number;
  readonly rows: number;
  readonly backendKind: TerminalBackendKind;
  write(data: string | Uint8Array): Promise<void>;
  writeSync(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  scrollViewport(delta: number): void;
  setViewportStart(viewportStart: number): void;
  followCursor(options?: { viewportRows?: number }): boolean;
  reset(): void;
  dispose(): void;
  onTitleChange(listener: (title: string) => void): () => void;
}

export class XtermReadableBridge implements XtermBridgeReadable, TerminalInteractionController {
  private readonly titleListeners: Array<(title: string) => void> = [];
  private readonly backend: TerminalBackendWithRangeReads;
  private readonly interaction: TerminalInteractionController;
  private lastTitle = "";
  private colsValue: number;
  private rowsValue: number;
  private readonly backendKindValue: TerminalBackendKind;

  constructor(
    cols: number = DEFAULT_COLS,
    rows: number = DEFAULT_ROWS,
    scrollbackLimit: number = DEFAULT_SCROLLBACK,
    backend: TerminalBackendKind = DEFAULT_TERMINAL_BACKEND,
  ) {
    this.colsValue = cols;
    this.rowsValue = rows;
    this.backendKindValue = backend;
    this.backend = createTerminalBackend({
      backend,
      cols,
      rows,
      scrollbackLimit,
    });
    this.interaction = isTerminalInteractionController(this.backend)
      ? this.backend
      : createBackendInteractionAdapter({
          ownerId: TERMINAL_INTERACTION_DEFAULT_OWNER_ID,
          readable: this,
          followCursor: () => this.followCursor(),
        });
    this.lastTitle = this.backend.getTitle();
  }

  async write(data: string | Uint8Array): Promise<void> {
    this.writeSync(data);
  }

  writeSync(data: string | Uint8Array): void {
    this.backend.feed(typeof data === "string" ? textEncoder.encode(data) : data);
    this.flushTitle();
  }

  resize(cols: number, rows: number): void {
    this.colsValue = cols;
    this.rowsValue = rows;
    this.backend.resize(cols, rows);
    this.flushTitle();
  }

  scrollViewport(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    this.backend.scrollViewport(Math.trunc(delta));
    this.flushTitle();
  }

  setViewportStart(viewportStart: number): void {
    const scrollback = this.backend.getScrollback();
    const safeStart = Math.max(0, Math.trunc(viewportStart));
    const delta = safeStart - scrollback.viewportOffset;
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    this.backend.scrollViewport(delta);
    this.flushTitle();
  }

  followCursor(options: { viewportRows?: number } = {}): boolean {
    const cursor = this.backend.getCursor();
    const scrollback = this.backend.getScrollback();
    const requestedRows = Math.trunc(options.viewportRows ?? scrollback.screenLines);
    const viewportSize = Number.isFinite(requestedRows) && requestedRows > 0 ? requestedRows : Math.max(1, scrollback.screenLines);
    const target = Math.max(0, Math.trunc(cursor.y) - viewportSize + 1);
    this.setViewportStart(target);
    return true;
  }

  get interactionCapabilities(): TerminalInteractionCapabilities {
    return this.interaction.interactionCapabilities;
  }

  startSelection(point: TerminalOwnerCoordinate): boolean {
    return this.interaction.startSelection(point);
  }

  updateSelection(point: TerminalOwnerCoordinate): boolean {
    return this.interaction.updateSelection(point);
  }

  endSelection(point: TerminalOwnerCoordinate): boolean {
    return this.interaction.endSelection(point);
  }

  selectRange(range: TerminalSelectionRange): boolean {
    return this.interaction.selectRange(range);
  }

  selectWordAt(point: TerminalOwnerCoordinate): boolean {
    return this.interaction.selectWordAt(point);
  }

  selectLineAt(point: TerminalOwnerCoordinate): boolean {
    return this.interaction.selectLineAt(point);
  }

  clearSelection(ownerId?: string): boolean {
    return this.interaction.clearSelection(ownerId);
  }

  copySelection(ownerId?: string): string {
    return this.interaction.copySelection(ownerId);
  }

  getSelectionOverlay(ownerId?: string): TerminalSelectionOverlay | null {
    return this.interaction.getSelectionOverlay(ownerId);
  }

  reset(): void {
    this.backend.reset();
    this.flushTitle();
  }

  dispose(): void {
    this.backend.destroy();
    this.titleListeners.length = 0;
  }

  getText(): string {
    return this.backend.getText();
  }

  getTextRange(startRow: number, startCol: number, endRow: number, endCol: number): string {
    return this.backend.getTextRange(startRow, startCol, endRow, endCol);
  }

  getCell(row: number, col: number): Cell {
    return this.backend.getCell(row, col);
  }

  getLine(row: number): Cell[] {
    return this.backend.getLine(row);
  }

  getLines(): Cell[][] {
    return this.backend.getLines();
  }

  getLinesRange(startRow: number, rowCount: number): Cell[][] {
    const safeStart = Math.max(0, Math.trunc(startRow));
    const safeRows = Math.max(1, Math.trunc(rowCount));
    return this.backend.getLinesRange?.(safeStart, safeRows) ??
      Array.from({ length: safeRows }, (_, index) => this.backend.getLine(safeStart + index));
  }

  getViewportLines(): Cell[][] {
    const scrollback = this.backend.getScrollback();
    return this.backend.getViewportLines?.() ?? this.getLinesRange(scrollback.viewportOffset, this.rows);
  }

  getCursor(): CursorState {
    return this.backend.getCursor();
  }

  getMode(mode: TerminalMode): boolean {
    return this.backend.getMode(mode);
  }

  getTitle(): string {
    return this.backend.getTitle();
  }

  getScrollback(): ScrollbackState {
    return this.backend.getScrollback();
  }

  onTitleChange(listener: (title: string) => void): () => void {
    this.titleListeners.push(listener);
    return () => {
      const index = this.titleListeners.indexOf(listener);
      if (index >= 0) {
        this.titleListeners.splice(index, 1);
      }
    };
  }

  get cols(): number {
    return this.colsValue;
  }

  get rows(): number {
    return this.rowsValue;
  }

  get backendKind(): TerminalBackendKind {
    return this.backendKindValue;
  }

  private flushTitle(): void {
    const nextTitle = this.backend.getTitle();
    if (nextTitle === this.lastTitle) {
      return;
    }
    this.lastTitle = nextTitle;
    for (const listener of this.titleListeners) {
      listener(nextTitle);
    }
  }
}

export { XtermReadableBridge as XtermBridge };
