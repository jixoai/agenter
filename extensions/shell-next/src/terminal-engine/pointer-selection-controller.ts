import { MouseButton, type MouseEvent } from "@opentui/core";
import type { TerminalTransportOwnerCoordinate } from "@agenter/terminal-transport-protocol";

const SEMANTIC_CLICK_MAX_MS = 450;
const DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS = 1;

interface ShellNextTerminalClickTracker {
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
  readonly ownerId: string;
  readonly row: number;
  readonly button: number;
  readonly count: number;
}

const normalizeSemanticClickMaxDistance = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SEMANTIC_CLICK_MAX_DISTANCE_CELLS;
  }
  return Math.max(0, Math.trunc(value));
};

export interface ShellNextTerminalPointerSelectionBridge {
  readonly hasSelection: () => boolean;
  readonly eventToOwnerCoordinate: (
    event: Pick<MouseEvent, "x" | "y">,
    expectedOwnerId: string | null,
  ) => TerminalTransportOwnerCoordinate | null;
  readonly onSelectionStart?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectionUpdate?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectionEnd?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onClearSelection?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectWordAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectLineAt?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly semanticWordSelection?: boolean;
  readonly semanticRowSelection?: boolean;
  readonly semanticClickMaxDistanceCells?: number;
  readonly trace: (
    kind:
      | "selection-mouse-captured"
      | "selection-drag-pending"
      | "selection-drag-started"
      | "selection-drag-updated"
      | "selection-drag-ended"
      | "selection-drag-cancelled"
      | "selection-clear-requested",
    event: Pick<MouseEvent, "type" | "button" | "x" | "y">,
    point: TerminalTransportOwnerCoordinate | null,
    extra?: { reason?: string },
  ) => void;
}

interface DragSelectionState {
  anchor: TerminalTransportOwnerCoordinate | null;
  focus: TerminalTransportOwnerCoordinate | null;
  active: boolean;
}

export class ShellNextTerminalPointerSelectionController {
  #state: DragSelectionState = {
    anchor: null,
    focus: null,
    active: false,
  };
  #lastClick: ShellNextTerminalClickTracker | null = null;
  readonly #semanticClickMaxDistanceCells: number;

  constructor(readonly bridge: ShellNextTerminalPointerSelectionBridge) {
    this.#semanticClickMaxDistanceCells = normalizeSemanticClickMaxDistance(bridge.semanticClickMaxDistanceCells);
  }

  handleMouseDown(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const point = this.bridge.eventToOwnerCoordinate(event, null);
    if (!point) {
      this.#lastClick = null;
      this.bridge.trace("selection-mouse-captured", event, point, {
        reason: "outside-owner",
      });
      this.#state = {
        anchor: null,
        focus: null,
        active: false,
      };
      return;
    }
    const semanticConsumed = this.#handleSemanticMouseDown(event, point);
    if (semanticConsumed) {
      this.#state = {
        anchor: null,
        focus: null,
        active: false,
      };
      return;
    }
    this.bridge.trace("selection-mouse-captured", event, point, {
      reason: "pending",
    });
    this.#state = {
      anchor: point,
      focus: null,
      active: false,
    };
  }

  handleMouseDrag(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const anchor = this.#state.anchor;
    if (!anchor) {
      this.bridge.trace("selection-drag-cancelled", event, null, { reason: "no-anchor" });
      return;
    }
    const focus = this.bridge.eventToOwnerCoordinate(event, anchor.ownerId);
    if (!focus) {
      this.bridge.trace("selection-drag-cancelled", event, anchor, { reason: "outside-anchor-owner" });
      return;
    }
    const moved = focus.row !== anchor.row || focus.col !== anchor.col;
    if (!moved && !this.#state.active) {
      this.bridge.trace("selection-drag-pending", event, focus, { reason: "same-cell" });
      return;
    }
    if (!this.#state.active) {
      this.bridge.onSelectionStart?.(anchor);
      this.#state = {
        anchor,
        focus: anchor,
        active: true,
      };
      this.bridge.trace("selection-drag-started", event, anchor);
    }
    this.#state = {
      anchor,
      focus,
      active: true,
    };
    this.bridge.onSelectionUpdate?.(focus);
    this.bridge.trace("selection-drag-updated", event, focus);
    event.preventDefault();
  }

  handleMouseEnd(event: MouseEvent): void {
    const focus = this.#state.focus;
    if (this.#state.active && focus) {
      this.bridge.onSelectionEnd?.(focus);
      this.bridge.trace("selection-drag-ended", event, focus);
      event.preventDefault();
    } else if (this.#state.anchor) {
      const anchor = this.#state.anchor;
      this.bridge.trace("selection-drag-cancelled", event, anchor, { reason: "released-before-drag" });
      if (this.bridge.hasSelection() && this.bridge.onClearSelection?.(anchor)) {
        this.bridge.trace("selection-clear-requested", event, anchor);
        event.preventDefault();
      }
    }
    this.#state = {
      anchor: null,
      focus: null,
      active: false,
    };
  }

  #handleSemanticMouseDown(event: MouseEvent, point: TerminalTransportOwnerCoordinate): boolean {
    const clickCount = this.#resolveClickCount(event, point);
    if (clickCount >= 3 && this.bridge.semanticRowSelection !== false && this.bridge.onSelectLineAt?.(point)) {
      event.preventDefault();
      return true;
    }
    if (clickCount === 2 && this.bridge.semanticWordSelection !== false && this.bridge.onSelectWordAt?.(point)) {
      event.preventDefault();
      return true;
    }
    return false;
  }

  #resolveClickCount(event: MouseEvent, point: TerminalTransportOwnerCoordinate): number {
    const now = performance.now();
    const localX = Math.trunc(event.x);
    const localY = Math.trunc(event.y);
    const previous = this.#lastClick;
    const providedClickCount = this.#readProvidedClickCount(event);
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

  #readProvidedClickCount(event: MouseEvent): number | null {
    const candidate = event as unknown as { clickCount?: unknown; detail?: unknown };
    const value = typeof candidate.clickCount === "number" ? candidate.clickCount : candidate.detail;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return Math.max(1, Math.trunc(value));
  }
}
