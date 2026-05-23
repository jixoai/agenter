import { projectTerminalViewport } from "@agenter/termless-core";
import {
  createTerminalCanvas,
  drawCanvasVerticalLine,
  fillCanvasRow,
  renderCanvasLines,
  renderCanvasStyledLines,
  writeCanvasStyledText,
  writeCanvasText,
  type TerminalCanvasStyledLine,
} from "./canvas";
import { fitTerminalText, measureTerminalText } from "./cell-width";
import { projectCliShellDialogueBackendFrame } from "./dialogue-backend";
import type { CliShellDialogueViewportOwner } from "./dialogue-surface";
import type {
  CliShellScrollRegion,
  CliShellSelectionRegion,
  CliShellSelectionSource,
  CliShellTuiInteractionLayout,
  CliShellTuiModel,
} from "./types";

export interface CliShellTuiFrame {
  lines: string[];
  styledLines: TerminalCanvasStyledLine[];
  actionRegions: CliShellActionHitRegion[];
  selectionSources: CliShellSelectionSource[];
}

export interface CliShellToolbarItem {
  id: string;
  text: string;
  col: number;
  width: number;
}

export interface CliShellTerminalRegion {
  width: number;
  height: number;
}

export interface CliShellShellScrollbarFrameState {
  scrollSize: number;
  viewportSize: number;
  scrollPosition: number;
  maxPosition: number;
  thumbStart: number;
  thumbSize: number;
}

export interface CliShellShellScrollbarProjection {
  region: CliShellScrollRegion;
  state: CliShellShellScrollbarFrameState;
}

export interface CliShellTranscriptPanelLayout {
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface CliShellActionHitRegion {
  action:
    | "toggleManaged"
    | "openDialogue"
    | "closeDialogue"
    | "focusDialogueInput"
    | "submitDialogue"
    | "placeLeft"
    | "placeRight"
    | "placeFloating"
    | "placeCover"
    | "stickDialogueToBottom";
  row: number;
  col: number;
  width: number;
  height: number;
}

const MIN_SIDE_PANEL_WIDTH = 44;
const MIN_FLOATING_PANEL_WIDTH = 36;
const MIN_FLOATING_PANEL_HEIGHT = 12;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const buildToolbarLine = (model: CliShellTuiModel, width: number): string => {
  if (width <= 0) {
    return "";
  }

  const separator = "  ";
  const left = model.toolbarLeft;
  const managed = model.toolbarManaged;
  const unread = model.toolbarUnread;
  const heartbeatSource = model.toolbarHeartbeatProjection;
  const reserved =
    measureTerminalText(left) +
    measureTerminalText(managed) +
    measureTerminalText(unread) +
    measureTerminalText(separator) * 3;

  if (reserved >= width) {
    return fitTerminalText(heartbeatSource, width, { ellipsis: true });
  }

  const heartbeatWidth = Math.max(0, width - reserved);
  const heartbeat = fitTerminalText(heartbeatSource, heartbeatWidth, { ellipsis: true });
  return `${left}${separator}${heartbeat}${separator}${managed}${separator}${unread}`;
};

export const resolveCliShellToolbarLayout = (
  model: CliShellTuiModel,
  width: number,
): { line: string; items: CliShellToolbarItem[] } => {
  if (width <= 0) {
    return {
      line: "",
      items: [],
    };
  }

  const separator = "  ";
  const left = model.toolbarLeft;
  const managed = model.toolbarManaged;
  const unread = model.toolbarUnread;
  const reserved =
    measureTerminalText(left) +
    measureTerminalText(managed) +
    measureTerminalText(unread) +
    measureTerminalText(separator) * 3;

  if (reserved >= width) {
    const heartbeat = fitTerminalText(model.toolbarHeartbeatProjection, width, { ellipsis: true });
    return {
      line: heartbeat,
      items: [
        {
          id: "heartbeat",
          text: heartbeat,
          col: 0,
          width: measureTerminalText(heartbeat),
        },
      ],
    };
  }

  const heartbeatWidth = Math.max(0, width - reserved);
  const heartbeat = fitTerminalText(model.toolbarHeartbeatProjection, heartbeatWidth, { ellipsis: true });
  const items: CliShellToolbarItem[] = [];
  let col = 0;
  for (const item of [
    { id: "left", text: left },
    { id: "sep-1", text: separator },
    { id: "heartbeat", text: heartbeat },
    { id: "sep-2", text: separator },
    { id: "managed", text: managed },
    { id: "sep-3", text: separator },
    { id: "unread", text: unread },
  ]) {
    const itemWidth = measureTerminalText(item.text);
    items.push({
      ...item,
      col,
      width: itemWidth,
    });
    col += itemWidth;
  }

  return {
    line: `${left}${separator}${heartbeat}${separator}${managed}${separator}${unread}`,
    items,
  };
};
const resolveSidePanelWidth = (width: number): number =>
  clamp(Math.floor((width - 1) * 0.37), MIN_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, width - 20));

