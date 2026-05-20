import type { ProductTerminalComposedSurfaceState } from "@agenter/client-sdk";

import { layoutCliShellTuiFrame, resolveCliShellTerminalRegion } from "./frame";
import { resolveVisibleCursorCellPosition } from "./native-projection";
import type { CliShellComposedSurfaceState, CliShellTuiModel } from "./types";

export const buildCliShellComposedSurface = (input: {
  shellTerminalId: string;
  terminalId: string;
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellComposedSurfaceState => {
  const frame = layoutCliShellTuiFrame({
    model: input.model,
    width: input.width,
    height: input.height,
    renderToolbar: true,
  });
  const terminalRegion = resolveCliShellTerminalRegion({
    model: input.model,
    width: input.width,
    height: input.height,
  });
  const productRows = Math.max(1, input.height);
  const cursor = resolveVisibleCursorCellPosition({
    model: input.model,
    width: input.width,
    height: input.height,
  });
  return {
    shellTerminalId: input.shellTerminalId,
    terminalId: input.terminalId,
    shellSnapshotSeq: input.model.terminalView.snapshotSeq,
    cols: Math.max(1, input.width),
    rows: Math.max(1, input.height),
    bottomLine: frame.lines.at(-1) ?? "",
    dialogueOpen: input.model.dialogueOpen,
    dialoguePlacement: input.model.dialoguePlacement,
    dialogueDraft: input.model.dialogueDraft,
    managedLabel: input.model.toolbarManaged,
    unreadLabel: input.model.toolbarUnread,
    heartbeatLabel: input.model.toolbarHeartbeatProjection,
    terminalLines: [...frame.lines],
    terminalRichLines: frame.styledLines.map((line) => ({
      spans: line.spans.map((span) => ({ ...span })),
    })),
    selectionSources: frame.selectionSources.map((source) => ({
      owner: source.owner,
      row: source.row,
      col: source.col,
      width: source.width,
      height: source.height,
      sourceStartRow: source.sourceStartRow,
    })),
    cursor: {
      x: cursor.x,
      y: cursor.y,
      visible: cursor.visible && terminalRegion.width > 0,
    },
    scrollback: {
      viewportOffset: 0,
      totalLines: Math.max(productRows, frame.lines.length),
      screenLines: productRows,
    },
  };
};

export const toProductTerminalComposedSurface = (
  surface: CliShellComposedSurfaceState,
): ProductTerminalComposedSurfaceState => ({
  shellTerminalId: surface.shellTerminalId,
  terminalId: surface.terminalId,
  seq: surface.shellSnapshotSeq,
  cols: surface.cols,
  rows: surface.rows,
  lines: [...surface.terminalLines],
  richLines: surface.terminalRichLines?.map((line) => ({
    spans: line.spans.map((span) => ({ ...span })),
  })),
  selectionSources: surface.selectionSources?.map((source) => ({ ...source })),
  cursor: { ...surface.cursor },
  scrollback: { ...surface.scrollback },
  metadata: {
    cliShellFrame: true,
    composedShellSnapshotSeq: surface.shellSnapshotSeq,
    composedBottomLine: surface.bottomLine,
    composedDialogueOpen: surface.dialogueOpen,
    composedDialoguePlacement: surface.dialoguePlacement,
    composedDialogueDraft: surface.dialogueDraft,
    composedManagedLabel: surface.managedLabel,
    composedUnreadLabel: surface.unreadLabel,
    composedHeartbeatLabel: surface.heartbeatLabel,
  },
});
