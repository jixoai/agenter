import {
  MouseButton,
  TextRenderable,
  isEditBufferRenderable,
  type CliRenderer,
  type EditBufferRenderable,
  type MouseEvent,
  type Renderable,
} from "@opentui/core";

// shell-next keeps renderer semantic selection as an explicit local behavior.
// Generic pane composition stays neutral, and custom terminal panes do not install this.
const SEMANTIC_CLICK_MAX_MS = 450;
const DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS = 1;
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

interface ShellNextRendererClickTracker {
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
  readonly renderableId: string;
  readonly row: number;
  readonly button: number;
  readonly count: number;
}

interface MeasuredLineCell {
  readonly char: string;
  readonly index: number;
  readonly startCol: number;
  readonly endCol: number;
}

export interface ShellNextRendererSelectionTarget {
  readonly renderable: Renderable;
  readonly semanticWordSelection?: boolean;
  readonly semanticLineSelection?: boolean;
  readonly resolveLocalPoint?: (
    event: Pick<MouseEvent, "x" | "y">,
  ) => { row: number; col: number; selectionY?: number } | null;
}

export interface ShellNextRendererSelectionBehavior {
  handleMouseDown(event: MouseEvent): boolean;
  handleMouseUp(event: MouseEvent): boolean;
}

export interface ShellNextRendererSelectionBehaviorInput {
  readonly renderer: CliRenderer;
  readonly resolveTargets: () => readonly ShellNextRendererSelectionTarget[];
  readonly semanticClickMaxDistanceCells?: number;
}

type ShellNextSemanticSelectionTarget = ShellNextRendererSelectionTarget & {
  readonly renderable: TextRenderable | EditBufferRenderable;
};

interface ShellNextRendererSelectionPoint {
  readonly row: number;
  readonly col: number;
  readonly selectionY: number;
}

const preserveRendererSelection = (event: MouseEvent): boolean => {
  if (event.button !== MouseButton.MIDDLE) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
};

const normalizeSemanticClickMaxDistance = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS;
  }
  return Math.max(0, Math.trunc(value));
};

const measureLine = (line: string): { readonly cells: readonly MeasuredLineCell[]; readonly width: number } => {
  const cells: MeasuredLineCell[] = [];
  let startCol = 0;
  for (const [index, char] of Array.from(line).entries()) {
    const width = Math.max(1, Bun.stringWidth(char));
    cells.push({
      char,
      index,
      startCol,
      endCol: startCol + width,
    });
    startCol += width;
  }
  return { cells, width: startCol };
};

const resolveWordRange = (line: string, localCol: number): { startCol: number; endCol: number } | null => {
  const measured = measureLine(line);
  if (measured.cells.length === 0) {
    return null;
  }
  const clickCol = Math.max(0, Math.trunc(localCol));
  const cellIndex = measured.cells.findIndex((cell) => clickCol < cell.endCol);
  const resolvedIndex = cellIndex >= 0 ? cellIndex : measured.cells.length - 1;
  const seed = measured.cells[resolvedIndex];
  if (!seed || /\s/u.test(seed.char)) {
    return null;
  }
  const isWord = WORD_CHAR_RE.test(seed.char);
  let startIndex = resolvedIndex;
  let endIndex = resolvedIndex;
  while (startIndex > 0) {
    const previous = measured.cells[startIndex - 1];
    if (!previous || /\s/u.test(previous.char) || WORD_CHAR_RE.test(previous.char) !== isWord) {
      break;
    }
    startIndex -= 1;
  }
  while (endIndex + 1 < measured.cells.length) {
    const next = measured.cells[endIndex + 1];
    if (!next || /\s/u.test(next.char) || WORD_CHAR_RE.test(next.char) !== isWord) {
      break;
    }
    endIndex += 1;
  }
  return {
    startCol: measured.cells[startIndex]?.startCol ?? 0,
    endCol: measured.cells[endIndex]?.endCol ?? measured.width,
  };
};

const resolveEditorWordRange = (
  renderable: EditBufferRenderable,
  localRow: number,
  localCol: number,
): { startOffset: number; endOffset: number } | null => {
  const line = renderable.plainText.split(/\r?\n/u)[localRow] ?? "";
  const measured = measureLine(line);
  if (measured.cells.length === 0) {
    return null;
  }
  const clickCol = Math.max(0, Math.trunc(localCol));
  const cellIndex = measured.cells.findIndex((cell) => clickCol < cell.endCol);
  const resolvedIndex = cellIndex >= 0 ? cellIndex : measured.cells.length - 1;
  const seed = measured.cells[resolvedIndex];
  if (!seed || /\s/u.test(seed.char)) {
    return null;
  }
  const isWord = WORD_CHAR_RE.test(seed.char);
  let startIndex = resolvedIndex;
  let endIndex = resolvedIndex;
  while (startIndex > 0) {
    const previous = measured.cells[startIndex - 1];
    if (!previous || /\s/u.test(previous.char) || WORD_CHAR_RE.test(previous.char) !== isWord) {
      break;
    }
    startIndex -= 1;
  }
  while (endIndex + 1 < measured.cells.length) {
    const next = measured.cells[endIndex + 1];
    if (!next || /\s/u.test(next.char) || WORD_CHAR_RE.test(next.char) !== isWord) {
      break;
    }
    endIndex += 1;
  }
  return {
    startOffset: renderable.editBuffer.positionToOffset(localRow, measured.cells[startIndex]?.index ?? 0),
    endOffset: renderable.editBuffer.positionToOffset(localRow, (measured.cells[endIndex]?.index ?? -1) + 1),
  };
};

