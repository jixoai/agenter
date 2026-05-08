import {
  createTerminalCanvas,
  drawCanvasHorizontalLine,
  renderCanvasStyledLines,
  drawCanvasVerticalLine,
  fillCanvasRow,
  renderCanvasLines,
  writeCanvasStyledText,
  writeCanvasText,
  type TerminalCanvasSpan,
  type TerminalCanvasStyledLine,
} from "./canvas";
import { projectTerminalViewport } from "@agenter/termless-core";
import { fitTerminalText, measureTerminalText } from "./cell-width";
import type { CliShellDialogueBlock, CliShellDialoguePlacement, CliShellTuiModel } from "./types";

export interface CliShellTuiFrame {
  lines: string[];
  styledLines: TerminalCanvasStyledLine[];
}

export interface CliShellTerminalRegion {
  width: number;
  height: number;
}

const MIN_SIDE_PANEL_WIDTH = 44;
const MIN_BOTTOM_PANEL_HEIGHT = 10;
const MIN_FLOATING_PANEL_WIDTH = 36;
const MIN_FLOATING_PANEL_HEIGHT = 12;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const buildToolbarLine = (model: CliShellTuiModel, width: number): string => {
  if (width <= 0) {
    return "";
  }

  const separator = " │ ";
  const left = model.toolbarLeft;
  const managed = model.toolbarManaged;
  const unread = model.toolbarUnread;
  const reserved =
    measureTerminalText(left) +
    measureTerminalText(managed) +
    measureTerminalText(unread) +
    measureTerminalText(separator) * 3;

  if (reserved >= width) {
    return fitTerminalText(model.toolbarHeartbeat, width, { ellipsis: true });
  }

  const heartbeatWidth = width - reserved;
  const heartbeat = fitTerminalText(model.toolbarHeartbeat, heartbeatWidth, { ellipsis: true });
  return `${left}${separator}${heartbeat}${separator}${managed}${separator}${unread}`;
};

const wrapTerminalText = (text: string, width: number): string[] => {
  if (width <= 0) {
    return [""];
  }

  const lines: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    for (const char of Array.from(paragraph)) {
      const charWidth = Math.max(1, measureTerminalText(char));
      if (currentWidth + charWidth > width) {
        lines.push(current);
        current = char;
        currentWidth = charWidth;
        continue;
      }
      current += char;
      currentWidth += charWidth;
    }
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
};

const resolveSidePanelWidth = (width: number): number => clamp(Math.floor((width - 1) * 0.37), MIN_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width - 20));

const resolveBottomPanelHeight = (bodyHeight: number): number =>
  clamp(Math.floor(bodyHeight * 0.38), MIN_BOTTOM_PANEL_HEIGHT, Math.max(MIN_BOTTOM_PANEL_HEIGHT, bodyHeight - 8));

const resolveFloatingGeometry = (width: number, bodyHeight: number) => {
  const panelWidth = clamp(Math.floor(width * 0.44), MIN_FLOATING_PANEL_WIDTH, Math.max(MIN_FLOATING_PANEL_WIDTH, width - 4));
  const panelHeight = clamp(
    Math.floor(bodyHeight * 0.58),
    MIN_FLOATING_PANEL_HEIGHT,
    Math.max(MIN_FLOATING_PANEL_HEIGHT, bodyHeight - 2),
  );
  return {
    panelWidth,
    panelHeight,
    col: Math.max(0, Math.floor((width - panelWidth) / 2)),
    row: Math.max(0, Math.floor((bodyHeight - panelHeight) / 2)),
  };
};

export const resolveCliShellTerminalRegion = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellTerminalRegion => {
  const bodyHeight = Math.max(0, input.height - 1);
  const placement = input.model.dialoguePlacement;

  if (bodyHeight <= 0 || input.width <= 0) {
    return {
      width: Math.max(0, input.width),
      height: Math.max(0, bodyHeight),
    };
  }

  if (placement === "left" || placement === "right") {
    const panelWidth = resolveSidePanelWidth(input.width);
    const splitCol = input.width - panelWidth - 1;
    return {
      width: Math.max(0, splitCol),
      height: bodyHeight,
    };
  }

  if (placement === "bottom") {
    const panelHeight = resolveBottomPanelHeight(bodyHeight);
    const splitRow = bodyHeight - panelHeight - 1;
    return {
      width: input.width,
      height: Math.max(0, splitRow),
    };
  }

  return {
    width: input.width,
    height: bodyHeight,
  };
};

const buildDialogueToolbarLine = (title: string, width: number): string => {
  if (width <= 0) {
    return "";
  }
  const left = `L  R  F  B  ${title}`;
  if (measureTerminalText(left) >= width) {
    return fitTerminalText(left, width);
  }
  return `${fitTerminalText(left, Math.max(0, width - 1))}x`;
};

