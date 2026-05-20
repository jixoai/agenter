import type {
  TerminalTransportInteractionFrameState,
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionOverlay,
} from "@agenter/terminal-transport-protocol";
import { createBackendInteractionAdapter, type Cell, type TerminalInteractionController } from "@agenter/termless-core";

import { measureTerminalText } from "./cell-width";
import { buildCliShellDialogueSurface, type CliShellDialogueSurface } from "./dialogue-surface";
import type { CliShellTranscriptPanelLayout } from "./frame";
import type { CliShellTuiModel } from "./types";

export interface CliShellDialogueBackendFrame extends CliShellDialogueSurface {
  cols: number;
  rows: number;
  cursor: { x: number; y: number; visible: boolean };
}

export const projectCliShellDialogueBackendFrame = (input: {
  layout: Pick<CliShellTranscriptPanelLayout, "width" | "height">;
  model: CliShellTuiModel;
  renderFocusedDraft?: boolean;
}): CliShellDialogueBackendFrame => {
  const surface = buildCliShellDialogueSurface(input);
  return {
    ...surface,
    cols: Math.max(0, input.layout.width),
    rows: Math.max(0, input.layout.height),
    cursor: {
      x: surface.cursor.x,
      y: surface.cursor.y,
      visible: surface.cursor.visible,
    },
  };
};

const emptyCell = (char: string): Cell => ({
  char,
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  underlineColor: null,
  strikethrough: false,
  inverse: false,
  blink: false,
  hidden: false,
  wide: measureTerminalText(char) > 1,
  continuation: false,
  hyperlink: null,
});

const styledLineToCells = (line: CliShellDialogueBackendFrame["styledLines"][number] | undefined): Cell[] => {
  const cells: Cell[] = [];
  for (const span of line?.spans ?? []) {
    for (const char of Array.from(span.text)) {
      const width = Math.max(1, measureTerminalText(char));
      cells.push(emptyCell(char));
      for (let index = 1; index < width; index += 1) {
        cells.push({ ...emptyCell(""), continuation: true });
      }
    }
  }
  return cells;
};

export class CliShellDialogueBackend {
  #frame: CliShellDialogueBackendFrame = {
    cols: 0,
    rows: 0,
    lines: [],
    styledLines: [],
    actionRegions: [],
    cursor: { x: 0, y: 0, visible: false },
    viewport: {
      offsetFromBottom: 0,
      maxOffsetFromBottom: 0,
      totalRows: 0,
      visibleRows: 0,
    },
    chrome: { scrollbar: "visible" },
  };
  readonly #interaction: TerminalInteractionController;

  constructor() {
    this.#interaction = createBackendInteractionAdapter({
      ownerId: "dialogue",
      readable: {
        getLine: (row) => styledLineToCells(this.#frame.styledLines[Math.max(0, Math.trunc(row))]),
        getScrollback: () => ({
          viewportOffset: 0,
          totalLines: this.#frame.rows,
          screenLines: this.#frame.rows,
        }),
      },
    });
  }

  project(input: {
    layout: Pick<CliShellTranscriptPanelLayout, "width" | "height">;
    model: CliShellTuiModel;
    renderFocusedDraft?: boolean;
  }): CliShellDialogueBackendFrame {
    this.#frame = projectCliShellDialogueBackendFrame(input);
    return this.#frame;
  }

  selectionStart(point: TerminalTransportOwnerCoordinate): boolean {
    return this.#interaction.startSelection(point);
  }

  selectionUpdate(point: TerminalTransportOwnerCoordinate): boolean {
    return this.#interaction.updateSelection(point);
  }

  selectionEnd(point: TerminalTransportOwnerCoordinate): boolean {
    return this.#interaction.endSelection(point);
  }

  selectWordAt(point: TerminalTransportOwnerCoordinate): boolean {
    return this.#interaction.selectWordAt(point);
  }

  selectLineAt(point: TerminalTransportOwnerCoordinate): boolean {
    return this.#interaction.selectLineAt(point);
  }

  clearSelection(): boolean {
    return this.#interaction.clearSelection("dialogue");
  }

  copySelection(): string {
    return this.#interaction.copySelection("dialogue");
  }

  getInteractionFrameState(): TerminalTransportInteractionFrameState {
    const overlay = this.#interaction.getSelectionOverlay("dialogue");
    return {
      activeOwnerId: overlay ? "dialogue" : undefined,
      selectionOverlays: overlay
        ? [
            {
              ownerId: overlay.ownerId,
              ownership: overlay.ownership,
              rows: overlay.rows.map((row) => ({ ...row })),
              selectedText: overlay.selectedText,
            } satisfies TerminalTransportSelectionOverlay,
          ]
        : undefined,
      capabilities: {
        dialogue: { ...this.#interaction.interactionCapabilities },
      },
    };
  }
}
