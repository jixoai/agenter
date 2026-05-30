import {
  FrameBufferRenderable,
  MouseButton,
  RGBA,
  TextAttributes,
  convertGlobalToLocalSelection,
  type FrameBufferOptions,
  type LocalSelectionBounds,
  type MouseEvent,
  type RenderContext,
  type Selection,
} from "@opentui/core";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionOverlay,
} from "@agenter/terminal-transport-protocol";

import { measureTerminalText } from "./cell-width";
import {
  CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
  type CliShellInteractionEnhancementProfile,
} from "./interaction-capabilities";
import type { CliShellSelectionRegion, CliShellSelectionSource } from "./types";

const DEFAULT_FG = RGBA.fromHex("#f3f6fb");
const DEFAULT_BG = RGBA.fromHex("#111111");
const DEFAULT_SELECTION_BG = RGBA.fromHex("#2563eb");
const SEMANTIC_CLICK_MAX_MS = 450;
const DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS = 1;
const DEFAULT_OWNER_ID = "terminal";

interface BackendFrameClickTracker {
  timeMs: number;
  x: number;
  y: number;
  ownerId: string;
  row: number;
  button: number;
  count: number;
}

const toColor = (color: string | undefined, fallback: RGBA): RGBA => {
  if (!color) {
    return fallback;
  }
  try {
    return RGBA.fromHex(color);
  } catch {
    return fallback;
  }
};

const normalizeSemanticClickMaxDistance = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS;
  }
  return Math.max(0, Math.trunc(value));
};

export interface BackendFrameRenderableOptions extends FrameBufferOptions {
  lines: readonly TerminalRenderRichLine[];
  selectionRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  selectionRegions?: readonly CliShellSelectionRegion[];
  selectionSources?: readonly CliShellSelectionSource[];
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  selectionBg?: RGBA;
  interactionProfile?: CliShellInteractionEnhancementProfile;
  semanticClickMaxDistanceCells?: number;
  onSelectionStart?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onSelectionUpdate?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onSelectionEnd?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onClearSelection?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onSelectWordAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onSelectLineAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  onInteractionTrace?: (event: BackendFrameInteractionTraceEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseDrag?: (event: MouseEvent) => void;
  onMouseDragEnd?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onMouseScroll?: (event: MouseEvent) => void;
}

export interface BackendFrameInteractionTraceEvent {
  kind:
    | "selection-mouse-captured"
    | "selection-opentui-changed"
    | "selection-drag-pending"
    | "selection-drag-started"
    | "selection-drag-updated"
    | "selection-drag-ended"
    | "selection-drag-cancelled"
    | "selection-clear-requested";
  detail: {
    eventType?: string;
    button?: number;
    x?: number;
    y?: number;
    ownerId?: string;
    row?: number;
    col?: number;
    reason?: string;
  };
}

export interface BackendFramePaintStats {
  durationMs: number;
  rows: number;
  spans: number;
  glyphs: number;
}

export interface BackendFrameProjectionUpdate {
  lines?: readonly TerminalRenderRichLine[];
  selectionRegion?: BackendFrameRenderableOptions["selectionRegion"];
  selectionRegions?: readonly CliShellSelectionRegion[];
  selectionSources?: readonly CliShellSelectionSource[];
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  selectionBg?: RGBA;
  interactionProfile?: CliShellInteractionEnhancementProfile;
  cursor?: {
    row: number;
    col: number;
    visible: boolean;
  } | null;
}

export class BackendFrameRenderable extends FrameBufferRenderable {
  #lines: readonly TerminalRenderRichLine[];
  #selectionRegion: NonNullable<BackendFrameRenderableOptions["selectionRegion"]> | null;
  #selectionRegions: readonly CliShellSelectionRegion[];
  #selectionSources: readonly CliShellSelectionSource[];
  #selectionOverlays: readonly TerminalTransportSelectionOverlay[];
  #selectionBg: RGBA;
  #interactionProfile: CliShellInteractionEnhancementProfile;
  #semanticClickMaxDistanceCells: number;
  #cursor: { row: number; col: number; visible: boolean } | null = null;
  #activeSelectionOwnerId: string | null = null;
  #lastSelectionPoint: TerminalTransportOwnerCoordinate | null = null;
  #pendingDragAnchor: TerminalTransportOwnerCoordinate | null = null;
  #dragBridgeActive = false;
  #lastClick: BackendFrameClickTracker | null = null;
  #lastPaintStats: BackendFramePaintStats = {
    durationMs: 0,
    rows: 0,
    spans: 0,
    glyphs: 0,
  };
  #onSelectionStart?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onSelectionUpdate?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onSelectionEnd?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onClearSelection?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onSelectWordAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onSelectLineAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  #onInteractionTrace?: (event: BackendFrameInteractionTraceEvent) => void;

