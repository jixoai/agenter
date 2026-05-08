import type { GlobalRoomMessage, RuntimeClientState } from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";

import { formatCliShellShortcut, type CliShellTuiKeybindings } from "./keybindings";
import {
  resolveCliShellToolbarStatus,
  resolveCliShellToolbarStatusIcon,
  summarizeCliShellHeartbeat,
} from "./heartbeat";
import type {
  CliShellDialogueBlock,
  CliShellDialoguePlacement,
  CliShellDialoguePlacementRequest,
  CliShellTuiAppProjection,
  CliShellTuiModel,
  CliShellTuiViewState,
} from "./types";

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

const resolveTerminalId = (input: {
  state: RuntimeClientState;
  sessionId: string;
  fallbackTerminalId: string;
}): string => {
  const runtime = input.state.runtimes[input.sessionId];
  return runtime?.focusedTerminalId?.trim() || input.fallbackTerminalId;
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
  if (
    globalTerminalSnapshot?.lines.length &&
    globalTerminalSnapshot.lines.some((line) => line.length > 0)
  ) {
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
  sessionId: string;
  terminalId: string;
  shellName: string;
}) => {
  const liveTerminal = input.projection.liveTerminal;
  if (liveTerminal) {
    return {
      plainLines: [...liveTerminal.plainLines],
      richLines: cloneRichLines(liveTerminal.richLines),
      cursorAbsRow: liveTerminal.cursorAbsRow,
      cursorCol: liveTerminal.cursorCol,
      cursorVisible: liveTerminal.cursorVisible,
      rows: liveTerminal.rows,
      cols: liveTerminal.cols,
      viewportStart: liveTerminal.viewportStart,
      viewportEnd: liveTerminal.viewportEnd,
      scrollbackRows: liveTerminal.scrollbackRows,
      connected: liveTerminal.connected,
      running: liveTerminal.running,
    };
  }

  const plainLines = resolveTerminalLines(input);
  const rows = Math.max(1, plainLines.length);
  const viewportStart = Math.max(0, plainLines.length - rows);
  return {
    plainLines,
    richLines: plainLines.map((text) => ({
      spans: text.length > 0 ? [{ text }] : [],
    })),
    cursorAbsRow: Math.max(0, plainLines.length - 1),
    cursorCol: 0,
    cursorVisible: false,
    rows,
    cols: Math.max(1, plainLines.reduce((max, line) => Math.max(max, line.length), 0)),
    viewportStart,
    viewportEnd: plainLines.length,
    scrollbackRows: plainLines.length,
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

const buildDialogueBlocks = (input: {
  projection: CliShellTuiAppProjection;
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
}): CliShellDialogueBlock[] => {
  const snapshot = input.projection.roomSnapshot;
  if (!snapshot) {
    return [
      {
        kind: "message",
        authoredByUser: false,
        authorLabel: "@agenter",
        timeLabel: "--:--",
        body: "载入对话消息…",
      },
    ];
  }

  const blocks: CliShellDialogueBlock[] = [];
  let previousDate: string | null = null;
  for (const message of snapshot.items) {
    const dateLabel = resolveMessageDateLabel(message);
    if (dateLabel !== previousDate) {
      blocks.push({
        kind: "date-divider",
        dateLabel,
      });
      previousDate = dateLabel;
    }
    const author = resolveAuthorLabel(message, input.avatarActorId);
    blocks.push({
      kind: "message",
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

const isSidePlacementViable = (width: number, bodyHeight: number): boolean =>
  width >= MIN_SIDE_PANEL_WIDTH + MIN_TERMINAL_WIDTH + 1 && bodyHeight >= MIN_BODY_ROWS;

const isFloatingPlacementViable = (width: number, bodyHeight: number): boolean =>
  width >= MIN_FLOATING_WIDTH && bodyHeight >= MIN_FLOATING_HEIGHT;

const resolveSmartPlacement = (width: number, bodyHeight: number): CliShellDialoguePlacement => {
  if (isSidePlacementViable(width, bodyHeight)) {
    return "right";
  }
  return "floating";
};

export const resolveCliShellDialoguePlacement = (input: {
  requestedPlacement: CliShellDialoguePlacementRequest;
  width: number;
  height: number;
}): CliShellDialoguePlacement => {
  const bodyHeight = Math.max(1, input.height - 1);
  if (input.requestedPlacement === "smart") {
    return resolveSmartPlacement(input.width, bodyHeight);
  }

  if (input.requestedPlacement === "left" || input.requestedPlacement === "right") {
    return isSidePlacementViable(input.width, bodyHeight)
      ? input.requestedPlacement
      : resolveSmartPlacement(input.width, bodyHeight);
  }
  if (input.requestedPlacement === "bottom") {
    return "bottom";
  }
  return isFloatingPlacementViable(input.width, bodyHeight) ? "floating" : resolveSmartPlacement(input.width, bodyHeight);
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
}): CliShellTuiModel => {
  const terminalId = resolveTerminalId(input);
  const heartbeatGroups = input.state.heartbeatGroupsBySession[input.sessionId]?.data ?? [];
  const status = resolveCliShellToolbarStatus(heartbeatGroups);
  const unread = countUnreadRoomMessages(input.projection.roomSnapshot, input.avatarActorId) ?? input.state.unreadBySession[input.sessionId] ?? 0;
  const toolbarHeartbeat =
    input.ui.statusNotice?.trim() ||
    summarizeCliShellHeartbeat({
      groups: heartbeatGroups,
      terminalId: terminalId || input.shellName,
      connected: input.state.connected,
    });
  const dialoguePlacement = input.ui.dialogueOpen
    ? resolveCliShellDialoguePlacement({
        requestedPlacement: input.ui.requestedPlacement,
        width: input.width,
        height: input.height,
      })
    : null;

  return {
    terminalId,
    terminalView: resolveTerminalView({
      state: input.state,
      projection: input.projection,
      sessionId: input.sessionId,
      terminalId,
      shellName: input.shellName,
    }),
    toolbarLeft: `${resolveCliShellToolbarStatusIcon(status)} terminal`,
    toolbarHeartbeat,
    toolbarHeartbeatProjection: input.toolbarHeartbeatProjection ?? toolbarHeartbeat,
    toolbarManaged: resolveManagedLabel(input.ui.managed),
    toolbarUnread: `✉ ${unread} ${formatCliShellShortcut(input.keybindings.openDialogue)}`,
    dialogueOpen: input.ui.dialogueOpen,
    dialoguePlacement,
    dialogueBlocks: buildDialogueBlocks({
      projection: input.projection,
      avatarActorId: input.avatarActorId,
    }),
    dialogueDraft: input.ui.dialogueDraft,
    dialogueTitle: "Dialogue",
  };
};
