import {
  createTerminalCanvas,
  drawCanvasRectangle,
  renderCanvasLines,
  renderCanvasStyledLines,
  splitTerminalTextToWidth,
  writeCanvasStyledText,
  writeCanvasText,
  type TerminalCanvasStyledLine,
} from "./canvas";
import { measureTerminalText } from "./cell-width";
import type { CliShellActionHitRegion, CliShellTranscriptPanelLayout } from "./frame";
import type { CliShellTuiModel } from "./types";

export interface CliShellDialogueSurface {
  lines: string[];
  styledLines: TerminalCanvasStyledLine[];
  actionRegions: CliShellActionHitRegion[];
  cursor: { x: number; y: number; visible: boolean };
  viewport: {
    offsetFromBottom: number;
    maxOffsetFromBottom: number;
    totalRows: number;
    visibleRows: number;
  };
  chrome: {
    scrollbar: "hidden";
  };
}

const EMPTY_DIALOGUE_VIEWPORT: CliShellDialogueSurface["viewport"] = {
  offsetFromBottom: 0,
  maxOffsetFromBottom: 0,
  totalRows: 0,
  visibleRows: 0,
};

const emptyDialogueSurface = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  actionRegions: CliShellActionHitRegion[],
): CliShellDialogueSurface => ({
  lines: renderCanvasLines(canvas),
  styledLines: renderCanvasStyledLines(canvas),
  actionRegions,
  cursor: { x: 0, y: 0, visible: false },
  viewport: EMPTY_DIALOGUE_VIEWPORT,
  chrome: { scrollbar: "hidden" },
});

const appendStyledChar = (
  spans: TerminalCanvasStyledLine["spans"],
  span: TerminalCanvasStyledLine["spans"][number],
  char: string,
): void => {
  const previous = spans.at(-1);
  if (previous && previous.fg === span.fg && previous.bg === span.bg) {
    previous.text += char;
    return;
  }
  spans.push({
    text: char,
    fg: span.fg,
    bg: span.bg,
  });
};

const wrapDialogueStyledSpans = (
  spans: readonly TerminalCanvasStyledLine["spans"][number][],
  width: number,
): TerminalCanvasStyledLine[] => {
  if (width <= 0) {
    return [];
  }
  const rows: TerminalCanvasStyledLine[] = [];
  let current: TerminalCanvasStyledLine["spans"] = [];
  let currentWidth = 0;
  const pushCurrent = () => {
    rows.push({ spans: current });
    current = [];
    currentWidth = 0;
  };
  for (const span of spans) {
    for (const char of Array.from(span.text)) {
      if (char === "\n") {
        pushCurrent();
        continue;
      }
      const charWidth = Math.max(1, measureTerminalText(char));
      if (charWidth > width) {
        continue;
      }
      if (currentWidth > 0 && currentWidth + charWidth > width) {
        pushCurrent();
      }
      appendStyledChar(current, span, char);
      currentWidth += charWidth;
    }
  }
  if (current.length > 0 || rows.length === 0) {
    pushCurrent();
  }
  return rows;
};

const buildDialogueBodyRows = (input: {
  model: CliShellTuiModel;
  width: number;
}): TerminalCanvasStyledLine[] => {
  const rows: TerminalCanvasStyledLine[] = [];
  for (const block of input.model.dialogueBlocks) {
    if (block.kind === "date-divider") {
      rows.push(
        ...wrapDialogueStyledSpans(
          [
            {
              text: block.dateLabel ?? "",
              fg: "#94a3b8",
            },
          ],
          input.width,
        ),
      );
      continue;
    }
    const prefix = `${block.timeLabel ?? "--:--"} ${block.authorLabel ?? "@agenter"}: `;
    rows.push(
      ...wrapDialogueStyledSpans(
        [
          {
            text: prefix,
            fg: block.authoredByUser ? "#93c5fd" : "#e2e8f0",
          },
          {
            text: block.body ?? "",
            fg: "#e2e8f0",
          },
        ],
        input.width,
      ),
    );
  }
  return rows;
};