  constructor(ctx: RenderContext, options: BackendFrameRenderableOptions) {
    super(ctx, options);
    this.focusable = true;
    this.selectable = true;
    this.onMouseScroll = options.onMouseScroll;
    this.#lines = options.lines;
    this.#selectionRegion = options.selectionRegion ?? null;
    this.#selectionRegions = options.selectionRegions ?? [];
    this.#selectionSources = options.selectionSources ?? [];
    this.#selectionOverlays = options.selectionOverlays ?? [];
    this.#selectionBg = options.selectionBg ?? DEFAULT_SELECTION_BG;
    this.#interactionProfile = options.interactionProfile ?? CLI_SHELL_DEFAULT_INTERACTION_PROFILE;
    this.#semanticClickMaxDistanceCells = normalizeSemanticClickMaxDistance(options.semanticClickMaxDistanceCells);
    this.#onSelectionStart = options.onSelectionStart;
    this.#onSelectionUpdate = options.onSelectionUpdate;
    this.#onSelectionEnd = options.onSelectionEnd;
    this.#onClearSelection = options.onClearSelection;
    this.#onSelectWordAt = options.onSelectWordAt;
    this.#onSelectLineAt = options.onSelectLineAt;
    this.#onInteractionTrace = options.onInteractionTrace;
    const userMouseDown = options.onMouseDown;
    const userMouseDrag = options.onMouseDrag;
    const userMouseDragEnd = options.onMouseDragEnd;
    const userMouseUp = options.onMouseUp;
    this.onMouseDown = (event) => {
      this.handleSemanticMouseDown(event);
      this.handleBackendDragMouseDown(event);
      userMouseDown?.(event);
    };
    this.onMouseDrag = (event) => {
      this.handleBackendDragMouseDrag(event);
      userMouseDrag?.(event);
    };
    this.onMouseDragEnd = (event) => {
      this.handleBackendDragMouseEnd(event);
      userMouseDragEnd?.(event);
    };
    this.onMouseUp = (event) => {
      this.handleBackendDragMouseEnd(event);
      userMouseUp?.(event);
    };
    this.paintBackendFrame();
  }

  set lines(lines: readonly TerminalRenderRichLine[]) {
    this.#lines = lines;
    this.paintAndRequestRender();
  }

  set selectionRegion(selectionRegion: BackendFrameRenderableOptions["selectionRegion"]) {
    this.#selectionRegion = selectionRegion ?? null;
    this.paintAndRequestRender();
  }

  set selectionRegions(selectionRegions: readonly CliShellSelectionRegion[] | undefined) {
    this.#selectionRegions = selectionRegions ?? [];
    if (this.#activeSelectionOwnerId && !this.#selectionRegions.some((region) => region.owner === this.#activeSelectionOwnerId)) {
      this.#activeSelectionOwnerId = null;
    }
    this.paintAndRequestRender();
  }

  set selectionSources(selectionSources: readonly CliShellSelectionSource[] | undefined) {
    this.#selectionSources = selectionSources ?? [];
    this.paintAndRequestRender();
  }

  set selectionOverlays(selectionOverlays: readonly TerminalTransportSelectionOverlay[] | undefined) {
    this.#selectionOverlays = selectionOverlays ?? [];
    this.#activeSelectionOwnerId = this.#selectionOverlays[0]?.ownerId ?? null;
    this.paintAndRequestRender();
  }

  set selectionBg(selectionBg: RGBA | undefined) {
    this.#selectionBg = selectionBg ?? DEFAULT_SELECTION_BG;
    this.paintAndRequestRender();
  }

  set semanticClickMaxDistanceCells(value: number | undefined) {
    this.#semanticClickMaxDistanceCells = normalizeSemanticClickMaxDistance(value);
  }

