import {
  createTerminalCanvas,
  drawCanvasHorizontalLine,
  drawCanvasVerticalLine,
  fillCanvasRow,
  renderCanvasLines,
  renderCanvasStyledLines,
  splitTerminalTextToWidth,
  writeCanvasStyledText,
  writeCanvasText,
  type TerminalCanvasStyledLine,
} from "./canvas";
import { measureTerminalText } from "./cell-width";
import {
  CliShellDialogueScrollBoxController,
  resolveCliShellDialogueScrollMetrics,
  type CliShellDialogueScrollMetrics,
  type CliShellDialogueScrollRow,
  type CliShellDialogueScrollSnapshot,
} from "./dialogue-scrollbox";
import type { CliShellActionHitRegion, CliShellTranscriptPanelLayout } from "./frame";
import type { CliShellTuiModel } from "./types";

export interface CliShellDialogueSurface {
  lines: string[];
  styledLines: TerminalCanvasStyledLine[];
  actionRegions: CliShellActionHitRegion[];
  cursor: { x: number; y: number; visible: boolean };
  viewport: {
    scrollTop: number;
    maxScrollTop: number;
    totalRows: number;
    visibleRows: number;
    nearTop: boolean;
    pinnedToBottom: boolean;
  };
  chrome: {
    scrollbar: "visible" | "hidden";
  };
}

export interface CliShellDialogueViewportOwner {
  sync(input: {
    width: number;
    height: number;
    rows: readonly CliShellDialogueScrollRow[];
    scrollTop: number;
  }): CliShellDialogueScrollSnapshot;
}

export const createCliShellDialogueViewportOwner = (
  ctx: ConstructorParameters<typeof CliShellDialogueScrollBoxController>[0],
  options: ConstructorParameters<typeof CliShellDialogueScrollBoxController>[1],
): CliShellDialogueViewportOwner => new CliShellDialogueScrollBoxController(ctx, options);

const EMPTY_DIALOGUE_VIEWPORT: CliShellDialogueSurface["viewport"] = {
  scrollTop: 0,
  maxScrollTop: 0,
  totalRows: 0,
  visibleRows: 0,
  nearTop: true,
  pinnedToBottom: true,
};

const PANEL_BG = "#101820";
const USER_MESSAGE_BG = "#1f2937";
const TEXT_FG = "#e5e7eb";
const MUTED_FG = "#94a3b8";
const ACCENT_FG = "#93c5fd";
const TRACK_FG = "#334155";
const THUMB_FG = "#cbd5e1";

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

export const buildCliShellDialogueScrollRows = (input: {
  model: CliShellTuiModel;
  width: number;
}): Array<{ key: string; height: number; line: TerminalCanvasStyledLine }> => {
  const rows: Array<{ key: string; height: number; line: TerminalCanvasStyledLine }> = [];
  for (const block of input.model.dialogueBlocks) {
    const blockKey =
      block.key ??
      (block.kind === "message" && typeof block.messageId === "number"
        ? `message:${block.messageId}`
        : `${block.kind}:${rows.length}`);
    const before = rows.length;
    if (block.kind === "date-divider") {
      rows.push(
        ...wrapDialogueStyledSpans(
          [
            {
              text: `──────── ${block.dateLabel ?? ""} ────────`,
              fg: MUTED_FG,
            },
          ],
          input.width,
        ).map((line) => ({ key: blockKey, height: 1, line })),
      );
    } else {
      const prefix = block.authoredByUser ? ">  " : `${block.authorLabel ?? "@agenter"}\n`;
      rows.push(
        ...wrapDialogueStyledSpans(
          [
            {
              text: prefix,
              fg: block.authoredByUser ? "#d1d5db" : MUTED_FG,
              bg: block.authoredByUser ? USER_MESSAGE_BG : undefined,
            },
            {
              text: block.body ?? "",
              fg: TEXT_FG,
              bg: block.authoredByUser ? USER_MESSAGE_BG : undefined,
            },
          ],
          input.width,
        ).map((line) => ({ key: blockKey, height: 1, line })),
      );
      rows.push({ key: `${blockKey}:spacer`, height: 1, line: { spans: [] } });
    }
    for (let index = before; index < rows.length; index += 1) {
      rows[index] = {
        ...rows[index]!,
        key: rows[index]!.key === blockKey ? `${blockKey}:row-${index - before}` : rows[index]!.key,
      };
    }
  }
  return rows;
};

const renderPanelBackground = (canvas: ReturnType<typeof createTerminalCanvas>): void => {
  for (let row = 0; row < canvas.height; row += 1) {
    fillCanvasRow(canvas, {
      row,
      col: 0,
      width: canvas.width,
      bg: PANEL_BG,
    });
  }
};