const resolveFloatingGeometry = (width: number, bodyHeight: number) => {
  const panelWidth = clamp(
    Math.floor(width * 0.44),
    MIN_FLOATING_PANEL_WIDTH,
    Math.max(MIN_FLOATING_PANEL_WIDTH, width - 4),
  );
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
  model: Pick<CliShellTuiModel, "dialoguePlacement">;
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
    const splitCol = input.width - panelWidth - 2;
    return {
      width: Math.max(0, splitCol),
      height: bodyHeight,
    };
  }
  if (placement === "cover") {
    return {
      width: input.width,
      height: bodyHeight,
    };
  }

  return {
    width: input.width,
    height: bodyHeight,
  };
};

export const resolveCliShellTranscriptPanelLayout = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellTranscriptPanelLayout => {
  const bodyHeight = Math.max(0, input.height - 1);
  if (!input.model.dialoguePlacement || input.width <= 0 || bodyHeight <= 0) {
    return {
      row: 0,
      col: 0,
      width: 0,
      height: 0,
    };
  }

  if (input.model.dialoguePlacement === "left") {
    return {
      row: 0,
      col: 0,
      width: resolveSidePanelWidth(input.width),
      height: bodyHeight,
    };
  }

  if (input.model.dialoguePlacement === "right") {
    const panelWidth = resolveSidePanelWidth(input.width);
    return {
      row: 0,
      col: Math.max(0, input.width - panelWidth),
      width: panelWidth,
      height: bodyHeight,
    };
  }
  if (input.model.dialoguePlacement === "cover") {
    return {
      row: 0,
      col: 0,
      width: input.width,
      height: bodyHeight,
    };
  }

  const geometry = resolveFloatingGeometry(input.width, bodyHeight);
  return {
    row: geometry.row,
    col: geometry.col,
    width: geometry.panelWidth,
    height: geometry.panelHeight,
  };
};

export const resolveCliShellTerminalScrollRegion = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellScrollRegion | null => {
  const terminal = resolveCliShellTerminalRegion(input);
  if (terminal.width <= 1 || terminal.height <= 0) {
    return null;
  }
  const placement = input.model.dialoguePlacement;
  if (placement === "cover") {
    return null;
  }
  if (placement === "left") {
    const panelWidth = resolveSidePanelWidth(input.width);
    return {
      row: 0,
      col: panelWidth + 2,
      width: terminal.width,
      height: terminal.height,
    };
  }
  if (placement === "right") {
    return {
      row: 0,
      col: 0,
      width: terminal.width,
      height: terminal.height,
    };
  }
  return {
    row: 0,
    col: 0,
    width: Math.max(1, terminal.width - 1),
    height: terminal.height,
  };
};

export const resolveCliShellTerminalScrollbarRegion = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellScrollRegion | null => {
  const terminal = resolveCliShellTerminalRegion(input);
  if (terminal.width <= 0 || terminal.height <= 0) {
    return null;
  }
  const placement = input.model.dialoguePlacement;
  if (placement === "cover") {
    return null;
  }
  if (placement === "left") {
    const panelWidth = resolveSidePanelWidth(input.width);
    return {
      row: 0,
      col: panelWidth + 1,
      width: 1,
      height: terminal.height,
    };
  }
  if (placement === "right") {
    return {
      row: 0,
      col: terminal.width + 1,
      width: 1,
      height: terminal.height,
    };
  }
  return {
    row: 0,
    col: Math.max(0, terminal.width - 1),
    width: 1,
    height: terminal.height,
  };
};