const buildScrollbar = (totalRows: number, visibleRows: number): string[] => {
  if (visibleRows <= 0) {
    return [];
  }
  if (totalRows <= visibleRows) {
    return Array.from({ length: visibleRows }, () => "▒");
  }
  const track = Array.from({ length: visibleRows }, () => "░");
  const thumbSize = Math.max(1, Math.floor((visibleRows * visibleRows) / totalRows));
  const maxStart = Math.max(0, totalRows - visibleRows);
  const start = maxStart;
  const thumbStart = Math.floor((start / maxStart) * Math.max(0, visibleRows - thumbSize));
  for (let index = 0; index < thumbSize; index += 1) {
    track[thumbStart + index] = "█";
  }
  return track;
};

const buildViewportScrollbar = (input: {
  totalRows: number;
  visibleRows: number;
  startRow: number;
}): string[] => {
  if (input.visibleRows <= 0) {
    return [];
  }
  if (input.totalRows <= input.visibleRows) {
    return Array.from({ length: input.visibleRows }, () => "▒");
  }
  const track = Array.from({ length: input.visibleRows }, () => "░");
  const thumbSize = Math.max(1, Math.floor((input.visibleRows * input.visibleRows) / input.totalRows));
  const maxStart = Math.max(1, input.totalRows - input.visibleRows);
  const safeStart = Math.max(0, Math.min(maxStart, input.startRow));
  const thumbStart = Math.floor((safeStart / maxStart) * Math.max(0, input.visibleRows - thumbSize));
  for (let index = 0; index < thumbSize; index += 1) {
    track[thumbStart + index] = "█";
  }
  return track;
};

type DialogueRenderableRow =
  | { kind: "message"; gutter: string; content: string; bg?: string }
  | { kind: "divider"; content: string }
  | { kind: "blank" };

const buildDialogueRows = (blocks: readonly CliShellDialogueBlock[], contentWidth: number): DialogueRenderableRow[] => {
  const rows: DialogueRenderableRow[] = [];
  let previousWasMessage = false;

  for (const block of blocks) {
    if (block.kind === "date-divider") {
      rows.push({
        kind: "divider",
        content: block.dateLabel ?? "",
      });
      previousWasMessage = false;
      continue;
    }

    if (previousWasMessage) {
      rows.push({ kind: "blank" });
    }

    const header = `${block.timeLabel ?? "--:--"} ${block.authorLabel ?? "@agenter"}`;
    rows.push({
      kind: "message",
      gutter: block.authoredByUser ? "> " : "  ",
      content: header,
      bg: block.authoredByUser ? "gray" : undefined,
    });
    for (const line of wrapTerminalText(block.body ?? "", contentWidth)) {
      rows.push({
        kind: "message",
        gutter: "  ",
        content: line,
        bg: block.authoredByUser ? "gray" : undefined,
      });
    }
    previousWasMessage = true;
  }

  return rows.length > 0 ? rows : [{ kind: "blank" }];
};

const renderDialogueList = (input: {
  canvas: ReturnType<typeof createTerminalCanvas>;
  row: number;
  col: number;
  width: number;
  height: number;
  blocks: readonly CliShellDialogueBlock[];
}): void => {
  if (input.width <= 0 || input.height <= 0) {
    return;
  }

  const contentWidth = Math.max(1, input.width - 3);
  const rows = buildDialogueRows(input.blocks, contentWidth);
  const visibleRows = rows.slice(-input.height);
  const scrollbar = buildScrollbar(rows.length, input.height);

  for (let index = 0; index < input.height; index += 1) {
    const targetRow = input.row + index;
    const renderable = visibleRows[index];
    const scrollbarChar = scrollbar[index] ?? "▒";
    if (!renderable) {
      writeCanvasText(input.canvas, {
        row: targetRow,
        col: input.col,
        text: `${" ".repeat(Math.max(0, input.width - 1))}${scrollbarChar}`,
        width: input.width,
      });
      continue;
    }

    if (renderable.kind === "blank") {
      writeCanvasText(input.canvas, {
        row: targetRow,
        col: input.col,
        text: `${" ".repeat(Math.max(0, input.width - 1))}${scrollbarChar}`,
        width: input.width,
      });
      continue;
    }

    if (renderable.kind === "divider") {
      const dividerWidth = Math.max(1, input.width - 1);
      const label = ` ${renderable.content} `;
      const fillWidth = Math.max(0, dividerWidth - measureTerminalText(label));
      const leftWidth = Math.floor(fillWidth / 2);
      const rightWidth = fillWidth - leftWidth;
      writeCanvasText(input.canvas, {
        row: targetRow,
        col: input.col,
        text: `${"─".repeat(leftWidth)}${label}${"─".repeat(rightWidth)}${scrollbarChar}`,
        width: input.width,
      });
      continue;
    }

    const content = fitTerminalText(renderable.content, contentWidth);
    if (renderable.bg) {
      fillCanvasRow(input.canvas, {
        row: targetRow,
        col: input.col,
        width: Math.max(0, input.width - 1),
        bg: renderable.bg,
      });
    }
    writeCanvasText(input.canvas, {
      row: targetRow,
      col: input.col,
      text: `${fitTerminalText(renderable.gutter, 2)}${content}${scrollbarChar}`,
      width: input.width,
      bg: renderable.bg,
    });
  }
};

