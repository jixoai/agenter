import type { AttentionActiveContextMatch, AttentionContextSnapshot } from "@agenter/attention-system";
import type {
  MessageAttachment,
  MessageControlPlaneEntry,
  MessageKind,
  MessagePayload,
  MessageQueryResult,
  MessageRecord,
  MessageSnapshot,
} from "@agenter/message-system";
import type { TerminalConfigMutationResult, TerminalConfigView, TerminalControlPlaneEntry } from "@agenter/terminal-system";

import { summarizeMessageChannelPresence } from "./message-channel-presence";
import type { RuntimeSkillConfig } from "./runtime-skill-config";
import type { RuntimeSkillConfigInfo, RuntimeSkillInfo, RuntimeSkillRefreshResult } from "./runtime-skill-system";
import type { RuntimeSkillRecord } from "./runtime-skills";
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
    changeType: AttentionActiveContextMatch["recentCommits"][number]["change"]["type"];
  }>;
}

export interface RuntimeAttentionContextView {
  contextId: string;
  context: {
    owner: string;
    focusState: AttentionContextSnapshot["focusState"];
    headCommitId: string | null;
    scoreMap: Record<string, number>;
    contentFormat?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
  commits: Array<{
    commitId: string;
    summary: string;
    createdAt: string;
    ingressType: AttentionContextSnapshot["commits"][number]["ingressType"];
    parentCommitIds: string[];
    scores: Record<string, number>;
    src?: string;
    tags?: string[];
    change: AttentionContextSnapshot["commits"][number]["change"];
  }>;
  commitCount: number;
  commitsTruncated: boolean;
}

export interface RuntimeWorkspaceSurface {
  workspaceId: number;
  alias: string;
  cwd: string;
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
  actionId: string;
  messageId: number;
  recentMessages: RuntimeMessageOverviewItem[];
}

export interface RuntimeMessageItemView {
  rowId: number;
  messageId: number;
  ref?: number;
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
}

export interface RuntimeMessageSnapshotView {
  channel: RuntimeMessageChannelView;
  directory?: {
    visibleRooms: RuntimeVisibleMessageRoomView[];
    reachableParticipants: RuntimeReachableParticipantView[];
  };
  items: RuntimeMessageItemView[];
  referencedItems: RuntimeMessageItemView[];
  nextBefore: MessageSnapshot["nextBefore"];
  hasMoreBefore: boolean;
  headVersion: string;
}

export type RuntimeMessageQueryResult = MessageQueryResult;

export interface RuntimeTerminalView {
  terminalId: string;
  processKind: string;
  command: string[];
  launchCwd: string;
  workspace: string | null;
  status: "IDLE" | "BUSY";
  processPhase: TerminalControlPlaneEntry["processPhase"];
  lifecycleTransition?: TerminalControlPlaneEntry["lifecycleTransition"];
  focused: boolean;
  icon?: string;
  configuredTitle?: string;
  currentTitle?: string;
  currentPath?: string;
  lastStopReason?: TerminalControlPlaneEntry["lastStopReason"];
  lastExitCode?: TerminalControlPlaneEntry["lastExitCode"];
  lastExitSignal?: TerminalControlPlaneEntry["lastExitSignal"];
  lastStoppedAt?: TerminalControlPlaneEntry["lastStoppedAt"];
  shortcuts?: TerminalControlPlaneEntry["shortcuts"];
  transportUrl?: string;
  rendererPreference: TerminalControlPlaneEntry["rendererPreference"];
  theme: TerminalControlPlaneEntry["theme"];
  cursor: TerminalControlPlaneEntry["cursor"];
}

export interface RuntimeTerminalConfigView extends TerminalConfigView {}

export interface RuntimeTerminalConfigMutationView extends TerminalConfigMutationResult {}

export interface RuntimeSkillView {
  name: string;
  summary: string;
  path: string;
  root: string;
  rootKind: RuntimeSkillRecord["rootKind"];
  writable: boolean;
  packageName?: string;
}

export interface RuntimeSkillInfoView {
  skill: RuntimeSkillView;
  content: string;
}

export interface RuntimeSkillConfigInfoView {
  skill: RuntimeSkillView;
  writable: boolean;
  skillDir: string;
  skillPath: string;
  configPath: string;
  configExists: boolean;
  config: RuntimeSkillConfig | null;
  configError: string | null;
  resolvedWatchTargets: string[];
}

export interface RuntimeSkillMutationView {
  skills: RuntimeSkillView[];
  snapshot: string;
  changedSkills: Array<{
    name: string;
    kind: "added" | "updated" | "removed";
    rootKind: RuntimeSkillRecord["rootKind"] | null;
    changedFiles: string[];
  }>;
  publishedCommitIds: string[];
  created?: boolean;
  removed?: boolean;
  removedPath?: string | null;
  removedRootKind?: "shared" | "global" | "avatar" | null;
  skill?: RuntimeSkillView;
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
    changeType: commit.change.type,
  })),
});

