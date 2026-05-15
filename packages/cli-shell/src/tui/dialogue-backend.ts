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

export class CliShellDialogueBackend {
  project(input: {
    layout: Pick<CliShellTranscriptPanelLayout, "width" | "height">;
    model: CliShellTuiModel;
    renderFocusedDraft?: boolean;
  }): CliShellDialogueBackendFrame {
    return projectCliShellDialogueBackendFrame(input);
  }

  scroll(input: { model: CliShellTuiModel; deltaRows: number }): number {
    const surface = this.project({
      layout: {
        width: Math.max(1, input.model.dialoguePlacement ? 80 : 0),
        height: Math.max(1, input.model.dialoguePlacement ? 24 : 0),
      },
      model: input.model,
    });
    return Math.max(
      0,
      Math.min(surface.viewport.maxOffsetFromBottom, input.model.dialogueScrollOffset + Math.trunc(input.deltaRows)),
    );
  }
}