export const resolveCliShellShellScrollbarProjection = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellShellScrollbarProjection | null => {
  const region = resolveCliShellTerminalScrollbarRegion(input);
  const scrollRegion = resolveCliShellTerminalScrollRegion(input);
  if (!region || !scrollRegion || region.height <= 0) {
    return null;
  }
  const viewportSize = Math.max(1, Math.min(input.model.terminalView.rows, scrollRegion.height));
  const scrollSize = Math.max(viewportSize, input.model.terminalView.scrollbackRows);
  const maxPosition = Math.max(0, scrollSize - viewportSize);
  const scrollPosition = Math.max(0, Math.min(maxPosition, Math.trunc(input.model.terminalView.viewportStart)));
  const thumbSize =
    maxPosition === 0
      ? region.height
      : Math.max(1, Math.min(region.height, Math.ceil((viewportSize / scrollSize) * region.height)));
  const movableRows = Math.max(0, region.height - thumbSize);
  const thumbStart =
    maxPosition === 0 || movableRows === 0
      ? 0
      : Math.max(0, Math.min(movableRows, Math.round((scrollPosition / maxPosition) * movableRows)));
  return {
    region,
    state: {
      scrollSize,
      viewportSize,
      scrollPosition,
      maxPosition,
      thumbStart,
      thumbSize,
    },
  };
};

export const resolveCliShellScrollbarPointerTarget = (input: {
  projection: CliShellShellScrollbarProjection;
  row: number;
}): number => {
  const { region, state } = input.projection;
  if (state.maxPosition <= 0 || region.height <= 1) {
    return 0;
  }
  const localRow = Math.max(0, Math.min(region.height - 1, Math.trunc(input.row - region.row)));
  const movableRows = Math.max(1, region.height - state.thumbSize);
  const centeredRow = Math.max(0, Math.min(movableRows, localRow - Math.floor(state.thumbSize / 2)));
  return Math.max(0, Math.min(state.maxPosition, Math.round((centeredRow / movableRows) * state.maxPosition)));
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
  const carriesFullScrollback = input.model.richLines.length >= input.model.scrollbackRows;
  const projection = carriesFullScrollback
    ? projectTerminalViewport({
        lines: input.model.richLines,
        cursorAbsRow: input.model.cursorAbsRow,
        cursorCol: input.model.cursorCol,
        cursorVisible: false,
        viewportRows: input.height,
        viewportStart: input.model.viewportStart,
      })
    : {
        lines: input.model.richLines.slice(0, input.height).map((line) => ({
          spans: line.spans.map((span) => ({ ...span })),
        })),
      };
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
        width: input.width,
      });
    }
  }
};

const renderShellScrollbar = (input: {
  canvas: ReturnType<typeof createTerminalCanvas>;
  projection: CliShellShellScrollbarProjection | null;
}): void => {
  const projection = input.projection;
  if (!projection || projection.region.height <= 0 || projection.region.width <= 0) {
    return;
  }
  drawCanvasVerticalLine(input.canvas, {
    row: projection.region.row,
    col: projection.region.col,
    height: projection.region.height,
    char: "░",
    fg: "#334155",
  });
  const thumbStart = projection.region.row + projection.state.thumbStart;
  drawCanvasVerticalLine(input.canvas, {
    row: thumbStart,
    col: projection.region.col,
    height: projection.state.thumbSize,
    char: "█",
    fg: "#94a3b8",
  });
};

