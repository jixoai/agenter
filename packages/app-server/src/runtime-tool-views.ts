import type { AttentionActiveContextMatch } from "@agenter/attention-system";
import type { MessageAttachment, MessageControlPlaneEntry, MessagePayload, MessageSnapshot } from "@agenter/message-system";
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
    systemId?: string;
    subjectId?: string;
    channelId?: string;
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
    relativePath: string;
    absolutePath: string;
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
    latestVisibleMessageId?: string;
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

export interface RuntimeMessageSnapshotView {
  channel: RuntimeMessageChannelView;
  directory?: {
    visibleRooms: RuntimeVisibleMessageRoomView[];
    reachableParticipants: RuntimeReachableParticipantView[];
  };
  items: Array<{
    rowId: number;
    messageId: string;
    rootId?: string;
    from: string;
    to?: string;
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
    systemId: commit.meta.systemId,
    subjectId: commit.meta.subjectId,
    channelId: commit.meta.channelId,
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
    relativePath: grant.relativePath,
    absolutePath: grant.absolutePath,
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
    messageId: item.messageId,
    rootId: item.rootId,
    from: item.from,
    to: item.to,
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