export const projectRuntimeAttentionContext = (context: AttentionContextSnapshot): RuntimeAttentionContextView => ({
  contextId: context.contextId,
  context: {
    owner: context.owner,
    focusState: context.focusState,
    headCommitId: context.headCommitId,
    scoreMap: { ...context.scoreMap },
    contentFormat: context.contentFormat,
    content: context.content,
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
  },
  commits: context.commits.map((commit) => ({
    commitId: commit.commitId,
    summary: commit.summary,
    createdAt: commit.createdAt,
    ingressType: commit.ingressType,
    parentCommitIds: [...commit.parentCommitIds],
    scores: { ...commit.scores },
    src: commit.meta.src,
    tags: Array.isArray(commit.meta.tags) ? [...commit.meta.tags] : undefined,
    change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
  })),
  commitCount: context.commitCount ?? context.commits.length,
  commitsTruncated: context.commitsTruncated ?? false,
});

export const projectRuntimeWorkspaceSurface = (input: {
  mount: WorkspaceMountRecord;
  defaultCwd: string;
  grants: WorkspaceGrantRecord[];
}): RuntimeWorkspaceSurface => ({
  workspaceId: input.mount.runtimeWorkspaceId,
  alias: input.mount.alias,
  cwd: input.defaultCwd,
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
    referencedItems?: readonly MessageRecord[];
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
  items: snapshot.items.map(projectRuntimeMessageItem),
  referencedItems: (input?.referencedItems ?? []).map(projectRuntimeMessageItem),
  nextBefore: snapshot.nextBefore,
  hasMoreBefore: snapshot.hasMoreBefore,
  headVersion: snapshot.headVersion,
});

const projectRuntimeMessageItem = (item: MessageRecord): RuntimeMessageItemView => ({
  rowId: item.rowId,
  messageId: toRuntimeMessageId(item.messageId),
  ref: item.ref,
  from: item.from,
  kind: item.kind,
  content: item.content,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  visibleAt: item.visibleAt,
  attachments: item.attachments?.map(projectRuntimeMessageAttachment),
  payload: item.payload ? ({ ...item.payload } satisfies MessagePayload) : undefined,
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
  launchCwd: terminal.launchCwd,
  workspace: terminal.workspace,
  status: terminal.status,
  processPhase: terminal.processPhase,
  lifecycleTransition: terminal.lifecycleTransition,
  focused: terminal.focused,
  icon: terminal.icon,
  configuredTitle: terminal.configuredTitle,
  currentTitle: terminal.currentTitle,
  currentPath: terminal.currentPath,
  lastStopReason: terminal.lastStopReason,
  lastExitCode: terminal.lastExitCode,
  lastExitSignal: terminal.lastExitSignal,
  lastStoppedAt: terminal.lastStoppedAt,
  shortcuts: terminal.shortcuts,
  transportUrl: terminal.transportUrl,
  rendererPreference: terminal.rendererPreference,
  theme: terminal.theme,
  cursor: terminal.cursor,
});

export const projectRuntimeTerminalConfig = (config: TerminalConfigView): RuntimeTerminalConfigView => ({
  terminalId: config.terminalId,
  processKind: config.processKind,
  command: [...config.command],
  launchCwd: config.launchCwd,
  profile: {
    ...config.profile,
    command: config.profile.command ? [...config.profile.command] : undefined,
    env: config.profile.env ? { ...config.profile.env } : undefined,
    shortcuts: config.profile.shortcuts ? { ...config.profile.shortcuts } : undefined,
  },
  metadata: { ...config.metadata },
  processPhase: config.processPhase,
  lifecycleTransition: config.lifecycleTransition ?? null,
});

export const projectRuntimeTerminalConfigMutation = (
  result: TerminalConfigMutationResult,
): RuntimeTerminalConfigMutationView => ({
  config: projectRuntimeTerminalConfig(result.config),
  appliedLiveFields: [...result.appliedLiveFields],
  nextBootstrapFields: [...result.nextBootstrapFields],
});

export const projectRuntimeSkill = (skill: RuntimeSkillRecord): RuntimeSkillView => ({
  name: skill.name,
  summary: skill.summary,
  path: skill.path,
  root: skill.root,
  rootKind: skill.rootKind,
  writable: skill.writable,
  packageName: skill.packageName,
});

export const projectRuntimeSkillInfo = (input: RuntimeSkillInfo): RuntimeSkillInfoView => ({
  skill: projectRuntimeSkill(input.skill),
  content: input.content,
});

export const projectRuntimeSkillConfigInfo = (input: RuntimeSkillConfigInfo): RuntimeSkillConfigInfoView => ({
  skill: projectRuntimeSkill(input.skill),
  writable: input.writable,
  skillDir: input.skillDir,
  skillPath: input.skillPath,
  configPath: input.configPath,
  configExists: input.configExists,
  config: input.config,
  configError: input.configError,
  resolvedWatchTargets: [...input.resolvedWatchTargets],
});

export const projectRuntimeSkillMutation = (
  input: RuntimeSkillRefreshResult & {
    commitIds: string[];
    created?: boolean;
    removed?: boolean;
    removedPath?: string | null;
    removedRootKind?: "shared" | "global" | "avatar" | null;
    skill?: RuntimeSkillRecord;
  },
): RuntimeSkillMutationView => ({
  skills: input.skills.map(projectRuntimeSkill),
  snapshot: input.snapshot,
  changedSkills: input.changedSkills.map((change) => ({
    name: change.name,
    kind: change.kind,
    rootKind: change.rootKind,
    changedFiles: [...change.changedFiles],
  })),
  publishedCommitIds: [...input.commitIds],
  created: input.created,
  removed: input.removed,
  removedPath: input.removedPath,
  removedRootKind: input.removedRootKind,
  skill: input.skill ? projectRuntimeSkill(input.skill) : undefined,
});
