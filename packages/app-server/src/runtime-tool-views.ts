import type { AttentionActiveContextMatch } from "@agenter/attention-system";
import type {
  MessageAttachment,
  MessageControlPlaneEntry,
  MessageKind,
  MessagePayload,
  MessageRecord,
  MessageSnapshot,
} from "@agenter/message-system";
import type { TerminalControlPlaneEntry } from "@agenter/terminal-system";

import { summarizeMessageChannelPresence } from "./message-channel-presence";
import type { WorkspaceGrantRecord, WorkspaceMountRecord } from "./workspace-system";

const clipPreview = (value: string, maxChars = 240): string | undefined => {
  if (value.length === 0) {
    return undefined;
  }
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...<clipped ${value.length - maxChars} chars>`;
};

const MESSAGE_OVERVIEW_MAX_CHARS = 120;
const MESSAGE_OVERVIEW_MAX_WORD_SEGMENTS = 20;
const messagePreviewSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

const normalizeInlineWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();
const padTimePart = (value: number, width: number): string => value.toString().padStart(width, "0");
const toRuntimeMessageId = (value: number): number => value;
const formatRuntimeMessageTime = (value: number): string => {
  const date = new Date(value);
  return [
    padTimePart(date.getFullYear(), 4),
    padTimePart(date.getMonth() + 1, 2),
    padTimePart(date.getDate(), 2),
    padTimePart(date.getHours(), 2),
    padTimePart(date.getMinutes(), 2),
    padTimePart(date.getSeconds(), 2),
    padTimePart(date.getMilliseconds(), 3),
  ].join("");
};

const appendEllipsis = (value: string, maxChars = MESSAGE_OVERVIEW_MAX_CHARS): string => {
  const clippedValue =
    value.length <= Math.max(0, maxChars - 3) ? value : value.slice(0, Math.max(0, maxChars - 3)).trimEnd();
  return `${clippedValue}...`;
};

const clipInlinePreview = (value: string, maxChars = MESSAGE_OVERVIEW_MAX_CHARS): string =>
  value.length <= maxChars ? value : appendEllipsis(value, maxChars);

const clipMessagePreview = (value: string): string => {
  const normalized = normalizeInlineWhitespace(value);
  if (normalized.length === 0) {
    return normalized;
  }
  let wordLikeCount = 0;
  let preview = "";
  for (const segment of messagePreviewSegmenter.segment(normalized)) {
    const isWordLike = segment.isWordLike !== false;
    if (isWordLike && wordLikeCount >= MESSAGE_OVERVIEW_MAX_WORD_SEGMENTS) {
      return appendEllipsis(preview.trimEnd());
    }
    preview += segment.segment;
    if (isWordLike) {
      wordLikeCount += 1;
    }
  }
  return clipInlinePreview(preview.trimEnd());
};

const readMessageContentPreview = (message: {
  kind: MessageKind;
  content: string;
  attachments?: MessageAttachment[];
  payload?: MessagePayload;
  recalledAt?: number;
}): string => {
  if (message.recalledAt) {
    return "[recalled]";
  }
  const firstNonEmptyLine = message.content
    .split(/\r?\n/gu)
    .map((line) => normalizeInlineWhitespace(line))
    .find((line) => line.length > 0);
  if (firstNonEmptyLine) {
    return clipMessagePreview(firstNonEmptyLine);
  }
  if (message.kind === "error") {
    return clipMessagePreview(message.payload?.error?.title ?? "[error]");
  }
  if (message.kind === "interactive") {
    return clipMessagePreview(message.payload?.interactive?.title ?? "[interactive]");
  }
  const attachmentCount = message.attachments?.length ?? 0;
  if (attachmentCount > 0) {
    return attachmentCount === 1 ? "[1 attachment]" : `[${attachmentCount} attachments]`;
  }
  return "[empty message]";
};

const projectRuntimeMessageAttachment = (
  attachment: MessageAttachment,
): {
  assetId: string;
  kind: MessageAttachment["kind"];
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
} => ({
  assetId: attachment.assetId,
  kind: attachment.kind,
  name: attachment.name,
  mimeType: attachment.mimeType,
  sizeBytes: attachment.sizeBytes,
  url: attachment.url,
});

export interface RuntimeAttentionActiveView {
  contextId: string;
  context: {
    owner: string;
    focusState: AttentionActiveContextMatch["context"]["focusState"];
    headCommitId: string | null;
    unresolvedScoreCount: number;
    scoreMap: Record<string, number>;
    contentFormat?: string;
    contentPreview?: string;
    updatedAt: string;
  };
  recentCommits: Array<{
    commitId: string;
    summary: string;
    createdAt: string;
    ingressType: AttentionActiveContextMatch["recentCommits"][number]["ingressType"];
    scores: Record<string, number>;
    src?: string;
    egress?: AttentionActiveContextMatch["recentCommits"][number]["egress"];
    changeType: AttentionActiveContextMatch["recentCommits"][number]["change"]["type"];
  }>;
}

export interface RuntimeWorkspaceSurface {
  mount: {
    workspacePath: string;
    kind: WorkspaceMountRecord["kind"];
  };
  grants: Array<{
    pattern: string;
    ruleIndex: number;
    mode: WorkspaceGrantRecord["mode"];
  }>;
}

export interface RuntimeMessageChannelView {
  chatId: string;
  kind: MessageControlPlaneEntry["kind"];
  title: string;
  contextId?: string;
  participants: Array<{
    id: string;
    label?: string;
  }>;
  readProgress?: {
    latestVisibleMessageId?: number;
    latestVisibleMessageRowId?: number;
    latestVisibleAt?: number;
    totalSeatCount: number;
    readSeatCount: number;
    unreadSeatCount: number;
    invalidCredentialSeatCount: number;
  };
  presence?: {
    totalSeatCount: number;
    participantLabels: string[];
    onlineLabels: string[];
    offlineLabels: string[];
    focusedLabels: string[];
  };
  focused: boolean;
  archivedAt?: number;
  archivedBy?: string;
}

export interface RuntimeVisibleMessageRoomView {
  chatId: string;
  title: string;
  participantLabels: string[];
  focused: boolean;
}

export interface RuntimeReachableParticipantView {
  label: string;
  rooms: RuntimeVisibleMessageRoomView[];
}

/**
 * Compact transcript row returned by room-message mutation acknowledgements.
 */
export interface RuntimeMessageOverviewItem {
  messageId: number;
  from: string;
  contentPreview: string;
  sendTime: string;
  editedTime?: string;
  recalledTime?: string;
}

export interface RuntimeMessageSendResult {
  ok: true;
  messageId: number;
  recentMessages: RuntimeMessageOverviewItem[];
}

export interface RuntimeMessageSnapshotView {
  channel: RuntimeMessageChannelView;
  directory?: {
    visibleRooms: RuntimeVisibleMessageRoomView[];
    reachableParticipants: RuntimeReachableParticipantView[];
  };
  items: Array<{
    rowId: number;
    messageId: number;
    rootId?: string;
    from: string;
    kind: "text" | "error" | "interactive";
    content: string;
    createdAt: number;
    updatedAt: number;
    visibleAt?: number;
    attachments?: Array<{
      assetId: string;
      kind: MessageAttachment["kind"];
      name: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>;
    payload?: MessagePayload;
  }>;
  nextBefore: MessageSnapshot["nextBefore"];
  hasMoreBefore: boolean;
  headVersion: string;
}

export interface RuntimeTerminalView {
  terminalId: string;
  processKind: string;
  command: string[];
  cwd: string;
  workspace: string | null;
  running: boolean;
  status: "IDLE" | "BUSY";
  focused: boolean;
  icon?: string;
  title?: string;
  rendererEngine?: TerminalControlPlaneEntry["rendererEngine"];
}

export const projectRuntimeAttentionActiveMatch = (match: AttentionActiveContextMatch): RuntimeAttentionActiveView => ({
  contextId: match.contextId,
  context: {
    owner: match.context.owner,
    focusState: match.context.focusState,
    headCommitId: match.context.headCommitId,
    unresolvedScoreCount: Object.values(match.context.scoreMap).filter((score) => score > 0).length,
    scoreMap: { ...match.context.scoreMap },
    contentFormat: match.context.contentFormat,
    contentPreview: clipPreview(match.context.content),
    updatedAt: match.context.updatedAt,
  },
  recentCommits: match.recentCommits.slice(-3).map((commit) => ({
    commitId: commit.commitId,
    summary: commit.summary,
    createdAt: commit.createdAt,
    ingressType: commit.ingressType,
    scores: { ...commit.scores },
    src: commit.meta.src,
    egress: commit.egress ? { ...commit.egress } : undefined,
    changeType: commit.change.type,
  })),
});

export const projectRuntimeWorkspaceSurface = (input: {
  mount: WorkspaceMountRecord;
  grants: WorkspaceGrantRecord[];
}): RuntimeWorkspaceSurface => ({
  mount: {
    workspacePath: input.mount.workspacePath,
    kind: input.mount.kind,
  },
  grants: input.grants.map((grant) => ({
    pattern: grant.pattern,
    ruleIndex: grant.ruleIndex,
    mode: grant.mode,
  })),
});

export const projectRuntimeMessageChannel = (channel: MessageControlPlaneEntry): RuntimeMessageChannelView => {
  const presence = summarizeMessageChannelPresence(channel);

  return {
    chatId: channel.chatId,
    kind: channel.kind,
    title: channel.title,
    contextId: channel.contextId,
    participants: channel.participants.map((participant) => ({
      id: participant.id,
      label: participant.label,
    })),
    readProgress: channel.readProgress
      ? {
          ...channel.readProgress,
          latestVisibleMessageId: channel.readProgress.latestVisibleMessageId
            ? toRuntimeMessageId(channel.readProgress.latestVisibleMessageId)
            : undefined,
        }
      : undefined,
    presence,
    focused: channel.focused,
    archivedAt: channel.archivedAt,
    archivedBy: channel.archivedBy,
  };
};

export const projectRuntimeMessageSnapshot = (
  snapshot: MessageSnapshot,
  input?: {
    visibleRooms?: RuntimeVisibleMessageRoomView[];
    reachableParticipants?: RuntimeReachableParticipantView[];
  },
): RuntimeMessageSnapshotView => ({
  channel: projectRuntimeMessageChannel(snapshot.channel),
  directory:
    input?.visibleRooms || input?.reachableParticipants
      ? {
          visibleRooms: input?.visibleRooms ?? [],
          reachableParticipants: input?.reachableParticipants ?? [],
        }
      : undefined,
  items: snapshot.items.map((item) => ({
    rowId: item.rowId,
    messageId: toRuntimeMessageId(item.messageId),
    rootId: item.rootId,
    from: item.from,
    kind: item.kind,
    content: item.content,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    visibleAt: item.visibleAt,
    attachments: item.attachments?.map(projectRuntimeMessageAttachment),
    payload: item.payload ? ({ ...item.payload } satisfies MessagePayload) : undefined,
  })),
  nextBefore: snapshot.nextBefore,
  hasMoreBefore: snapshot.hasMoreBefore,
  headVersion: snapshot.headVersion,
});

export const projectRuntimeMessageOverview = (
  messages: readonly MessageRecord[],
  limit = 5,
): RuntimeMessageOverviewItem[] =>
  messages.slice(-Math.max(0, limit)).map((message) => ({
    messageId: toRuntimeMessageId(message.messageId),
    from: message.from,
    contentPreview: readMessageContentPreview(message),
    sendTime: formatRuntimeMessageTime(message.visibleAt ?? message.createdAt),
    editedTime:
      !message.recalledAt && message.updatedAt > message.createdAt
        ? formatRuntimeMessageTime(message.updatedAt)
        : undefined,
    recalledTime: message.recalledAt ? formatRuntimeMessageTime(message.recalledAt) : undefined,
  }));

export const projectRuntimeTerminal = (terminal: TerminalControlPlaneEntry): RuntimeTerminalView => ({
  terminalId: terminal.terminalId,
  processKind: terminal.processKind,
  command: [...terminal.command],
  cwd: terminal.cwd,
  workspace: terminal.workspace,
  running: terminal.running,
  status: terminal.status,
  focused: terminal.focused,
  icon: terminal.icon,
  title: terminal.title,
  rendererEngine: terminal.rendererEngine,
});