// Terminal-2 still needs cell rows. This draws a projection of the OpenTUI
// ScrollBox state; it is not the accepted Chat interaction owner.
const renderDialogueScrollbar = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  input: {
    row: number;
    col: number;
    height: number;
    totalRows: number;
    visibleRows: number;
    scrollTop: number;
  },
): void => {
  if (input.col < 0 || input.height <= 0) {
    return;
  }
  drawCanvasVerticalLine(canvas, {
    row: input.row,
    col: input.col,
    height: input.height,
    char: "░",
    fg: TRACK_FG,
    bg: PANEL_BG,
  });
  const viewportSize = Math.max(1, Math.min(input.visibleRows, input.height));
  const scrollSize = Math.max(viewportSize, input.totalRows);
  const maxOffset = Math.max(0, scrollSize - viewportSize);
  const thumbSize =
    maxOffset === 0
      ? input.height
      : Math.max(1, Math.min(input.height, Math.ceil((viewportSize / scrollSize) * input.height)));
  const movableRows = Math.max(0, input.height - thumbSize);
  const scrollFromTop = Math.max(0, Math.min(maxOffset, input.scrollTop));
  const thumbStart =
    maxOffset === 0 || movableRows === 0
      ? 0
      : Math.max(0, Math.min(movableRows, Math.round((scrollFromTop / maxOffset) * movableRows)));
  drawCanvasVerticalLine(canvas, {
    row: input.row + thumbStart,
    col: input.col,
    height: thumbSize,
    char: "█",
    fg: THUMB_FG,
    bg: PANEL_BG,
  });
};

const resolveDialogueViewportMetrics = (input: {
  owner?: CliShellDialogueViewportOwner;
  rows: readonly CliShellDialogueScrollRow[];
  width: number;
  height: number;
  scrollTop: number;
}): CliShellDialogueScrollMetrics => {
  if (input.owner) {
    const snapshot = input.owner.sync({
      width: input.width,
      height: input.height,
      rows: input.rows,
      scrollTop: input.scrollTop,
    });
    return resolveCliShellDialogueScrollMetrics({
      scrollTop: snapshot.scrollTop,
      viewportHeight: snapshot.viewportHeight,
      scrollHeight: snapshot.scrollHeight,
    });
  }
  return resolveCliShellDialogueScrollMetrics({
    scrollTop: input.scrollTop,
    viewportHeight: input.height,
    scrollHeight: input.rows.length,
  });
};

