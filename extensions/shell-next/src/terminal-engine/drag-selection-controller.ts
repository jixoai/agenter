import { MouseButton, type MouseEvent } from "@opentui/core";
import type { TerminalTransportOwnerCoordinate } from "@agenter/terminal-transport-protocol";

export interface ShellNextTerminalDragSelectionBridge {
  readonly hasSelection: () => boolean;
  readonly eventToOwnerCoordinate: (
    event: Pick<MouseEvent, "x" | "y">,
    expectedOwnerId: string | null,
  ) => TerminalTransportOwnerCoordinate | null;
  readonly onSelectionStart?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectionUpdate?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onSelectionEnd?: (point: TerminalTransportOwnerCoordinate) => boolean;
  readonly onClearSelection?: (point: TerminalTransportOwnerCoordinate) => boolean;
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

export class ShellNextTerminalDragSelectionController {
  #state: DragSelectionState = {
    anchor: null,
    focus: null,
    active: false,
  };

  constructor(readonly bridge: ShellNextTerminalDragSelectionBridge) {}

  handleMouseDown(event: MouseEvent): void {
    if (event.button !== MouseButton.LEFT) {
      return;
    }
    const point = this.bridge.eventToOwnerCoordinate(event, null);
    this.bridge.trace("selection-mouse-captured", event, point, {
      reason: point ? "pending" : "outside-owner",
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
}
