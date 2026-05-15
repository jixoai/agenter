import { measureTerminalText } from "./cell-width";
import { splitTerminalTextToWidth } from "./canvas";
import { projectCliShellDialogueBackendFrame } from "./dialogue-backend";
import {
  resolveCliShellTerminalRegion,
  resolveCliShellTranscriptPanelLayout,
  resolveCliShellTuiInteractionLayout,
  type CliShellTerminalRegion,
  type CliShellActionHitRegion,
} from "./frame";
import type { CliShellTuiModel } from "./types";

export interface NativeCursorPosition {
  x: number;
  y: number;
  visible: boolean;
}

export const toNativeHardwareCursorPosition = (cursor: NativeCursorPosition): NativeCursorPosition =>
  cursor.visible
    ? {
        x: cursor.x + 1,
        y: cursor.y + 1,
        visible: true,
      }
    : cursor;

export const resolveShellTerminalOrigin = (input: {
  model: Pick<CliShellTuiModel, "dialoguePlacement">;
  width: number;
  height: number;
}): { x: number; y: number } => {
  const terminalRegion = resolveCliShellTerminalRegion(input);
  return {
    x: input.model.dialoguePlacement === "left" ? Math.max(0, input.width - terminalRegion.width) : 0,
    y: 0,
  };
};

export const resolveShellCursorCellPosition = (input: {
  model: Pick<CliShellTuiModel, "dialoguePlacement" | "terminalView">;
  width: number;
  height: number;
}): NativeCursorPosition => {
  const terminalRegion = resolveCliShellTerminalRegion(input);
  const origin = resolveShellTerminalOrigin(input);
  if (!input.model.terminalView.cursorVisible || terminalRegion.width <= 0 || terminalRegion.height <= 0) {
    return { x: 0, y: 0, visible: false };
  }
  const localX = Math.max(0, Math.min(Math.max(0, terminalRegion.width - 1), input.model.terminalView.cursorCol));
  const cursorRowInBackendViewport = input.model.terminalView.cursorAbsRow - input.model.terminalView.viewportStart;
  const carriesFullScrollback =
    input.model.terminalView.richLines.length >= input.model.terminalView.scrollbackRows;
  const localViewportStart = carriesFullScrollback
    ? 0
    : Math.max(
        0,
        Math.min(
          Math.max(0, input.model.terminalView.richLines.length - terminalRegion.height),
          cursorRowInBackendViewport - terminalRegion.height + 1,
        ),
      );
  const localY = carriesFullScrollback
    ? cursorRowInBackendViewport
    : cursorRowInBackendViewport - localViewportStart;
  if (localY < 0 || localY >= terminalRegion.height) {
    return { x: 0, y: 0, visible: false };
  }
  return {
    x: origin.x + localX,
    y: origin.y + localY,
    visible: true,
  };
};

export const resolveShellCursorPosition = (input: {
  model: Pick<CliShellTuiModel, "dialoguePlacement" | "terminalView">;
  width: number;
  height: number;
}): NativeCursorPosition => toNativeHardwareCursorPosition(resolveShellCursorCellPosition(input));

export const resolveComposedSurfaceCursorCellPosition = (input: {
  x: number;
  y: number;
  visible?: boolean;
  lineCount: number;
}): NativeCursorPosition => {
  const y = Math.trunc(input.y);
  if (input.visible === false || y < 0 || y >= Math.max(0, input.lineCount)) {
    return { x: 0, y: 0, visible: false };
  }
  return {
    x: Math.max(0, Math.trunc(input.x)),
    y,
    visible: true,
  };
};

export const resolveVisibleCursorPosition = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): NativeCursorPosition => {
  return toNativeHardwareCursorPosition(resolveVisibleCursorCellPosition(input));
};

export const resolveVisibleCursorCellPosition = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): NativeCursorPosition => {
  if (input.model.activeFocusTarget === "dialogue") {
    return resolveDialogueCursorCellPosition(input);
  }
  return resolveShellCursorCellPosition(input);
};

export const resolveDialogueInputRegion = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellActionHitRegion | null => {
  const layout = resolveCliShellTranscriptPanelLayout(input);
  if (layout.width <= 0 || layout.height <= 0) {
    return null;
  }
  const promptWidth = 2;
  const sendWidth = measureTerminalText("[Send]");
  const sendGap = 1;
  const contentWidth = Math.max(0, layout.width - 2);
  const draftWidth = Math.max(1, contentWidth - promptWidth - sendWidth - sendGap);
  const draftRows = splitTerminalTextToWidth({
    text: input.model.dialogueDraft.length > 0 ? input.model.dialogueDraft : " ",
    width: draftWidth,
    maxRows: Math.max(1, Math.min(4, layout.height - 4)),
  });
  const startRow = layout.row + Math.max(2, layout.height - 1 - draftRows.length);
  const endRow = layout.row + Math.max(0, layout.height - 2);
  return {
    action: "focusDialogueInput",
    row: startRow,
    col: layout.col + 1 + promptWidth,
    width: Math.max(1, layout.width - 2 - promptWidth - sendWidth - sendGap),
    height: Math.max(1, endRow - startRow + 1),
  };
};

export const resolveDialogueCursorCellPosition = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): NativeCursorPosition => {
  const layout = resolveCliShellTranscriptPanelLayout(input);
  if (!input.model.dialoguePlacement || layout.width <= 0 || layout.height <= 0) {
    return { x: 0, y: 0, visible: false };
  }
  const frame = projectCliShellDialogueBackendFrame({
    layout,
    model: input.model,
  });
  return {
    x: layout.col + frame.cursor.x,
    y: layout.row + frame.cursor.y,
    visible: frame.cursor.visible,
  };
};

export const resolveDialogueCursorPosition = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): NativeCursorPosition => toNativeHardwareCursorPosition(resolveDialogueCursorCellPosition(input));

export const isPointInsideDialoguePanel = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
  x: number;
  y: number;
}): boolean => {
  const layout = resolveCliShellTranscriptPanelLayout(input);
  return (
    layout.width > 0 &&
    layout.height > 0 &&
    input.x >= layout.col &&
    input.x < layout.col + layout.width &&
    input.y >= layout.row &&
    input.y < layout.row + layout.height
  );
};

export const resolveBackendViewportScrollPosition = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): number | null => {
  const layout = resolveCliShellTuiInteractionLayout(input);
  if (!layout.terminalScrollbarRegion) {
    return null;
  }
  const geometry = resolveBackendScrollbarStateGeometry({
    model: input.model,
    terminalRegion: layout.terminalScrollRegion
      ? {
          width: layout.terminalScrollRegion.width,
          height: layout.terminalScrollRegion.height,
        }
      : undefined,
  });
  return Math.max(0, Math.min(geometry.maxPosition, input.model.terminalView.viewportStart));
};

export const resolveBackendScrollbarStateGeometry = (input: {
  model: CliShellTuiModel;
  terminalRegion?: CliShellTerminalRegion;
}): { scrollSize: number; viewportSize: number; maxPosition: number } => {
  const viewportSize = Math.max(
    1,
    Math.min(input.model.terminalView.rows, input.terminalRegion?.height ?? input.model.terminalView.rows),
  );
  const scrollSize = Math.max(viewportSize, input.model.terminalView.scrollbackRows);
  return {
    scrollSize,
    viewportSize,
    maxPosition: Math.max(0, scrollSize - viewportSize),
  };
};