export const buildCliShellDialogueSurface = (input: {
  layout: Pick<CliShellTranscriptPanelLayout, "width" | "height">;
  model: CliShellTuiModel;
  renderFocusedDraft?: boolean;
  viewportOwner?: CliShellDialogueViewportOwner;
}): CliShellDialogueSurface => {
  const canvas = createTerminalCanvas(input.layout.width, input.layout.height);
  const actionRegions: CliShellActionHitRegion[] = [];
  const { model } = input;
  const width = input.layout.width;
  const height = input.layout.height;

  if (width <= 0 || height <= 0) {
    return emptyDialogueSurface(canvas, actionRegions);
  }

  renderPanelBackground(canvas);
  if (height < 4 || width < 6) {
    return emptyDialogueSurface(canvas, actionRegions);
  }

  const title = model.dialogueTitle || "Chat";
  const closeCol = Math.max(0, width - 2);
  const toolbarControls = [
    { label: "←", action: "placeLeft" as const },
    { label: "→", action: "placeRight" as const },
    { label: "◇", action: "placeFloating" as const },
    { label: "▾", action: "placeCover" as const },
  ];
  let headerCol = 1;
  for (const control of toolbarControls) {
    if (headerCol >= Math.max(1, width - 8)) {
      break;
    }
    writeCanvasText(canvas, {
      row: 0,
      col: headerCol,
      text: control.label,
      width: 1,
      fg: "#cbd5e1",
      bg: PANEL_BG,
    });
    actionRegions.push({
      action: control.action,
      row: 0,
      col: headerCol,
      width: 1,
      height: 1,
    });
    headerCol += 3;
  }
  const titleWidth = measureTerminalText(title);
  writeCanvasText(canvas, {
    row: 0,
    col: Math.max(headerCol, Math.floor((width - titleWidth) / 2)),
    text: title,
    width: Math.max(0, closeCol - Math.max(headerCol, Math.floor((width - titleWidth) / 2)) - 1),
    fg: ACCENT_FG,
    bg: PANEL_BG,
  });
  writeCanvasText(canvas, {
    row: 0,
    col: closeCol,
    text: "×",
    width: 1,
    fg: "#f8fafc",
    bg: PANEL_BG,
  });
  actionRegions.push({
    action: "closeDialogue",
    row: 0,
    col: closeCol,
    width: 1,
    height: 1,
  });

  const prompt = "> ";
  const promptWidth = measureTerminalText(prompt);
  const gutterWidth = 2;
  const scrollbarCol = Math.max(0, width - 1);
  const contentCol = gutterWidth;
  const contentWidth = Math.max(1, width - gutterWidth - 2);
  const draftRows = splitTerminalTextToWidth({
    text: model.dialogueDraft.length > 0 ? model.dialogueDraft : " ",
    width: Math.max(1, contentWidth - promptWidth),
    maxRows: Math.max(1, Math.min(4, height - 4)),
  });
  const inputStartRow = Math.max(2, height - draftRows.length);
  const inputEndRow = height - 1;
  const bodyStartRow = 2;
  const bodyRows = Math.max(0, inputStartRow - bodyStartRow - 1);
  const bodyProjectionRows = buildCliShellDialogueScrollRows({
    model,
    width: contentWidth,
  });
  const metrics = resolveDialogueViewportMetrics({
    owner: input.viewportOwner,
    rows: bodyProjectionRows,
    width: contentWidth,
    height: Math.max(1, bodyRows),
    scrollTop: model.dialogueScroll.scrollTop,
  });
  const bodyStartIndex = metrics.scrollTop;
  const visibleBodyRows = bodyRows > 0 ? bodyProjectionRows.slice(bodyStartIndex, bodyStartIndex + bodyRows) : [];

  for (const [bodyRowIndex, bodyLine] of visibleBodyRows.entries()) {
    writeCanvasStyledText(canvas, {
      row: bodyStartRow + bodyRowIndex,
      col: contentCol,
      spans: bodyLine.line.spans,
      width: contentWidth,
    });
  }

  renderDialogueScrollbar(canvas, {
    row: bodyStartRow,
    col: scrollbarCol,
    height: Math.max(1, inputStartRow - bodyStartRow - 1),
    totalRows: bodyProjectionRows.length,
    visibleRows: Math.max(1, bodyRows),
    scrollTop: metrics.scrollTop,
  });

  if (!metrics.pinnedToBottom && width >= 8 && bodyRows > 0) {
    const stickLabel = `↓ ${Math.min(99, Math.max(1, model.dialogueScroll.pendingNewMessageCount || metrics.maxScrollTop - metrics.scrollTop))}`;
    const stickWidth = measureTerminalText(stickLabel);
    const stickRow = Math.min(inputStartRow - 2, Math.max(bodyStartRow, inputStartRow - 5));
    const stickCol = Math.max(contentCol, width - stickWidth - 3);
    writeCanvasText(canvas, {
      row: stickRow,
      col: stickCol,
      text: stickLabel,
      width: stickWidth,
      fg: "#f8fafc",
      bg: "#334155",
    });
    actionRegions.push({
      action: "stickDialogueToBottom",
      row: stickRow,
      col: stickCol,
      width: stickWidth,
      height: 1,
    });
  }

  drawCanvasHorizontalLine(canvas, {
    row: Math.max(1, inputStartRow - 1),
    col: 0,
    width,
    char: "─",
    fg: TRACK_FG,
    bg: PANEL_BG,
  });

  const shouldRenderDraft = input.renderFocusedDraft ?? true;
  for (const [draftRowIndex, draftText] of draftRows.entries()) {
    const draftRow = inputStartRow + draftRowIndex;
    if (draftRow > inputEndRow) {
      break;
    }
    writeCanvasStyledText(canvas, {
      row: draftRow,
      col: contentCol,
      spans: [
        {
          text: draftRowIndex === 0 ? prompt : " ".repeat(promptWidth),
          fg: model.dialogueOpen ? MUTED_FG : "#64748b",
          bg: PANEL_BG,
        },
        {
          text: shouldRenderDraft ? draftText : " ",
          fg: model.dialogueOpen ? "#f8fafc" : MUTED_FG,
          bg: PANEL_BG,
        },
      ],
      width: Math.max(0, contentWidth),
    });
  }
  actionRegions.push({
    action: "focusDialogueInput",
    row: inputStartRow,
    col: contentCol,
    width: Math.max(1, contentWidth),
    height: Math.max(1, inputEndRow - inputStartRow + 1),
  });
  actionRegions.push({
    action: "submitDialogue",
    row: inputEndRow,
    col: contentCol,
    width: Math.max(1, contentWidth),
    height: 1,
  });

  const lastDraftRow = Math.max(0, Math.min(draftRows.length - 1, inputEndRow - inputStartRow));
  const cursorCol = Math.min(
    Math.max(0, contentWidth - promptWidth - 1),
    measureTerminalText(draftRows[lastDraftRow] ?? ""),
  );

  return {
    lines: renderCanvasLines(canvas),
    styledLines: renderCanvasStyledLines(canvas),
    actionRegions,
    cursor: {
      x: contentCol + promptWidth + cursorCol,
      y: inputStartRow + lastDraftRow,
      visible: model.activeFocusTarget === "dialogue" && model.dialoguePlacement !== null,
    },
    viewport: {
      scrollTop: metrics.scrollTop,
      maxScrollTop: metrics.maxScrollTop,
      totalRows: bodyProjectionRows.length,
      visibleRows: visibleBodyRows.length,
      nearTop: metrics.nearTop,
      pinnedToBottom: metrics.pinnedToBottom,
    },
    chrome: { scrollbar: "visible" },
  };
};
