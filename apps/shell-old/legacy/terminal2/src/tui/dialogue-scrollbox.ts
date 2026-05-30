import type { GlobalRoomMessage, GlobalRoomSnapshotOutput, HistoryPageCursor } from "@agenter/client-sdk";
import {
  parseColor,
  ScrollBoxRenderable,
  StyledText,
  TextRenderable,
  type RenderContext,
  type TextChunk,
} from "@opentui/core";

import type { TerminalCanvasStyledLine } from "./canvas";

export interface CliShellDialogueScrollRow {
  key: string;
  signature?: string;
  text?: string;
  height?: number;
  line?: TerminalCanvasStyledLine;
}

export interface CliShellDialogueScrollSnapshot {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
  maxScrollTop: number;
  nearTop: boolean;
  pinnedToBottom: boolean;
}

export interface CliShellDialogueScrollMetricsInput {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
  edgeThresholdRows?: number;
}

export interface CliShellDialogueScrollMetrics {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
  maxScrollTop: number;
  nearTop: boolean;
  pinnedToBottom: boolean;
}

export interface CliShellDialogueAnchor {
  key: string;
  offset: number;
}

export interface CliShellDialogueMessageWindow {
  messages: GlobalRoomMessage[];
  messageIds: number[];
  nextBefore: HistoryPageCursor | null;
  hasMoreBefore: boolean;
  loadingBefore: boolean;
  pinnedToBottom: boolean;
  pendingNewMessageCount: number;
  anchor: CliShellDialogueAnchor | null;
  scroll: {
    scrollTop: number;
    viewportHeight: number;
    scrollHeight: number;
  };
  error: string | null;
}

export interface CliShellDialogueMessagePage {
  items: GlobalRoomMessage[];
  nextBefore: HistoryPageCursor | null;
  hasMore: boolean;
}

interface CliShellDialogueRenderedRow {
  renderable: TextRenderable;
  signature: string;
}

export type CliShellDialoguePageMessages = (input: {
  chatId: string;
  accessToken?: string;
  before?: HistoryPageCursor | null;
  limit?: number;
}) => Promise<CliShellDialogueMessagePage>;

const DEFAULT_EDGE_THRESHOLD_ROWS = 2;
const DEFAULT_DIALOGUE_PAGE_LIMIT = 50;
export const CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM = Number.MAX_SAFE_INTEGER;

const compareMessages = (left: GlobalRoomMessage, right: GlobalRoomMessage): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  return left.messageId - right.messageId;
};

const uniqueSortedMessages = (messages: readonly GlobalRoomMessage[]): GlobalRoomMessage[] => {
  const byId = new Map<number, GlobalRoomMessage>();
  for (const message of messages) {
    byId.set(message.messageId, message);
  }
  return [...byId.values()].sort(compareMessages);
};

const refreshMessageIds = (window: CliShellDialogueMessageWindow): void => {
  window.messageIds = window.messages.map((message) => message.messageId);
};

export const dialogueMessageKey = (messageId: number): string => `message:${messageId}`;

export const resolveCliShellDialogueWheelDelta = (input: {
  direction: "up" | "down" | "left" | "right" | undefined;
  delta?: number;
}): number => {
  const delta = Math.max(1, Math.trunc(input.delta ?? 1));
  if (input.direction === "down") {
    return delta;
  }
  if (input.direction === "up") {
    return -delta;
  }
  return 0;
};

export const resolveCliShellDialogueScrollMetrics = (
  input: CliShellDialogueScrollMetricsInput,
): CliShellDialogueScrollMetrics => {
  const viewportHeight = Math.max(1, Math.trunc(input.viewportHeight));
  const scrollHeight = Math.max(viewportHeight, Math.trunc(input.scrollHeight));
  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
  const scrollTop = Math.max(0, Math.min(maxScrollTop, Math.trunc(input.scrollTop)));
  const edgeThresholdRows = Math.max(0, Math.trunc(input.edgeThresholdRows ?? DEFAULT_EDGE_THRESHOLD_ROWS));
  return {
    scrollTop,
    viewportHeight,
    scrollHeight,
    maxScrollTop,
    nearTop: scrollTop <= edgeThresholdRows,
    pinnedToBottom: maxScrollTop - scrollTop <= edgeThresholdRows,
  };
};