const renderTerminalRegion = (input: {
  canvas: ReturnType<typeof createTerminalCanvas>;
  row: number;
  col: number;
  width: number;
  height: number;
  model: CliShellTuiModel["terminalView"];
}): void => {
  if (input.width <= 0 || input.height <= 0) {
    return;
  }
  const scrollbarWidth = 1;
  const contentWidth = Math.max(1, input.width - scrollbarWidth);
  const projection = projectTerminalViewport({
    lines: input.model.richLines,
    cursorAbsRow: input.model.cursorAbsRow,
    cursorCol: input.model.cursorCol,
    cursorVisible: input.model.cursorVisible,
    viewportRows: input.height,
  });
  const scrollbar = buildViewportScrollbar({
    totalRows: input.model.scrollbackRows,
    visibleRows: input.height,
    startRow: projection.viewport.start,
  });
  for (let index = 0; index < input.height; index += 1) {
    const targetRow = input.row + index;
    fillCanvasRow(input.canvas, {
      row: targetRow,
      col: input.col,
      width: input.width,
    });
    const line = projection.lines[index];
    if (line) {
      writeCanvasStyledText(input.canvas, {
        row: targetRow,
        col: input.col,
        spans: line.spans.map((span) => ({
          text: span.text,
          fg: span.inverse ? (span.bg ?? "#111111") : span.fg,
          bg: span.inverse ? (span.fg ?? "#f3f6fb") : span.bg,
        })),
        width: contentWidth,
      });
    }
    writeCanvasText(input.canvas, {
      row: targetRow,
      col: input.col + contentWidth,
      text: scrollbar[index] ?? "▒",
      width: scrollbarWidth,
    });
  }
};

const renderDockedDialoguePanel = (input: {
  canvas: ReturnType<typeof createTerminalCanvas>;
  row: number;
  col: number;
  width: number;
  height: number;
  model: CliShellTuiModel;
}): void => {
  if (input.width <= 0 || input.height <= 0) {
    return;
  }

  writeCanvasText(input.canvas, {
    row: input.row,
    col: input.col,
    text: buildDialogueToolbarLine(input.model.dialogueTitle, input.width),
    width: input.width,
  });
  if (input.height >= 2) {
    drawCanvasHorizontalLine(input.canvas, {
      row: input.row + 1,
      col: input.col,
      width: input.width,
    });
  }

  const inputSeparatorRow = Math.max(input.row + 2, input.row + input.height - 3);
  if (input.height >= 4) {
    renderDialogueList({
      canvas: input.canvas,
      row: input.row + 2,
      col: input.col,
      width: input.width,
      height: Math.max(1, inputSeparatorRow - (input.row + 2)),
      blocks: input.model.dialogueBlocks,
    });
    drawCanvasHorizontalLine(input.canvas, {
      row: inputSeparatorRow,
      col: input.col,
      width: input.width,
    });
    fillCanvasRow(input.canvas, {
      row: inputSeparatorRow + 1,
      col: input.col,
      width: input.width,
      bg: "gray",
    });
    writeCanvasText(input.canvas, {
      row: inputSeparatorRow + 1,
      col: input.col,
      text: `${fitTerminalText("> ", 2)}${fitTerminalText(
        `${input.model.dialogueDraft}${input.model.dialogueDraft.length > 0 ? "_" : "_"}`,
        Math.max(1, input.width - 2),
      )}`,
      width: input.width,
      bg: "gray",
    });
  }
};

const renderRightPlacement = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  model: CliShellTuiModel,
  width: number,
  bodyHeight: number,
): void => {
  const panelWidth = resolveSidePanelWidth(width);
  const splitCol = width - panelWidth - 1;
  renderTerminalRegion({
    canvas,
    row: 0,
    col: 0,
    width: splitCol,
    height: bodyHeight,
    model: model.terminalView,
  });
  drawCanvasVerticalLine(canvas, {
    col: splitCol,
    height: bodyHeight,
  });
  renderDockedDialoguePanel({
    canvas,
    row: 0,
    col: splitCol + 1,
    width: panelWidth,
    height: bodyHeight,
    model,
  });
};

