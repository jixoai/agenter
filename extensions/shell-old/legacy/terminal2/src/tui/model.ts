import type { GlobalRoomMessage, RuntimeClientState } from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

import {
  CLI_SHELL_HEARTBEAT_COPY,
  resolveCliShellToolbarStatus,
  resolveCliShellToolbarStatusIcon,
  resolveLatestCliShellHeartbeatTimestamp,
  summarizeCliShellHeartbeat,
} from "./heartbeat";
import type { CliShellInteractionEnhancementProfile } from "./interaction-capabilities";
import type { CliShellTuiKeybindings } from "./keybindings";
import type {
  CliShellDialogueBlock,
  CliShellDialogueWindowState,
  CliShellDialoguePlacement,
  CliShellDialoguePlacementRequest,
  CliShellObservationReadyBaseline,
  CliShellTuiAppProjection,
  CliShellTuiModel,
  CliShellTuiViewState,
} from "./types";
import {
  CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
  createCliShellDialogueMessageWindowFromSnapshot,
  dialogueMessageKey,
  mergeCliShellDialogueIncomingMessages,
  resolveCliShellDialogueScrollMetrics,
  type CliShellDialogueMessageWindow,
} from "./dialogue-scrollbox";

const SHORT_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_DIVIDER_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MIN_BODY_ROWS = 8;
const MIN_SIDE_PANEL_WIDTH = 44;
const MIN_TERMINAL_WIDTH = 32;
const MIN_FLOATING_WIDTH = 36;
const MIN_FLOATING_HEIGHT = 12;
const MIN_COVER_WIDTH = 24;
const MIN_COVER_HEIGHT = 7;

const resolveTerminalId = (input: {
  state: RuntimeClientState;
  sessionId: string;
  fallbackTerminalId: string;
}): string => {
  return input.fallbackTerminalId;
};

const resolveTerminalLines = (input: {
  state: RuntimeClientState;
  projection: CliShellTuiAppProjection;
  sessionId: string;
  terminalId: string;
  shellName: string;
}): string[] => {
  if (input.projection.liveTerminal?.plainLines.length) {
    return input.projection.liveTerminal.plainLines;
  }
  const terminalSnapshot =
    input.state.terminalSnapshotsBySession[input.sessionId]?.[input.terminalId] ??
    input.state.runtimes[input.sessionId]?.terminalSnapshots?.[input.terminalId];
  if (terminalSnapshot?.lines.length && terminalSnapshot.lines.some((line) => line.length > 0)) {
    return terminalSnapshot.lines;
  }
  const globalTerminalSnapshot = input.state.globalTerminals.data.find(
    (terminal) => terminal.terminalId === input.terminalId,
  )?.snapshot;
  if (globalTerminalSnapshot?.lines.length && globalTerminalSnapshot.lines.some((line) => line.length > 0)) {
    return globalTerminalSnapshot.lines;
  }
  return [`${input.terminalId || input.shellName}: waiting for terminal snapshot`];
};

const cloneRichLines = (lines: readonly TerminalRenderRichLine[]): TerminalRenderRichLine[] =>
  lines.map((line) => ({
    spans: line.spans.map((span: TerminalRenderRichLine["spans"][number]) => ({ ...span })),
  }));