  updateProjection(update: BackendFrameProjectionUpdate): BackendFramePaintStats {
    if (update.lines) {
      this.#lines = update.lines;
    }
    if ("selectionRegion" in update) {
      this.#selectionRegion = update.selectionRegion ?? null;
    }
    if ("selectionRegions" in update) {
      this.#selectionRegions = update.selectionRegions ?? [];
      if (this.#activeSelectionOwnerId && !this.#selectionRegions.some((region) => region.owner === this.#activeSelectionOwnerId)) {
        this.#activeSelectionOwnerId = null;
      }
    }
    if ("selectionSources" in update) {
      this.#selectionSources = update.selectionSources ?? [];
    }
    if ("selectionOverlays" in update) {
      this.#selectionOverlays = update.selectionOverlays ?? [];
      this.#activeSelectionOwnerId = this.#selectionOverlays[0]?.ownerId ?? null;
    }
    if (update.selectionBg) {
      this.#selectionBg = update.selectionBg;
    }
    if (update.interactionProfile) {
      this.#interactionProfile = update.interactionProfile;
    }
    if ("cursor" in update) {
      this.#cursor = update.cursor ?? null;
    }
    this.paintAndRequestRender();
    return this.#lastPaintStats;
  }

  get lastPaintStats(): BackendFramePaintStats {
    return this.#lastPaintStats;
  }