const renderLeftPlacement = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  model: CliShellTuiModel,
  width: number,
  bodyHeight: number,
): void => {
  const panelWidth = resolveSidePanelWidth(width);
  const splitCol = panelWidth;
  renderDockedDialoguePanel({
    canvas,
    row: 0,
    col: 0,
    width: panelWidth,
    height: bodyHeight,
    model,
  });
  drawCanvasVerticalLine(canvas, {
    col: splitCol,
    height: bodyHeight,
  });
  renderTerminalRegion({
    canvas,
    row: 0,
    col: splitCol + 1,
    width: Math.max(0, width - splitCol - 1),
    height: bodyHeight,
    model: model.terminalView,
  });
};

const renderBottomPlacement = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  model: CliShellTuiModel,
  width: number,
  bodyHeight: number,
): void => {
  const panelHeight = resolveBottomPanelHeight(bodyHeight);
  const splitRow = bodyHeight - panelHeight - 1;
  renderTerminalRegion({
    canvas,
    row: 0,
    col: 0,
    width,
    height: Math.max(0, splitRow),
    model: model.terminalView,
  });
  drawCanvasHorizontalLine(canvas, {
    row: splitRow,
    width,
  });
  renderDockedDialoguePanel({
    canvas,
    row: splitRow + 1,
    col: 0,
    width,
    height: panelHeight,
    model,
  });
};

const renderFloatingPlacement = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  model: CliShellTuiModel,
  width: number,
  bodyHeight: number,
): void => {
  renderTerminalRegion({
    canvas,
    row: 0,
    col: 0,
    width,
    height: bodyHeight,
    model: model.terminalView,
  });
  const geometry = resolveFloatingGeometry(width, bodyHeight);
  fillCanvasRow(canvas, {
    row: geometry.row,
    col: geometry.col,
    width: geometry.panelWidth,
    char: "─",
  });
  fillCanvasRow(canvas, {
    row: geometry.row + geometry.panelHeight - 1,
    col: geometry.col,
    width: geometry.panelWidth,
    char: "─",
  });
  drawCanvasVerticalLine(canvas, {
    row: geometry.row,
    col: geometry.col,
    height: geometry.panelHeight,
    char: "│",
  });
  drawCanvasVerticalLine(canvas, {
    row: geometry.row,
    col: geometry.col + geometry.panelWidth - 1,
    height: geometry.panelHeight,
    char: "│",
  });
  writeCanvasText(canvas, {
    row: geometry.row,
    col: geometry.col,
    text: `┌${"─".repeat(Math.max(0, geometry.panelWidth - 2))}┐`,
    width: geometry.panelWidth,
  });
  writeCanvasText(canvas, {
    row: geometry.row + geometry.panelHeight - 1,
    col: geometry.col,
    text: `└${"─".repeat(Math.max(0, geometry.panelWidth - 2))}┘`,
    width: geometry.panelWidth,
  });
  renderDockedDialoguePanel({
    canvas,
    row: geometry.row + 1,
    col: geometry.col + 1,
    width: Math.max(1, geometry.panelWidth - 2),
    height: Math.max(1, geometry.panelHeight - 2),
    model,
  });
};

const renderDialoguePlacement = (
  canvas: ReturnType<typeof createTerminalCanvas>,
  model: CliShellTuiModel,
  placement: CliShellDialoguePlacement | null,
  width: number,
  bodyHeight: number,
): void => {
  if (!placement) {
    renderTerminalRegion({
      canvas,
      row: 0,
      col: 0,
      width,
      height: bodyHeight,
      model: model.terminalView,
    });
    return;
  }

  if (placement === "right") {
    renderRightPlacement(canvas, model, width, bodyHeight);
    return;
  }
  if (placement === "left") {
    renderLeftPlacement(canvas, model, width, bodyHeight);
    return;
  }
  if (placement === "bottom") {
    renderBottomPlacement(canvas, model, width, bodyHeight);
    return;
  }
  renderFloatingPlacement(canvas, model, width, bodyHeight);
};

export const layoutCliShellTuiFrame = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellTuiFrame => {
  const canvas = createTerminalCanvas(input.width, input.height);
  const bodyHeight = Math.max(0, input.height - 1);
  renderDialoguePlacement(canvas, input.model, input.model.dialoguePlacement, input.width, bodyHeight);
  if (input.height > 0) {
    writeCanvasText(canvas, {
      row: input.height - 1,
      col: 0,
      text: buildToolbarLine(input.model, input.width),
      width: input.width,
    });
  }
  return {
    lines: renderCanvasLines(canvas),
    styledLines: renderCanvasStyledLines(canvas),
  };
};