const resolveTerminalView = (input: {
  state: RuntimeClientState;
  projection: CliShellTuiAppProjection;
  activeFocusTarget: NonNullable<CliShellTuiViewState["activeFocusTarget"]>;
  sessionId: string;
  terminalId: string;
  shellName: string;
}) => {
  const liveTerminal = input.projection.liveTerminal;
  if (liveTerminal) {
    return {
      snapshotSeq: liveTerminal.snapshotSeq,
      plainLines: [...liveTerminal.plainLines],
      richLines: cloneRichLines(liveTerminal.richLines),
      cursorAbsRow: liveTerminal.cursorAbsRow,
      cursorCol: liveTerminal.cursorCol,
      cursorVisible: liveTerminal.cursorVisible && input.activeFocusTarget === "terminal",
      rows: liveTerminal.rows,
      cols: liveTerminal.cols,
      viewportStart: liveTerminal.viewportStart,
      viewportEnd: liveTerminal.viewportEnd,
      scrollbackRows: liveTerminal.scrollbackRows,
      interaction: liveTerminal.interaction ? structuredClone(liveTerminal.interaction) : undefined,
      connected: liveTerminal.connected,
      running: liveTerminal.running,
    };
  }

  const plainLines = resolveTerminalLines(input);
  const terminalSnapshot =
    input.state.terminalSnapshotsBySession[input.sessionId]?.[input.terminalId] ??
    input.state.runtimes[input.sessionId]?.terminalSnapshots?.[input.terminalId] ??
    input.state.globalTerminals.data.find((terminal) => terminal.terminalId === input.terminalId)?.snapshot;
  const rows = Math.max(1, plainLines.length);
  const viewportStart = Math.max(0, terminalSnapshot?.scrollback.viewportOffset ?? plainLines.length - rows);
  return {
    snapshotSeq: terminalSnapshot?.seq ?? -1,
    plainLines,
    richLines: plainLines.map((text) => ({
      spans: text.length > 0 ? [{ text }] : [],
    })),
    cursorAbsRow: terminalSnapshot?.cursor.y ?? Math.max(0, plainLines.length - 1),
    cursorCol: terminalSnapshot?.cursor.x ?? 0,
    cursorVisible: (terminalSnapshot?.cursor.visible ?? false) && input.activeFocusTarget === "terminal",
    rows: terminalSnapshot?.scrollback.screenLines ?? terminalSnapshot?.rows ?? rows,
    cols:
      terminalSnapshot?.cols ??
      Math.max(
        1,
        plainLines.reduce((max, line) => Math.max(max, line.length), 0),
      ),
    viewportStart,
    viewportEnd: viewportStart + (terminalSnapshot?.scrollback.screenLines ?? terminalSnapshot?.rows ?? rows),
    scrollbackRows: terminalSnapshot?.scrollback.totalLines ?? plainLines.length,
    interaction: undefined,
    connected: input.state.connected,
    running: true,
  };
};

const resolveManagedLabel = (managed: CliShellTuiViewState["managed"]): string => {
  if (managed.managed) {
    return "托管 on";
  }
  if (managed.hostingActive) {
    return "托管 host";
  }
  return "托管 off";
};

const resolveMessageBody = (message: GlobalRoomMessage): string => {
  if (message.recalledAt) {
    return "_消息已撤回_";
  }
  const content = message.content.trim();
  if (content.length > 0) {
    return content;
  }
  if (message.attachments?.length) {
    return `[${message.attachments.length} attachments]`;
  }
  return "(empty message)";
};

const resolveMessageDateLabel = (message: GlobalRoomMessage): string => DATE_DIVIDER_FORMAT.format(message.createdAt);

const resolveMessageTimeLabel = (message: GlobalRoomMessage): string => SHORT_TIME_FORMAT.format(message.createdAt);

const resolveAuthorLabel = (
  message: GlobalRoomMessage,
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number],
): { label: string; authoredByUser: boolean } => {
  const authoredByUser = message.senderActorId !== avatarActorId;
  if (authoredByUser) {
    return {
      label: "you",
      authoredByUser: true,
    };
  }
  const from = message.from.trim();
  return {
    label: from.startsWith("@") ? from : `@${from}`,
    authoredByUser: false,
  };
};

const countUnreadRoomMessages = (
  snapshot: CliShellTuiAppProjection["roomSnapshot"],
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number],
): number | null => {
  if (!snapshot) {
    return null;
  }
  return snapshot.items.filter(
    (message) =>
      message.kind === "text" &&
      !message.recalledAt &&
      message.senderActorId !== avatarActorId &&
      message.unreadActorIds.includes(avatarActorId),
  ).length;
};

export const buildCliShellDialogueBlocks = (input: {
  messages: readonly GlobalRoomMessage[];
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
}): CliShellDialogueBlock[] => {
  const blocks: CliShellDialogueBlock[] = [];
  let previousDate: string | null = null;
  for (const message of input.messages) {
    const dateLabel = resolveMessageDateLabel(message);
    if (dateLabel !== previousDate) {
      blocks.push({
        key: `date:${dateLabel}`,
        kind: "date-divider",
        dateLabel,
      });
      previousDate = dateLabel;
    }
    const author = resolveAuthorLabel(message, input.avatarActorId);
    blocks.push({
      key: dialogueMessageKey(message.messageId),
      kind: "message",
      messageId: message.messageId,
      authoredByUser: author.authoredByUser,
      authorLabel: author.label,
      timeLabel: resolveMessageTimeLabel(message),
      body: resolveMessageBody(message),
    });
  }
  return blocks.length > 0
    ? blocks
    : [
        {
          kind: "message",
          authoredByUser: false,
          authorLabel: "@agenter",
          timeLabel: "--:--",
        body: "当前 room 还没有消息。",
      },
    ];
};