export const buildCliShellDialogueSurface = (input: {
  layout: Pick<CliShellTranscriptPanelLayout, "width" | "height">;
  model: CliShellTuiModel;
  renderFocusedDraft?: boolean;
}): CliShellDialogueSurface => {
  const canvas = createTerminalCanvas(input.layout.width, input.layout.height);
  const actionRegions: CliShellActionHitRegion[] = [];
  const { model } = input;
  const width = input.layout.width;
  const height = input.layout.height;

  if (width <= 0 || height <= 0) {
    return emptyDialogueSurface(canvas, actionRegions);
  }

  drawCanvasRectangle(canvas, {
    row: 0,
    col: 0,
    width,
    height,
    borderColor: model.dialogueOpen ? "#4fd1c5" : "#64748b",
    fillColor: "#111827",
    fillChar: " ",
  });

  if (height < 4 || width < 6) {
    return emptyDialogueSurface(canvas, actionRegions);
  }

  const title = "layout";
  writeCanvasText(canvas, {
    row: 0,
    col: Math.min(1, width - 2),
    text: title,
    width: Math.max(0, width - 4),
    fg: "#93c5fd",
  });

  let headerCol = Math.min(1 + measureTerminalText(title) + 1, width - 2);
  for (const control of [
    { label: "M-L", action: "placeLeft" as const },
    { label: "M-R", action: "placeRight" as const },
    { label: "M-F", action: "placeFloating" as const },
  ]) {
    if (headerCol >= width - 2) {
      break;
    }
    writeCanvasText(canvas, {
      row: 0,
      col: headerCol,
      text: control.label,
      width: Math.max(0, width - headerCol - 1),
      fg: "#f8fafc",
    });
    actionRegions.push({
      action: control.action,
      row: 0,
      col: headerCol,
      width: measureTerminalText(control.label),
      height: 1,
    });
    headerCol += measureTerminalText(control.label) + 1;
  }

  const placementText = `│ ${model.dialoguePlacement ?? "floating"}`;
  if (headerCol < width - 4) {
    writeCanvasText(canvas, {
      row: 0,
      col: headerCol,
      text: placementText,
      width: Math.max(0, width - headerCol - 2),
      fg: "#94a3b8",
    });
  }

  const closeCol = Math.max(1, width - 2);
  writeCanvasText(canvas, {
    row: 0,
    col: closeCol,
    text: "x",
    width: 1,
    fg: "#f8fafc",
  });
  actionRegions.push({
    action: "closeDialogue",
    row: 0,
    col: closeCol,
    width: 1,
    height: 1,
  });

  const contentWidth = Math.max(0, width - 2);
  const bodyStartRow = 2;
  const sendLabel = "[Send]";
  const sendWidth = measureTerminalText(sendLabel);
  const prompt = "> ";
  const promptWidth = measureTerminalText(prompt);
  const draftWidth = Math.max(1, contentWidth - promptWidth - sendWidth - 1);
  const draftRows = splitTerminalTextToWidth({
    text: model.dialogueDraft.length > 0 ? model.dialogueDraft : " ",
    width: draftWidth,
    maxRows: Math.max(1, Math.min(4, height - 4)),
  });
  const inputStartRow = Math.max(bodyStartRow, height - 1 - draftRows.length);
  const inputEndRow = height - 2;
  const bodyRows = Math.max(0, inputStartRow - bodyStartRow);
  const bodyProjectionRows = buildDialogueBodyRows({
    model,
    width: contentWidth,
  });
  const maxScrollOffset = Math.max(0, bodyProjectionRows.length - bodyRows);
  const scrollOffset = Math.max(0, Math.min(maxScrollOffset, Math.trunc(model.dialogueScrollOffset)));
  const bodyStartIndex = Math.max(0, bodyProjectionRows.length - bodyRows - scrollOffset);
  const visibleBodyRows = bodyRows > 0 ? bodyProjectionRows.slice(bodyStartIndex, bodyStartIndex + bodyRows) : [];
  for (const [bodyRowIndex, bodyLine] of visibleBodyRows.entries()) {
    writeCanvasStyledText(canvas, {
      row: bodyStartRow + bodyRowIndex,
      col: 1,
      spans: bodyLine.spans,
      width: contentWidth,
    });
  }

  const shouldRenderDraft = input.renderFocusedDraft ?? true;
  for (const [draftRowIndex, draftText] of draftRows.entries()) {
    const draftRow = inputStartRow + draftRowIndex;
    if (draftRow > inputEndRow) {
      break;
    }
    writeCanvasStyledText(canvas, {
      row: draftRow,
      col: 1,
      spans: [
        {
          text: draftRowIndex === 0 ? prompt : " ".repeat(promptWidth),
          fg: model.dialogueOpen ? "#94a3b8" : "#64748b",
        },
        {
          text: shouldRenderDraft ? draftText : " ",
          fg: model.dialogueOpen ? "#f8fafc" : "#94a3b8",
        },
      ],
      width: Math.max(0, contentWidth - sendWidth - 1),
    });
  }
  actionRegions.push({
    action: "focusDialogueInput",
    row: inputStartRow,
    col: 1,
    width: Math.max(1, contentWidth),
    height: Math.max(1, inputEndRow - inputStartRow + 1),
  });

  const sendCol = Math.max(1, width - sendWidth - 1);
  writeCanvasText(canvas, {
    row: inputEndRow,
    col: sendCol,
    text: sendLabel,
    width: sendWidth,
    fg: "#111111",
    bg: model.activeFocusTarget === "dialogue" ? "#67e8f9" : "#94a3b8",
  });
  actionRegions.push({
    action: "submitDialogue",
    row: inputEndRow,
    col: sendCol,
    width: sendWidth,
    height: 1,
  });

  const lastDraftRow = Math.max(0, Math.min(draftRows.length - 1, inputEndRow - inputStartRow));
  const cursorCol = Math.min(draftWidth - 1, measureTerminalText(draftRows[lastDraftRow] ?? ""));

  return {
    lines: renderCanvasLines(canvas),
    styledLines: renderCanvasStyledLines(canvas),
    actionRegions,
    cursor: {
      x: 1 + promptWidth + cursorCol,
      y: inputStartRow + lastDraftRow,
      visible: model.activeFocusTarget === "dialogue" && model.dialoguePlacement !== null,
    },
    viewport: {
      offsetFromBottom: scrollOffset,
      maxOffsetFromBottom: maxScrollOffset,
      totalRows: bodyProjectionRows.length,
      visibleRows: visibleBodyRows.length,
    },
    chrome: { scrollbar: "hidden" },
  };
};