export const createCliShellDialogueMessageWindowFromSnapshot = (
  snapshot: GlobalRoomSnapshotOutput,
): CliShellDialogueMessageWindow => {
  const messages = uniqueSortedMessages(snapshot.items);
  return {
    messages,
    messageIds: messages.map((message) => message.messageId),
    nextBefore: snapshot.nextBefore,
    hasMoreBefore: snapshot.hasMoreBefore,
    loadingBefore: false,
    pinnedToBottom: true,
    pendingNewMessageCount: 0,
    anchor: null,
    scroll: {
      scrollTop: 0,
      viewportHeight: 1,
      scrollHeight: Math.max(1, messages.length),
    },
    error: null,
  };
};

export const prependCliShellDialogueMessagePage = (
  window: CliShellDialogueMessageWindow,
  page: CliShellDialogueMessagePage,
): CliShellDialogueMessageWindow => {
  window.messages = uniqueSortedMessages([...page.items, ...window.messages]);
  refreshMessageIds(window);
  window.nextBefore = page.nextBefore;
  window.hasMoreBefore = page.hasMore;
  window.loadingBefore = false;
  window.error = null;
  return window;
};

export const mergeCliShellDialogueIncomingMessages = (
  window: CliShellDialogueMessageWindow,
  messages: readonly GlobalRoomMessage[],
): CliShellDialogueMessageWindow => {
  const beforeIds = new Set(window.messageIds);
  window.messages = uniqueSortedMessages([...window.messages, ...messages]);
  refreshMessageIds(window);
  const newVisibleCount = window.messageIds.filter((messageId) => !beforeIds.has(messageId)).length;
  if (window.pinnedToBottom) {
    window.pendingNewMessageCount = 0;
    window.anchor = null;
  } else {
    window.pendingNewMessageCount += newVisibleCount;
  }
  return window;
};

const resolveRowHeight = (row: Pick<CliShellDialogueScrollRow, "height">): number =>
  Math.max(1, Math.trunc(row.height ?? 1));

export const captureCliShellDialogueAnchor = (input: {
  rows: readonly CliShellDialogueScrollRow[];
  scrollTop: number;
}): CliShellDialogueAnchor | null => {
  const scrollTop = Math.max(0, Math.trunc(input.scrollTop));
  let top = 0;
  for (const row of input.rows) {
    const height = resolveRowHeight(row);
    if (top + height > scrollTop) {
      return {
        key: row.key,
        offset: scrollTop - top,
      };
    }
    top += height;
  }
  return input.rows.at(-1) ? { key: input.rows.at(-1)!.key, offset: 0 } : null;
};

export const restoreCliShellDialogueAnchorScrollTop = (input: {
  rows: readonly CliShellDialogueScrollRow[];
  anchor: CliShellDialogueAnchor | null;
}): number => {
  if (!input.anchor) {
    return 0;
  }
  let top = 0;
  for (const row of input.rows) {
    if (row.key === input.anchor.key) {
      return Math.max(0, top + input.anchor.offset);
    }
    top += resolveRowHeight(row);
  }
  return 0;
};

const resolveRowsHeight = (rows: readonly CliShellDialogueScrollRow[]): number =>
  rows.reduce((total, row) => total + resolveRowHeight(row), 0);

const resolveDialogueScrollRowText = (row: CliShellDialogueScrollRow): string =>
  row.text ?? row.line?.spans.map((span) => span.text).join("") ?? row.key;

const resolveDialogueScrollRowContent = (row: CliShellDialogueScrollRow): string | StyledText => {
  if (!row.line) {
    return row.text ?? row.key;
  }
  const chunks: TextChunk[] = row.line.spans.map((span) => ({
    __isChunk: true,
    text: span.text,
    fg: span.fg ? parseColor(span.fg) : undefined,
    bg: span.bg ? parseColor(span.bg) : undefined,
  }));
  return chunks.length > 0 ? new StyledText(chunks) : "";
};

const resolveDialogueScrollRowSignature = (row: CliShellDialogueScrollRow): string => {
  if (row.signature) {
    return row.signature;
  }
  const lineSignature =
    row.line?.spans.map((span) => `${span.text}\u0003${span.fg ?? ""}\u0003${span.bg ?? ""}`).join("\u0004") ?? "";
  return [
    row.key,
    String(resolveRowHeight(row)),
    row.text ?? "",
    lineSignature,
  ].join("\u0000");
};