const toDialogueWindowState = (window: CliShellDialogueMessageWindow): CliShellDialogueWindowState => ({
  messages: window.messages,
  messageIds: window.messageIds,
  nextBefore: window.nextBefore,
  hasMoreBefore: window.hasMoreBefore,
  loadingBefore: window.loadingBefore,
  pinnedToBottom: window.pinnedToBottom,
  pendingNewMessageCount: window.pendingNewMessageCount,
  anchor: window.anchor,
  error: window.error,
});

const resolveDialogueRowsFromWindow = (window: CliShellDialogueWindowState) =>
  window.messageIds.map((messageId) => ({ key: dialogueMessageKey(messageId), height: 1 }));

const resolveDialogueWindow = (input: {
  snapshot: CliShellTuiAppProjection["roomSnapshot"];
  current: CliShellTuiViewState["dialogueWindow"];
  scrollTop: number;
}): CliShellDialogueWindowState => {
  if (!input.snapshot) {
    return {
      messages: [],
      messageIds: [],
      nextBefore: null,
      hasMoreBefore: false,
      loadingBefore: false,
      pinnedToBottom: true,
      pendingNewMessageCount: 0,
      anchor: null,
      error: null,
    };
  }
  const base = input.current
    ? ({
        messages: input.current.messages,
        messageIds: input.current.messageIds,
        nextBefore: input.current.nextBefore,
        hasMoreBefore: input.current.hasMoreBefore,
        loadingBefore: input.current.loadingBefore,
        pinnedToBottom: input.current.pinnedToBottom || input.scrollTop >= CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
        pendingNewMessageCount: input.current.pendingNewMessageCount,
        anchor: input.current.anchor,
        scroll: {
          scrollTop: input.scrollTop,
          viewportHeight: 1,
          scrollHeight: Math.max(1, input.current.messages.length),
        },
        error: input.current.error,
      } satisfies CliShellDialogueMessageWindow)
    : createCliShellDialogueMessageWindowFromSnapshot(input.snapshot);
  if (input.current) {
    mergeCliShellDialogueIncomingMessages(base, input.snapshot.items);
    base.nextBefore = input.current.nextBefore ?? input.snapshot.nextBefore;
    base.hasMoreBefore = input.current.hasMoreBefore || input.snapshot.hasMoreBefore;
  }
  return toDialogueWindowState(base);
};

const isSidePlacementViable = (width: number, bodyHeight: number): boolean =>
  width >= MIN_SIDE_PANEL_WIDTH + MIN_TERMINAL_WIDTH + 1 && bodyHeight >= MIN_BODY_ROWS;

const isFloatingPlacementViable = (width: number, bodyHeight: number): boolean =>
  width >= MIN_FLOATING_WIDTH && bodyHeight >= MIN_FLOATING_HEIGHT;

const resolveSmartPlacement = (width: number, bodyHeight: number): CliShellDialoguePlacement | null => {
  if (isSidePlacementViable(width, bodyHeight)) {
    return "right";
  }
  if (isFloatingPlacementViable(width, bodyHeight)) {
    return "floating";
  }
  if (width >= MIN_COVER_WIDTH && bodyHeight >= MIN_COVER_HEIGHT) {
    return "cover";
  }
  return null;
};

export const resolveCliShellDialoguePlacement = (input: {
  requestedPlacement: CliShellDialoguePlacementRequest;
  width: number;
  height: number;
}): CliShellDialoguePlacement | null => {
  const bodyHeight = Math.max(1, input.height - 1);
  if (input.requestedPlacement === "smart") {
    return resolveSmartPlacement(input.width, bodyHeight);
  }

  if (input.requestedPlacement === "left" || input.requestedPlacement === "right") {
    return isSidePlacementViable(input.width, bodyHeight)
      ? input.requestedPlacement
      : resolveSmartPlacement(input.width, bodyHeight);
  }
  if (input.requestedPlacement === "floating") {
    return isFloatingPlacementViable(input.width, bodyHeight)
      ? "floating"
      : resolveSmartPlacement(input.width, bodyHeight);
  }
  return resolveSmartPlacement(input.width, bodyHeight);
};

