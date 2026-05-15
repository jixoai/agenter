import {
  FrameBufferRenderable,
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

import { measureTerminalText } from "./cell-width";
import type { CliShellSelectionRegion, CliShellSelectionSource } from "./types";

const DEFAULT_FG = RGBA.fromHex("#f3f6fb");
const DEFAULT_BG = RGBA.fromHex("#111111");
const DEFAULT_SELECTION_BG = RGBA.fromHex("#2563eb");

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
  selectionBg?: RGBA;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseDrag?: (event: MouseEvent) => void;
  onMouseScroll?: (event: MouseEvent) => void;
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
  selectionBg?: RGBA;
}

export class BackendFrameRenderable extends FrameBufferRenderable {
  #lines: readonly TerminalRenderRichLine[];
  #selectionRegion: NonNullable<BackendFrameRenderableOptions["selectionRegion"]> | null;
  #selectionRegions: readonly CliShellSelectionRegion[];
  #selectionSources: readonly CliShellSelectionSource[];
  #selection: LocalSelectionBounds | null = null;
  #selectionBg: RGBA;
  #selectionOwner: CliShellSelectionRegion["owner"] | null = null;
  #lastPaintStats: BackendFramePaintStats = {
    durationMs: 0,
    rows: 0,
    spans: 0,
    glyphs: 0,
  };

  constructor(ctx: RenderContext, options: BackendFrameRenderableOptions) {
    super(ctx, options);
    this.focusable = true;
    this.selectable = true;
    this.onMouseDown = options.onMouseDown;
    this.onMouseDrag = options.onMouseDrag;
    this.onMouseScroll = options.onMouseScroll;
    this.#lines = options.lines;
    this.#selectionRegion = options.selectionRegion ?? null;
    this.#selectionRegions = options.selectionRegions ?? [];
    this.#selectionSources = options.selectionSources ?? [];
    this.#selectionBg = options.selectionBg ?? DEFAULT_SELECTION_BG;
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
    if (this.#selectionOwner && !this.#selectionRegions.some((region) => region.owner === this.#selectionOwner)) {
      this.#selectionOwner = null;
    }
    this.paintAndRequestRender();
  }

  set selectionSources(selectionSources: readonly CliShellSelectionSource[] | undefined) {
    this.#selectionSources = selectionSources ?? [];
    this.paintAndRequestRender();
  }

  set selectionBg(selectionBg: RGBA | undefined) {
    this.#selectionBg = selectionBg ?? DEFAULT_SELECTION_BG;
    this.paintAndRequestRender();
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
      if (this.#selectionOwner && !this.#selectionRegions.some((region) => region.owner === this.#selectionOwner)) {
        this.#selectionOwner = null;
      }
    }
    if ("selectionSources" in update) {
      this.#selectionSources = update.selectionSources ?? [];
    }
    if (update.selectionBg) {
      this.#selectionBg = update.selectionBg;
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
    const localX = Math.trunc(x - this.x);
    const localY = Math.trunc(y - this.y);
    const region = this.resolveSelectionRegionForPoint(localX, localY);
    this.#selectionOwner = region.owner;
    return (
      localX >= region.x &&
      localY >= region.y &&
      localX < region.x + region.width &&
      localY < region.y + region.height &&
      localY < Math.min(this.height, this.#lines.length)
    );
  }

  onSelectionChanged(selection: Selection | null): boolean {
    this.#selection =
      selection?.isDragging || (selection?.isActive && !selection.isStart)
        ? convertGlobalToLocalSelection(selection, this.x, this.y)
        : null;
    this.paintAndRequestRender();
    return this.hasSelection();
  }

  hasSelection(): boolean {
    return this.resolveSelectionRange() !== null;
  }

  getSelectedText(): string {
    const range = this.resolveSelectionRange();
    if (!range) {
      return "";
    }
    const lines: string[] = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      const line = this.plainLineAt(row);
      const { startCol, endCol } = this.resolveSelectedColumnsForRow(range, row);
      lines.push(this.sliceLineByColumns(line, startCol, endCol).trimEnd());
    }
    return lines.join("\n");
  }

  getSelectionOwner(): CliShellSelectionRegion["owner"] | null {
    return this.resolveSelectionRange() ? this.#selectionOwner : null;
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

  protected plainLineAt(row: number): string {
    const source = this.resolveSelectionSourceForRow(row);
    if (!source) {
      return this.#lines[row]?.spans.map((span) => span.text).join("") ?? "";
    }
    const localRow = row - source.row;
    const line = source.lines[localRow]?.spans.map((span) => span.text).join("") ?? "";
    return `${" ".repeat(source.col)}${line}`;
  }

  protected resolveSelectionRange(): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
    const selection = this.#selection;
    if (!selection?.isActive) {
      return null;
    }
    const region = this.resolveActiveSelectionRegion();
    if (region.width <= 0 || region.height <= 0) {
      return null;
    }
    const maxRow = Math.max(region.y, region.y + region.height - 1);
    const maxCol = Math.max(region.x, region.x + region.width - 1);
    const anchorRow = Math.max(region.y, Math.min(maxRow, Math.trunc(selection.anchorY)));
    const focusRow = Math.max(region.y, Math.min(maxRow, Math.trunc(selection.focusY)));
    const anchorCol = Math.max(region.x, Math.min(maxCol, Math.trunc(selection.anchorX)));
    const focusCol = Math.max(region.x, Math.min(maxCol, Math.trunc(selection.focusX)));
    if (anchorRow === focusRow && anchorCol === focusCol) {
      return null;
    }
    const startBeforeFocus = anchorRow < focusRow || (anchorRow === focusRow && anchorCol <= focusCol);
    const startRow = startBeforeFocus ? anchorRow : focusRow;
    const endRow = startBeforeFocus ? focusRow : anchorRow;
    const startCol = startBeforeFocus ? anchorCol : focusCol;
    const endCol = (startBeforeFocus ? focusCol : anchorCol) + 1;
    if (startRow > endRow || (startRow === endRow && startCol >= endCol)) {
      return null;
    }
    return { startRow, endRow, startCol, endCol };
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

  protected resolveActiveSelectionRegion(): {
    x: number;
    y: number;
    width: number;
    height: number;
    owner: CliShellSelectionRegion["owner"] | null;
  } {
    if (this.#selectionOwner) {
      const match = this.#selectionRegions.find((region) => region.owner === this.#selectionOwner);
      if (match) {
        return this.normalizeSelectionRegion(match);
      }
    }
    return this.resolveFallbackSelectionRegion();
  }

  protected resolveSelectionSourceForRow(row: number): CliShellSelectionSource | null {
    const owner = this.#selectionOwner;
    if (!owner) {
      return null;
    }
    return (
      this.#selectionSources.find(
        (source) => source.owner === owner && row >= source.row && row < source.row + source.height,
      ) ?? null
    );
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
      return { x: 0, y: 0, width: this.width, height: this.height, owner: null };
    }
    return this.normalizeSelectionRegion({
      owner: null,
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

  protected isCellRangeSelected(row: number, startCol: number, endCol: number): boolean {
    const range = this.resolveSelectionRange();
    if (!range || row < range.startRow || row > range.endRow) {
      return false;
    }
    const { startCol: selectionStartCol, endCol: selectionEndCol } = this.resolveSelectedColumnsForRow(range, row);
    return startCol < selectionEndCol && endCol > selectionStartCol;
  }

  protected resolveSelectedColumnsForRow(
    range: { startRow: number; endRow: number; startCol: number; endCol: number },
    row: number,
  ): { startCol: number; endCol: number } {
    const region = this.resolveActiveSelectionRegion();
    const regionStartCol = region.x;
    const regionEndCol = region.x + region.width;
    return {
      startCol: row === range.startRow ? range.startCol : regionStartCol,
      endCol: row === range.endRow ? range.endCol : regionEndCol,
    };
  }

  protected sliceLineByColumns(line: string, startCol: number, endCol: number): string {
    let result = "";
    let col = 0;
    for (const char of Array.from(line)) {
      const width = Math.max(1, measureTerminalText(char));
      const nextCol = col + width;
      if (nextCol > startCol && col < endCol) {
        result += char;
      }
      if (nextCol >= endCol) {
        break;
      }
      col = nextCol;
    }
    return result;
  }
}