  protected onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.paintBackendFrame();
  }

  shouldStartSelection(x: number, y: number): boolean {
    const point = this.globalToOwnerCoordinate(x, y);
    if (!point) {
      return false;
    }
    this.#pendingDragAnchor = point;
    this.#activeSelectionOwnerId = point.ownerId;
    this.#lastSelectionPoint = null;
    return true;
  }

  onSelectionChanged(selection: Selection | null): boolean {
    if (this.#pendingDragAnchor || this.#dragBridgeActive) {
      return this.hasSelection();
    }
    this.traceSelectionChange(selection);
    const localSelection =
      selection?.isDragging || (selection?.isActive && !selection.isStart)
        ? convertGlobalToLocalSelection(selection, this.x, this.y)
        : null;
    const sent = this.routeSelectionChange(localSelection);
    if (!selection?.isActive || selection.isDragging === false) {
      const ended = this.#lastSelectionPoint ? (this.#onSelectionEnd?.(this.#lastSelectionPoint) ?? false) : false;
      if (ended && this.#lastSelectionPoint) {
        this.traceInteraction("selection-drag-ended", {
          type: "drag-end",
          button: MouseButton.LEFT,
          x: this.x + this.#lastSelectionPoint.col,
          y: this.y + this.#lastSelectionPoint.row,
        }, this.#lastSelectionPoint, { reason: "opentui-selection-finished" });
      }
      this.#activeSelectionOwnerId = null;
      this.#lastSelectionPoint = null;
      this.#pendingDragAnchor = null;
      return sent || ended || this.hasSelection();
    }
    return sent || this.hasSelection();
  }

  hasSelection(): boolean {
    return this.#selectionOverlays.some((overlay) => overlay.rows.length > 0);
  }

  getSelectionOwner(): CliShellSelectionRegion["owner"] | null {
    const ownerId = this.#selectionOverlays[0]?.ownerId ?? this.#activeSelectionOwnerId;
    return ownerId === "terminal" || ownerId === "dialogue" ? ownerId : null;
  }

  protected paintAndRequestRender(): void {
    this.paintBackendFrame();
    this.requestRender();
  }

  protected paintBackendFrame(): BackendFramePaintStats {
    const startedAt = performance.now();
    this.frameBuffer.clear(DEFAULT_BG);
    const maxRows = Math.min(this.height, this.#lines.length);
    let spanCount = 0;
    let glyphCount = 0;
    for (let row = 0; row < maxRows; row += 1) {
      const line = this.#lines[row];
      if (!line) {
        continue;
      }
      let col = 0;
      for (const span of line.spans) {
        spanCount += 1;
        const baseFg = span.inverse ? toColor(span.bg, DEFAULT_BG) : toColor(span.fg, DEFAULT_FG);
        const baseBg = span.inverse ? toColor(span.fg, DEFAULT_FG) : toColor(span.bg, DEFAULT_BG);
        const attributes =
          (span.bold ? TextAttributes.BOLD : TextAttributes.NONE) |
          (span.underline ? TextAttributes.UNDERLINE : TextAttributes.NONE);
        let segmentText = "";
        let segmentStartCol = col;
        let segmentSelected: boolean | null = null;

        const flushSegment = (): void => {
          if (segmentText.length === 0) {
            return;
          }
          this.frameBuffer.drawText(
            segmentText,
            segmentStartCol,
            row,
            baseFg,
            segmentSelected ? this.#selectionBg : baseBg,
            attributes,
          );
          segmentText = "";
        };

        for (const char of Array.from(span.text)) {
          const charWidth = Math.max(1, measureTerminalText(char));
          if (col >= this.width || col + charWidth > this.width) {
            break;
          }
          const selected = this.isCellRangeSelected(row, col, col + charWidth);
          if (segmentSelected !== selected) {
            flushSegment();
            segmentSelected = selected;
            segmentStartCol = col;
          }
          segmentText += char;
          glyphCount += 1;
          col += charWidth;
        }
        flushSegment();
        if (col >= this.width) {
          break;
        }
      }
    }
    this.#lastPaintStats = {
      durationMs: performance.now() - startedAt,
      rows: maxRows,
      spans: spanCount,
      glyphs: glyphCount,
    };
    return this.#lastPaintStats;
  }

  override render(buffer: Parameters<FrameBufferRenderable["render"]>[0], deltaTime: number): void {
    super.render(buffer, deltaTime);
    this.syncNativeCursor();
  }

  protected syncNativeCursor(): void {
    const cursor = this.#cursor;
    if (!this.focused || !cursor?.visible) {
      this.ctx.setCursorPosition(0, 0, false);
      return;
    }
    const row = Math.trunc(cursor.row);
    const col = Math.trunc(cursor.col);
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      this.ctx.setCursorPosition(0, 0, false);
      return;
    }
    // OpenTUI's native cursor API addresses terminal cells in 1-based screen coordinates.
    // cli-shell terminal projections keep cursor row/col in 0-based viewport-local cells.
    // We previously handled this explicitly in the legacy native-projection/backend-frame path.
    // If we pass the raw 0-based values here, the visible hardware cursor lands one cell up-left
    // and can present as a (-1,-1)-style offset to the user.
    this.ctx.setCursorStyle({ style: "block", blinking: false });
    this.ctx.setCursorPosition(this.screenX + col + 1, this.screenY + row + 1, true);
  }

  protected isCellRangeSelected(row: number, startCol: number, endCol: number): boolean {
    return this.#selectionOverlays.some((overlay) => {
      const source = this.resolveSelectionSourceForOwner(overlay.ownerId);
      const sourceRow = source?.row ?? 0;
      const sourceCol = source?.col ?? 0;
      const backendStartRow = source?.sourceStartRow ?? 0;
      return overlay.rows.some((overlayRow) => {
        const screenRow = sourceRow + (overlayRow.row - backendStartRow);
        const screenStartCol = sourceCol + overlayRow.startCol;
        const screenEndCol = sourceCol + overlayRow.endCol;
        return screenRow === row && startCol < screenEndCol && endCol > screenStartCol;
      });
    });
  }

  protected resolveSelectionRegionForPoint(
    localX: number,
    localY: number,
  ): { x: number; y: number; width: number; height: number; owner: CliShellSelectionRegion["owner"] | null } {
    for (const region of this.#selectionRegions) {
      const normalized = this.normalizeSelectionRegion(region);
      if (
        localX >= normalized.x &&
        localY >= normalized.y &&
        localX < normalized.x + normalized.width &&
        localY < normalized.y + normalized.height
      ) {
        return normalized;
      }
    }
    if (this.#selectionRegions.length > 0) {
      return { x: 0, y: 0, width: 0, height: 0, owner: null };
    }
    return this.resolveFallbackSelectionRegion();
  }

  protected resolveFallbackSelectionRegion(): {
    x: number;
    y: number;
    width: number;
    height: number;
    owner: CliShellSelectionRegion["owner"] | null;
  } {
    const region = this.#selectionRegion;
    if (!region) {
      return { x: 0, y: 0, width: this.width, height: this.height, owner: "terminal" };
    }
    return this.normalizeSelectionRegion({
      owner: "terminal",
      row: region.y,
      col: region.x,
      width: region.width,
      height: region.height,
    });
  }

  protected normalizeSelectionRegion(region: {
    owner: CliShellSelectionRegion["owner"] | null;
    row: number;
    col: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number; owner: CliShellSelectionRegion["owner"] | null } {
    const x = Math.max(0, Math.min(this.width, Math.trunc(region.col)));
    const y = Math.max(0, Math.min(this.height, Math.trunc(region.row)));
    const width = Math.max(0, Math.min(this.width - x, Math.trunc(region.width)));
    const height = Math.max(0, Math.min(this.height - y, Math.trunc(region.height)));
    return { x, y, width, height, owner: region.owner };
  }

  private routeSelectionChange(selection: LocalSelectionBounds | null): boolean {
    if (!selection?.isActive) {
      return false;
    }
    const anchor = this.localToOwnerCoordinate(selection.anchorX, selection.anchorY, this.#activeSelectionOwnerId);
    const focus = this.localToOwnerCoordinate(selection.focusX, selection.focusY, anchor?.ownerId ?? null);
    if (!anchor || !focus || anchor.ownerId !== focus.ownerId) {
      return false;
    }
    const moved = focus.row !== anchor.row || focus.col !== anchor.col;
    if (!moved && this.#pendingDragAnchor) {
      return false;
    }
    if (!this.#lastSelectionPoint) {
      this.#onSelectionStart?.(anchor);
    }
    this.#pendingDragAnchor = null;
    this.#activeSelectionOwnerId = anchor.ownerId;
    this.#lastSelectionPoint = focus;
    return this.#onSelectionUpdate?.(focus) ?? false;
  }

  private globalToOwnerCoordinate(globalX: number, globalY: number): TerminalTransportOwnerCoordinate | null {
    return this.localToOwnerCoordinate(Math.trunc(globalX - this.x), Math.trunc(globalY - this.y), null);
  }

  private localToOwnerCoordinate(
    localX: number,
    localY: number,
    expectedOwnerId: string | null,
  ): TerminalTransportOwnerCoordinate | null {
    const x = Math.trunc(localX);
    const y = Math.trunc(localY);
    const region = this.resolveSelectionRegionForPoint(x, y);
    if (!this.isPointInsideRegion(x, y, region)) {
      return null;
    }
    const ownerId = region.owner ?? DEFAULT_OWNER_ID;
    if (expectedOwnerId !== null && ownerId !== expectedOwnerId) {
      return null;
    }
    const source = this.resolveSelectionSourceForOwner(ownerId);
    const sourceRow = Math.max(0, Math.trunc(source?.sourceStartRow ?? 0));
    const sourceLocalRow = source ? y - source.row : y - region.y;
    const sourceLocalCol = source ? x - source.col : x - region.x;
    const maxCol = Math.max(0, Math.trunc((source?.width ?? region.width) - 1));
    return {
      ownerId,
      row: Math.max(0, sourceRow + sourceLocalRow),
      col: Math.max(0, Math.min(maxCol, sourceLocalCol)),
    };
  }

  private resolveSelectionSourceForOwner(ownerId: string): CliShellSelectionSource | null {
    return this.#selectionSources.find((source) => source.owner === ownerId) ?? null;
  }

  private handleSemanticMouseDown(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const localX = Math.trunc(event.x - this.x);
    const localY = Math.trunc(event.y - this.y);
    const point = this.localToOwnerCoordinate(localX, localY, null);
    if (!point) {
      this.#lastClick = null;
      return;
    }
    const clickCount = this.resolveClickCount(event, localX, localY, point);
    if (clickCount >= 3 && this.#interactionProfile.semanticRowSelection && this.#onSelectLineAt?.(point)) {
      event.preventDefault();
      return;
    }
    if (clickCount === 2 && this.#interactionProfile.semanticWordSelection && this.#onSelectWordAt?.(point)) {
      event.preventDefault();
    }
  }

  private handleBackendDragMouseDown(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const point = this.eventToOwnerCoordinate(event, null);
    this.traceInteraction("selection-mouse-captured", event, point, {
      reason: point ? "pending" : "outside-owner",
    });
    this.#pendingDragAnchor = point;
    this.#dragBridgeActive = false;
    if (point) {
      this.#activeSelectionOwnerId = point.ownerId;
      this.#lastSelectionPoint = null;
    }
  }

  private handleBackendDragMouseDrag(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const anchor = this.#pendingDragAnchor;
    if (!anchor) {
      this.traceInteraction("selection-drag-cancelled", event, null, { reason: "no-anchor" });
      return;
    }
    const focus = this.eventToOwnerCoordinate(event, anchor.ownerId);
    if (!focus) {
      this.traceInteraction("selection-drag-cancelled", event, anchor, { reason: "outside-anchor-owner" });
      return;
    }
    const moved = focus.row !== anchor.row || focus.col !== anchor.col;
    if (!moved && !this.#dragBridgeActive) {
      this.traceInteraction("selection-drag-pending", event, focus, { reason: "same-cell" });
      return;
    }
    if (!this.#dragBridgeActive) {
      this.#activeSelectionOwnerId = anchor.ownerId;
      this.#lastSelectionPoint = anchor;
      this.#onSelectionStart?.(anchor);
      this.#dragBridgeActive = true;
      this.traceInteraction("selection-drag-started", event, anchor);
    }
    this.#lastSelectionPoint = focus;
    this.#onSelectionUpdate?.(focus);
    this.traceInteraction("selection-drag-updated", event, focus);
    event.preventDefault();
  }

  private handleBackendDragMouseEnd(event: MouseEvent): void {
    const focus = this.#lastSelectionPoint;
    if (this.#dragBridgeActive && focus) {
      this.#onSelectionEnd?.(focus);
      this.traceInteraction("selection-drag-ended", event, focus);
      event.preventDefault();
    } else if (this.#pendingDragAnchor) {
      const anchor = this.#pendingDragAnchor;
      this.traceInteraction("selection-drag-cancelled", event, anchor, { reason: "released-before-drag" });
      if (this.hasSelection() && this.#onClearSelection?.(anchor)) {
        this.traceInteraction("selection-clear-requested", event, anchor);
        event.preventDefault();
      }
    }
    this.#pendingDragAnchor = null;
    this.#dragBridgeActive = false;
  }

  private eventToOwnerCoordinate(
    event: MouseEvent,
    expectedOwnerId: string | null,
  ): TerminalTransportOwnerCoordinate | null {
    return this.localToOwnerCoordinate(Math.trunc(event.x - this.x), Math.trunc(event.y - this.y), expectedOwnerId);
  }

  private traceInteraction(
    kind: BackendFrameInteractionTraceEvent["kind"],
    event: Pick<MouseEvent, "type" | "button" | "x" | "y">,
    point: TerminalTransportOwnerCoordinate | null,
    extra: Partial<BackendFrameInteractionTraceEvent["detail"]> = {},
  ): void {
    this.#onInteractionTrace?.({
      kind,
      detail: {
        eventType: event.type,
        button: event.button,
        x: event.x,
        y: event.y,
        ...(point
          ? {
              ownerId: point.ownerId,
              row: point.row,
              col: point.col,
            }
          : null),
        ...extra,
      },
    });
  }

  private traceSelectionChange(selection: Selection | null): void {
    const anchor = selection ? this.globalToOwnerCoordinate(selection.anchor.x, selection.anchor.y) : null;
    const focus = selection ? this.globalToOwnerCoordinate(selection.focus.x, selection.focus.y) : null;
    this.#onInteractionTrace?.({
      kind: "selection-opentui-changed",
      detail: {
        eventType: selection
          ? selection.isStart
            ? "start"
            : selection.isDragging
              ? "drag"
              : "end"
          : "clear",
        ownerId: focus?.ownerId ?? anchor?.ownerId,
        row: focus?.row ?? anchor?.row,
        col: focus?.col ?? anchor?.col,
        reason:
          selection === null
            ? "selection-null"
            : selection.isStart
              ? "selection-start"
              : selection.isDragging
                ? "selection-dragging"
                : "selection-finished",
      },
    });
  }

  private resolveClickCount(
    event: MouseEvent,
    localX: number,
    localY: number,
    point: TerminalTransportOwnerCoordinate,
  ): number {
    const now = performance.now();
    const previous = this.#lastClick;
    const providedClickCount = this.readProvidedClickCount(event);
    const sameClickCluster =
      previous !== null &&
      previous.button === event.button &&
      previous.ownerId === point.ownerId &&
      previous.row === point.row &&
      now - previous.timeMs <= SEMANTIC_CLICK_MAX_MS &&
      Math.abs(previous.x - localX) <= this.#semanticClickMaxDistanceCells &&
      previous.y === localY;
    const nextCount =
      sameClickCluster && providedClickCount !== null
        ? Math.max(previous.count + 1, providedClickCount)
        : sameClickCluster
          ? previous.count + 1
          : 1;
    this.#lastClick = {
      timeMs: now,
      x: localX,
      y: localY,
      ownerId: point.ownerId,
      row: point.row,
      button: event.button,
      count: Math.min(nextCount, 3),
    };
    return this.#lastClick.count;
  }

  private readProvidedClickCount(event: MouseEvent): number | null {
    const candidate = event as unknown as { clickCount?: unknown; detail?: unknown };
    const value = typeof candidate.clickCount === "number" ? candidate.clickCount : candidate.detail;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return Math.max(1, Math.trunc(value));
  }

  private isPointInsideRegion(
    localX: number,
    localY: number,
    region: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      localX >= region.x &&
      localY >= region.y &&
      localX < region.x + region.width &&
      localY < region.y + region.height &&
      localY < Math.min(this.height, this.#lines.length)
    );
  }
}