export const buildCliShellTuiModel = (input: {
  state: RuntimeClientState;
  projection: CliShellTuiAppProjection;
  sessionId: string;
  shellName: string;
  fallbackTerminalId: string;
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
  ui: CliShellTuiViewState;
  keybindings: CliShellTuiKeybindings;
  width: number;
  height: number;
  toolbarHeartbeatProjection?: string;
  observationReadyBaseline?: CliShellObservationReadyBaseline | null;
  interactionProfile?: CliShellInteractionEnhancementProfile;
}): CliShellTuiModel => {
  const terminalId = resolveTerminalId(input);
  const activeFocusTarget = input.ui.activeFocusTarget ?? input.ui.focusTarget;
  const heartbeatGroups = input.state.heartbeatGroupsBySession[input.sessionId]?.data ?? [];
  const terminalSignal = input.state.runtimes[input.sessionId]?.schedulerSignals.terminal ?? {
    version: 0,
    timestamp: null,
  };
  const terminalObservationReadyAt = terminalSignal.timestamp;
  const baseline = input.observationReadyBaseline ?? null;
  const terminalObservationReady =
    baseline === null
      ? terminalObservationReadyAt !== null
      : terminalSignal.version > baseline.version ||
        (terminalObservationReadyAt !== null &&
          baseline.timestamp !== null &&
          terminalObservationReadyAt > baseline.timestamp);
  const latestHeartbeatTimestamp = resolveLatestCliShellHeartbeatTimestamp(heartbeatGroups);
  const status = resolveCliShellToolbarStatus(heartbeatGroups);
  const unread =
    countUnreadRoomMessages(input.projection.roomSnapshot, input.avatarActorId) ??
    input.state.unreadBySession[input.sessionId] ??
    0;
  const startupReadyHeartbeat =
    terminalObservationReady &&
    (terminalObservationReadyAt === null ||
      latestHeartbeatTimestamp === null ||
      latestHeartbeatTimestamp < terminalObservationReadyAt)
      ? CLI_SHELL_HEARTBEAT_COPY.observationReady
      : null;
  const toolbarHeartbeat =
    input.ui.statusNotice?.trim() ||
    startupReadyHeartbeat ||
    summarizeCliShellHeartbeat({
      groups: heartbeatGroups,
      terminalId: terminalId || input.shellName,
      connected: input.state.connected,
      observationReady: terminalObservationReady,
    });
  const dialoguePlacement = input.ui.dialogueOpen
    ? resolveCliShellDialoguePlacement({
        requestedPlacement: input.ui.requestedPlacement,
        width: input.width,
        height: input.height,
      })
    : null;
  const rawDialogueScrollTop = Math.max(0, Math.trunc(input.ui.dialogueScrollTop ?? 0));
  const dialogueWindow = resolveDialogueWindow({
    snapshot: input.projection.roomSnapshot,
    current: input.ui.dialogueWindow,
    scrollTop: rawDialogueScrollTop,
  });
  const dialogueScrollRows = resolveDialogueRowsFromWindow(dialogueWindow);
  const dialogueScrollHeight = Math.max(1, dialogueScrollRows.length);
  const dialogueScrollTop =
    rawDialogueScrollTop >= CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM || dialogueWindow.pinnedToBottom
      ? Math.max(0, dialogueScrollHeight - 1)
      : rawDialogueScrollTop;
  const dialogueScroll = resolveCliShellDialogueScrollMetrics({
    scrollTop: dialogueScrollTop,
    viewportHeight: 1,
    scrollHeight: dialogueScrollHeight,
  });

  return {
    terminalId,
    terminalObservationReady,
    focusTarget: input.ui.focusTarget,
    activeFocusTarget,
    terminalView: resolveTerminalView({
      state: input.state,
      projection: input.projection,
      activeFocusTarget,
      sessionId: input.sessionId,
      terminalId,
      shellName: input.shellName,
    }),
    toolbarLeft: resolveCliShellToolbarStatusIcon(status),
    toolbarHeartbeat,
    toolbarHeartbeatProjection: input.toolbarHeartbeatProjection ?? toolbarHeartbeat,
    toolbarManaged: resolveManagedLabel(input.ui.managed),
    toolbarUnread: `✉ ${unread}`,
    dialogueOpen: input.ui.dialogueOpen,
    dialoguePlacement,
    dialogueBlocks: buildCliShellDialogueBlocks({
      messages: dialogueWindow.messages,
      avatarActorId: input.avatarActorId,
    }),
    dialogueDraft: input.ui.dialogueDraft,
    dialogueScroll: {
      ...dialogueScroll,
      pendingNewMessageCount: dialogueWindow.pendingNewMessageCount,
      rows: dialogueScrollRows,
    },
    dialogueWindow,
    dialogueTitle: "Chat",
    interactionProfile: input.interactionProfile,
  };
};