export const restoreCliShellDialoguePrependScrollTop = (input: {
  rowsBefore: readonly CliShellDialogueScrollRow[];
  rowsAfter: readonly CliShellDialogueScrollRow[];
  anchor: CliShellDialogueAnchor | null;
  previousScrollTop: number;
}): number => {
  if (input.anchor) {
    return restoreCliShellDialogueAnchorScrollTop({
      rows: input.rowsAfter,
      anchor: input.anchor,
    });
  }
  const prependedRowsHeight = Math.max(0, resolveRowsHeight(input.rowsAfter) - resolveRowsHeight(input.rowsBefore));
  return Math.max(0, Math.trunc(input.previousScrollTop) + prependedRowsHeight);
};

export const loadCliShellDialogueOlderMessages = async (input: {
  chatId: string;
  accessToken?: string;
  window: CliShellDialogueMessageWindow;
  pageMessages: CliShellDialoguePageMessages;
  thresholdRows?: number;
  limit?: number;
}): Promise<CliShellDialogueMessageWindow> => {
  const metrics = resolveCliShellDialogueScrollMetrics({
    ...input.window.scroll,
    edgeThresholdRows: input.thresholdRows,
  });
  if (!metrics.nearTop || !input.window.hasMoreBefore || input.window.loadingBefore) {
    return input.window;
  }
  input.window.loadingBefore = true;
  input.window.error = null;
  try {
    const page = await input.pageMessages({
      chatId: input.chatId,
      accessToken: input.accessToken,
      before: input.window.nextBefore,
      limit: input.limit ?? DEFAULT_DIALOGUE_PAGE_LIMIT,
    });
    return prependCliShellDialogueMessagePage(input.window, page);
  } catch (error) {
    input.window.loadingBefore = false;
    input.window.error = error instanceof Error ? error.message : String(error);
    return input.window;
  }
};

export class CliShellDialogueScrollBoxController {
  readonly scrollBox: ScrollBoxRenderable;
  readonly #ctx: RenderContext;
  #rows: CliShellDialogueScrollRow[];
  #rowSignature = "";
  #renderedRows = new Map<string, CliShellDialogueRenderedRow>();
  #scrollTop: number;
  #viewportHeight: number;

  constructor(ctx: RenderContext, options: {
    id?: string;
    width: number;
    height: number;
    rows: readonly CliShellDialogueScrollRow[];
    initialScrollTop?: number;
  }) {
    this.#ctx = ctx;
    this.#rows = [...options.rows];
    this.#viewportHeight = Math.max(1, Math.trunc(options.height));
    this.#scrollTop = Math.max(0, Math.trunc(options.initialScrollTop ?? 0));
    this.scrollBox = new ScrollBoxRenderable(ctx, {
      id: options.id ?? "cli-shell-dialogue-scrollbox",
      position: "absolute",
      top: 0,
      left: 0,
      width: Math.max(1, Math.trunc(options.width)),
      height: Math.max(1, Math.trunc(options.height)),
      scrollY: true,
      scrollX: false,
      stickyScroll:
        options.initialScrollTop === undefined || options.initialScrollTop >= CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
      stickyStart: "bottom",
      scrollbarOptions: {
        showArrows: false,
      },
    });
    this.renderRows();
    if (options.initialScrollTop !== undefined) {
      this.syncScrollTop(options.initialScrollTop);
    }
  }