export const layoutCliShellTuiFrame = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
  renderToolbar?: boolean;
  dialogueViewportOwner?: CliShellDialogueViewportOwner;
}): CliShellTuiFrame => {
  const canvas = createTerminalCanvas(input.width, input.height);
  const actionRegions: CliShellActionHitRegion[] = [];
  const selectionSources: CliShellSelectionSource[] = [];
  const renderToolbar = input.renderToolbar ?? true;
  const bodyHeight = Math.max(0, renderToolbar ? input.height - 1 : input.height);
  const terminalRegion = resolveCliShellTerminalRegion(input);
  const terminalCol = input.model.dialoguePlacement === "left" ? Math.max(0, input.width - terminalRegion.width) : 0;
  const terminalScrollRegion = resolveCliShellTerminalScrollRegion(input);
  renderTerminalRegion({
    canvas,
    row: terminalScrollRegion?.row ?? 0,
    col: terminalScrollRegion?.col ?? terminalCol,
    width: terminalScrollRegion?.width ?? terminalRegion.width,
    height: terminalScrollRegion?.height ?? bodyHeight,
    model: input.model.terminalView,
  });
  if (terminalScrollRegion) {
    const carriesFullScrollback = input.model.terminalView.richLines.length >= input.model.terminalView.scrollbackRows;
    const terminalProjection = carriesFullScrollback
      ? projectTerminalViewport({
          lines: input.model.terminalView.richLines,
          cursorAbsRow: input.model.terminalView.cursorAbsRow,
          cursorCol: input.model.terminalView.cursorCol,
          cursorVisible: false,
          viewportRows: terminalScrollRegion.height,
          viewportStart: input.model.terminalView.viewportStart,
        })
      : {
          lines: input.model.terminalView.richLines.slice(0, terminalScrollRegion.height).map((line) => ({
            spans: line.spans.map((span) => ({ ...span })),
          })),
          viewport: {
            start: 0,
          },
        };
    selectionSources.push({
      owner: "terminal",
      ...terminalScrollRegion,
      lines: terminalProjection.lines,
      sourceStartRow: carriesFullScrollback
        ? terminalProjection.viewport.start
        : input.model.terminalView.viewportStart + terminalProjection.viewport.start,
    });
  }
  renderShellScrollbar({
    canvas,
    projection: resolveCliShellShellScrollbarProjection(input),
  });
  if (input.model.dialoguePlacement) {
    const layout = resolveCliShellTranscriptPanelLayout({
      model: input.model,
      width: input.width,
      height: input.height,
    });
    const dialogueSurface = projectCliShellDialogueBackendFrame({
      layout,
      model: input.model,
      viewportOwner: input.dialogueViewportOwner,
    });
    dialogueSurface.styledLines.forEach((line, row) => {
      writeCanvasStyledText(canvas, {
        row: layout.row + row,
        col: layout.col,
        spans: line.spans,
        width: layout.width,
      });
    });
    selectionSources.push({
      owner: "dialogue",
      row: layout.row,
      col: layout.col,
      width: layout.width,
      height: layout.height,
      lines: dialogueSurface.styledLines,
      sourceStartRow: 0,
    });
    for (const region of dialogueSurface.actionRegions) {
      actionRegions.push({
        ...region,
        row: region.row + layout.row,
        col: region.col + layout.col,
      });
    }
  }
  if (renderToolbar && input.height > 0) {
    const toolbar = resolveCliShellToolbarLayout(input.model, input.width);
    writeCanvasText(canvas, {
      row: input.height - 1,
      col: 0,
      text: toolbar.line,
      width: input.width,
    });
    for (const item of toolbar.items) {
      if (item.id === "managed" || item.id === "unread") {
        actionRegions.push({
          action: item.id === "managed" ? "toggleManaged" : "openDialogue",
          row: input.height - 1,
          col: item.col,
          width: item.width,
          height: 1,
        });
      }
    }
  }
  return {
    lines: renderCanvasLines(canvas),
    styledLines: renderCanvasStyledLines(canvas),
    actionRegions,
    selectionSources,
  };
};

export const resolveCliShellTuiInteractionLayout = (input: {
  model: CliShellTuiModel;
  width: number;
  height: number;
}): CliShellTuiInteractionLayout => {
  const terminalScrollRegion = resolveCliShellTerminalScrollRegion(input);
  const dialogueLayout = resolveCliShellTranscriptPanelLayout(input);
  const selectionRegions: CliShellSelectionRegion[] = [];
  if (terminalScrollRegion) {
    selectionRegions.push({
      owner: "terminal",
      ...terminalScrollRegion,
    });
  }
  if (dialogueLayout.width > 0 && dialogueLayout.height > 0) {
    selectionRegions.push({
      owner: "dialogue",
      row: dialogueLayout.row,
      col: dialogueLayout.col,
      width: dialogueLayout.width,
      height: dialogueLayout.height,
    });
  }
  return {
    terminalScrollRegion,
    terminalScrollbarRegion: resolveCliShellTerminalScrollbarRegion(input),
    selectionRegions,
  };
};