const readProvidedClickCount = (event: MouseEvent): number | null => {
  const candidate = event as unknown as { clickCount?: unknown; detail?: unknown };
  const value = typeof candidate.clickCount === "number" ? candidate.clickCount : candidate.detail;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(1, Math.trunc(value));
};

export class ShellNextRendererSelectionController implements ShellNextRendererSelectionBehavior {
  #lastClick: ShellNextRendererClickTracker | null = null;
  readonly #semanticClickMaxDistanceCells: number;

  constructor(readonly input: ShellNextRendererSelectionBehaviorInput) {
    this.#semanticClickMaxDistanceCells = normalizeSemanticClickMaxDistance(input.semanticClickMaxDistanceCells);
  }

  handleMouseDown(event: MouseEvent): boolean {
    if (preserveRendererSelection(event)) {
      return true;
    }
    if (event.button !== MouseButton.LEFT) {
      return false;
    }
    const target = this.#resolveTarget(event.target);
    if (!target) {
      this.#lastClick = null;
      return false;
    }
    const point = this.#resolveLocalPoint(target, event);
    if (!point) {
      this.#lastClick = null;
      return false;
    }
    const clickCount = this.#resolveClickCount(event, target.renderable, point.row);
    if (clickCount >= 3 && target.semanticLineSelection !== false && this.#selectLine(target, point)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    if (clickCount === 2 && target.semanticWordSelection !== false && this.#selectWord(target, point)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  }

  handleMouseUp(event: MouseEvent): boolean {
    return preserveRendererSelection(event);
  }

  #resolveTarget(renderable: Renderable | null): ShellNextSemanticSelectionTarget | null {
    if (!renderable) {
      return null;
    }
    const targets = this.input.resolveTargets().filter(
      (target): target is ShellNextSemanticSelectionTarget =>
        !target.renderable.isDestroyed &&
        (target.renderable instanceof TextRenderable || isEditBufferRenderable(target.renderable)),
    );
    const targetById = new Map(targets.map((target) => [target.renderable.id, target] as const));
    let cursor: Renderable | null = renderable;
    while (cursor) {
      const target = targetById.get(cursor.id);
      if (target) {
        return target;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  #resolveLocalPoint(
    target: ShellNextSemanticSelectionTarget,
    event: Pick<MouseEvent, "x" | "y">,
  ): ShellNextRendererSelectionPoint | null {
    const projected = target.resolveLocalPoint?.(event);
    if (projected) {
      return {
        row: Math.trunc(projected.row),
        col: Math.trunc(projected.col),
        selectionY: Math.trunc(projected.selectionY ?? event.y),
      };
    }
    return {
      row: Math.trunc(event.y) - target.renderable.screenY,
      col: Math.trunc(event.x) - target.renderable.screenX,
      selectionY: target.renderable.screenY + (Math.trunc(event.y) - target.renderable.screenY),
    };
  }

  #resolveClickCount(event: MouseEvent, renderable: Renderable, row: number): number {
    const now = performance.now();
    const localX = Math.trunc(event.x);
    const localY = Math.trunc(event.y);
    const previous = this.#lastClick;
    const providedClickCount = readProvidedClickCount(event);
    const sameClickCluster =
      previous !== null &&
      previous.button === event.button &&
      previous.renderableId === renderable.id &&
      previous.row === row &&
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
      renderableId: renderable.id,
      row,
      button: event.button,
      count: Math.min(nextCount, 3),
    };
    return this.#lastClick.count;
  }

  #selectWord(target: ShellNextSemanticSelectionTarget, point: ShellNextRendererSelectionPoint): boolean {
    if (target.renderable instanceof TextRenderable) {
      const lines = target.renderable.plainText.split(/\r?\n/u);
      const line = lines[point.row];
      if (line === undefined) {
        return false;
      }
      const range = resolveWordRange(line, point.col);
      if (!range) {
        return false;
      }
      this.input.renderer.startSelection(target.renderable, target.renderable.screenX + range.startCol, point.selectionY);
      this.input.renderer.updateSelection(
        target.renderable,
        target.renderable.screenX + range.endCol,
        point.selectionY,
        { finishDragging: true },
      );
      return true;
    }
    const lines = target.renderable.plainText.split(/\r?\n/u);
    const line = lines[point.row];
    if (line === undefined) {
      return false;
    }
    const range = resolveEditorWordRange(target.renderable, point.row, point.col);
    if (!range) {
      return false;
    }
    target.renderable.setSelection(range.startOffset, range.endOffset);
    return true;
  }

  #selectLine(target: ShellNextSemanticSelectionTarget, point: ShellNextRendererSelectionPoint): boolean {
    if (target.renderable instanceof TextRenderable) {
      const line = target.renderable.plainText.split(/\r?\n/u)[point.row];
      if (line === undefined) {
        return false;
      }
      const width = Math.max(0, Bun.stringWidth(line));
      this.input.renderer.startSelection(target.renderable, target.renderable.screenX, point.selectionY);
      this.input.renderer.updateSelection(
        target.renderable,
        target.renderable.screenX + width,
        point.selectionY,
        { finishDragging: true },
      );
      return true;
    }
    const line = target.renderable.plainText.split(/\r?\n/u)[point.row];
    if (line === undefined) {
      return false;
    }
    const startOffset = target.renderable.editBuffer.positionToOffset(point.row, 0);
    const endOffset = target.renderable.editBuffer.positionToOffset(point.row, Array.from(line).length);
    target.renderable.setSelection(startOffset, endOffset);
    return true;
  }
}

export const createShellNextRendererSelectionBehavior = (
  input: ShellNextRendererSelectionBehaviorInput,
): ShellNextRendererSelectionBehavior => new ShellNextRendererSelectionController(input);

export const preserveRendererSelectionOnMiddleClick = preserveRendererSelection;