  updateRows(rows: readonly CliShellDialogueScrollRow[]): void {
    this.#rows = [...rows];
    this.renderRows();
    this.syncScrollTop(this.#scrollTop);
  }

  updateGeometry(input: { width: number; height: number }): void {
    this.#viewportHeight = Math.max(1, Math.trunc(input.height));
    this.scrollBox.width = Math.max(1, Math.trunc(input.width));
    this.scrollBox.height = this.#viewportHeight;
    this.syncScrollTop(this.#scrollTop);
  }

  sync(input: {
    width: number;
    height: number;
    rows: readonly CliShellDialogueScrollRow[];
    scrollTop: number;
  }): CliShellDialogueScrollSnapshot {
    this.#rows = [...input.rows];
    this.#viewportHeight = Math.max(1, Math.trunc(input.height));
    this.scrollBox.width = Math.max(1, Math.trunc(input.width));
    this.scrollBox.height = this.#viewportHeight;
    this.renderRows();
    return this.syncScrollTop(input.scrollTop);
  }

  applyWheel(input: { direction: "up" | "down" | "left" | "right" | undefined; delta?: number }): void {
    const delta = resolveCliShellDialogueWheelDelta(input);
    if (delta !== 0) {
      this.scrollByRows(delta);
    }
  }

  scrollByRows(deltaRows: number): CliShellDialogueScrollSnapshot {
    const delta = Math.trunc(deltaRows);
    if (Number.isFinite(delta) && delta !== 0) {
      this.scrollBox.scrollBy({ y: delta, x: 0 }, "step");
      return this.syncScrollTop(this.#scrollTop + delta);
    }
    return this.snapshot();
  }

  syncScrollTop(scrollTop: number): CliShellDialogueScrollSnapshot {
    const maxScrollTop = Math.max(0, this.resolveScrollHeight() - this.#viewportHeight);
    const shouldStickToBottom = scrollTop >= CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM;
    const nextScrollTop = shouldStickToBottom ? maxScrollTop : Math.max(0, Math.min(maxScrollTop, Math.trunc(scrollTop)));
    this.#scrollTop = nextScrollTop;
    this.scrollBox.stickyStart = "bottom";
    this.scrollBox.stickyScroll = shouldStickToBottom;
    this.scrollBox.scrollTop = nextScrollTop;
    return this.snapshot();
  }

  syncFromHostViewport(): CliShellDialogueScrollSnapshot {
    const maxScrollTop = Math.max(0, this.resolveScrollHeight() - this.#viewportHeight);
    this.#scrollTop = Math.max(0, Math.min(maxScrollTop, Math.trunc(this.scrollBox.scrollTop)));
    return this.snapshot();
  }

  snapshot(edgeThresholdRows = DEFAULT_EDGE_THRESHOLD_ROWS): CliShellDialogueScrollSnapshot {
    const metrics = resolveCliShellDialogueScrollMetrics({
      scrollTop: this.#scrollTop,
      viewportHeight: Math.max(this.#viewportHeight, this.scrollBox.viewport.height),
      scrollHeight: Math.max(this.resolveScrollHeight(), this.scrollBox.scrollHeight),
      edgeThresholdRows,
    });
    return {
      scrollTop: metrics.scrollTop,
      viewportHeight: metrics.viewportHeight,
      scrollHeight: metrics.scrollHeight,
      maxScrollTop: metrics.maxScrollTop,
      nearTop: metrics.nearTop,
      pinnedToBottom: metrics.pinnedToBottom,
    };
  }

  private renderRows(): void {
    const nextSignature = this.#rows.map(resolveDialogueScrollRowSignature).join("\u0001");
    if (nextSignature === this.#rowSignature) {
      return;
    }
    this.#rowSignature = nextSignature;

    const nextKeys = new Set<string>();
    for (const [index, row] of this.#rows.entries()) {
      nextKeys.add(row.key);
      const rowSignature = resolveDialogueScrollRowSignature(row);
      let rendered = this.#renderedRows.get(row.key);
      if (!rendered) {
        rendered = {
          renderable: new TextRenderable(this.#ctx, {
            id: `${this.scrollBox.id}-${row.key}`,
            content: resolveDialogueScrollRowContent(row),
            width: "100%",
            height: resolveRowHeight(row),
          }),
          signature: rowSignature,
        };
        this.#renderedRows.set(row.key, rendered);
      } else if (rendered.signature !== rowSignature) {
        rendered.renderable.content = resolveDialogueScrollRowContent(row);
        rendered.renderable.height = resolveRowHeight(row);
        rendered.signature = rowSignature;
      }

      if (this.scrollBox.getChildren()[index] !== rendered.renderable) {
        this.scrollBox.add(rendered.renderable, index);
      }
    }

    for (const [key, rendered] of this.#renderedRows) {
      if (!nextKeys.has(key)) {
        this.scrollBox.remove(rendered.renderable.id);
        this.#renderedRows.delete(key);
      }
    }
  }

  private resolveScrollHeight(): number {
    return this.#rows.reduce((total, row) => total + resolveRowHeight(row), 0);
  }
}
