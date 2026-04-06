import type { MessageChannelEntry, RuntimeAttentionState, RuntimeSchedulerState } from "@agenter/client-sdk";

type RuntimeAttentionContextSnapshot = RuntimeAttentionState["snapshot"]["contexts"][number];
type RuntimeAttentionActiveMatch = RuntimeAttentionState["active"][number];

export interface RuntimeContextTerminal {
  terminalId: string;
  title?: string;
  cwd: string;
}

export interface RuntimeContextJumpTarget {
  kind: "room" | "terminal";
  targetId: string;
  label: string;
  actionLabel: "Open" | "Jump";
}

export interface RuntimeAttentionCommitPreview {
  commitId: string;
  summary: string;
  createdAt: string;
  source: string;
}

export interface RuntimeAttentionScoreEntry {
  key: string;
  value: number;
}

export interface RuntimeAttentionContextItem {
  contextId: string;
  source: "active" | "tracked";
  label: string;
  owner: string;
  updatedAt: string;
  commitLabel: string;
  recentCommits: RuntimeAttentionCommitPreview[];
  commitsTruncated: boolean;
  scores: RuntimeAttentionScoreEntry[];
  jumpTarget: RuntimeContextJumpTarget | null;
}

export interface RuntimeSchedulerSignal {
  id: string;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

const ROOM_CONTEXT_PREFIXES = ["ctx-", "ctx-chat-", "ctx-room-"] as const;

const compareIsoTimestampDesc = (left: string, right: string): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return 0;
  }
  if (Number.isNaN(leftTime)) {
    return 1;
  }
  if (Number.isNaN(rightTime)) {
    return -1;
  }
  return rightTime - leftTime;
};

const compareScores = (left: RuntimeAttentionScoreEntry, right: RuntimeAttentionScoreEntry): number => {
  if (left.value !== right.value) {
    return right.value - left.value;
  }
  return left.key.localeCompare(right.key);
};

const toScoreEntries = (scoreMap: Record<string, number>): RuntimeAttentionScoreEntry[] => {
  return Object.entries(scoreMap)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, value }))
    .sort(compareScores);
};

const toCommitPreviews = (
  commits: RuntimeAttentionActiveMatch["recentCommits"] | RuntimeAttentionContextSnapshot["commits"],
): RuntimeAttentionCommitPreview[] => {
  return [...commits]
    .slice(-6)
    .reverse()
    .map((commit) => ({
      commitId: commit.commitId,
      summary: commit.summary,
      createdAt: commit.createdAt,
      source: commit.meta.source,
    }));
};

const resolveRoomJumpTarget = (
  contextId: string,
  channels: ReadonlyArray<Pick<MessageChannelEntry, "chatId" | "title" | "contextId">>,
): RuntimeContextJumpTarget | null => {
  for (const channel of channels) {
    const knownContextIds = new Set<string>(ROOM_CONTEXT_PREFIXES.map((prefix) => `${prefix}${channel.chatId}`));
    if (channel.contextId) {
      knownContextIds.add(channel.contextId);
    }
    if (!knownContextIds.has(contextId)) {
      continue;
    }
    return {
      kind: "room",
      targetId: channel.chatId,
      label: channel.title || channel.chatId,
      actionLabel: "Open",
    };
  }
  return null;
};

const resolveTerminalJumpTarget = (
  contextId: string,
  terminals: ReadonlyArray<RuntimeContextTerminal>,
): RuntimeContextJumpTarget | null => {
  for (const terminal of terminals) {
    if (contextId !== `ctx-terminal-${terminal.terminalId}`) {
      continue;
    }
    return {
      kind: "terminal",
      targetId: terminal.terminalId,
      label: terminal.title || terminal.terminalId,
      actionLabel: "Jump",
    };
  }
  return null;
};

const resolveJumpPriority = (jumpTarget: RuntimeContextJumpTarget | null): number => {
  if (jumpTarget?.kind === "room") {
    return 2;
  }
  if (jumpTarget?.kind === "terminal") {
    return 1;
  }
  return 0;
};

const compareContextItems = (left: RuntimeAttentionContextItem, right: RuntimeAttentionContextItem): number => {
  const priorityDelta = resolveJumpPriority(right.jumpTarget) - resolveJumpPriority(left.jumpTarget);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const updatedDelta = compareIsoTimestampDesc(left.updatedAt, right.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.contextId.localeCompare(right.contextId);
};

export const resolveRuntimeContextJumpTarget = (
  contextId: string,
  channels: ReadonlyArray<Pick<MessageChannelEntry, "chatId" | "title" | "contextId">>,
  terminals: ReadonlyArray<RuntimeContextTerminal>,
): RuntimeContextJumpTarget | null => {
  return resolveRoomJumpTarget(contextId, channels) ?? resolveTerminalJumpTarget(contextId, terminals);
};

export const buildRuntimeAttentionContextItems = (input: {
  attention: RuntimeAttentionState | null | undefined;
  channels: ReadonlyArray<Pick<MessageChannelEntry, "chatId" | "title" | "contextId">>;
  terminals: ReadonlyArray<RuntimeContextTerminal>;
}): RuntimeAttentionContextItem[] => {
  const attention = input.attention;
  if (!attention) {
    return [];
  }

  const activeItems = attention.active.map((match) => {
    const jumpTarget = resolveRuntimeContextJumpTarget(match.contextId, input.channels, input.terminals);
    return {
      contextId: match.contextId,
      source: "active" as const,
      label: jumpTarget?.label ?? match.contextId,
      owner: match.context.owner,
      updatedAt: match.context.updatedAt,
      commitLabel: `${match.recentCommits.length} recent`,
      recentCommits: toCommitPreviews(match.recentCommits),
      commitsTruncated: false,
      scores: toScoreEntries(match.context.scoreMap),
      jumpTarget,
    };
  });

  if (activeItems.length > 0) {
    return activeItems.sort(compareContextItems);
  }

  return attention.snapshot.contexts
    .map((context) => {
      const jumpTarget = resolveRuntimeContextJumpTarget(context.contextId, input.channels, input.terminals);
      const commitCount = context.commitCount ?? context.commits.length;

      return {
        contextId: context.contextId,
        source: "tracked" as const,
        label: jumpTarget?.label ?? context.contextId,
        owner: context.owner,
        updatedAt: context.updatedAt,
        commitLabel: `${commitCount} commits`,
        recentCommits: toCommitPreviews(context.commits),
        commitsTruncated: Boolean(context.commitsTruncated),
        scores: toScoreEntries(context.scoreMap),
        jumpTarget,
      };
    })
    .sort(compareContextItems);
};

export const buildRuntimeSchedulerSignals = (input: {
  schedulerPhase?: string | null;
  schedulerState?: RuntimeSchedulerState | null;
}): RuntimeSchedulerSignal[] => {
  const schedulerState = input.schedulerState;
  if (!schedulerState) {
    return [];
  }

  const signals: RuntimeSchedulerSignal[] = [];
  const phase = input.schedulerPhase?.trim() ?? "";
  const waitingReason = schedulerState.waitingReason?.trim() ?? "";
  const blockedReason = schedulerState.blockedReason?.trim() ?? "";
  const unresolvedScoreCount = schedulerState.unresolvedScoreCount ?? 0;
  const retryCount = schedulerState.retryCount ?? 0;
  const backoffMs = schedulerState.backoffMs ?? 0;

  if (phase && (phase !== "idle" || waitingReason || blockedReason || unresolvedScoreCount > 0)) {
    signals.push({
      id: "phase",
      label: `Phase: ${phase}`,
      variant: blockedReason ? "destructive" : "secondary",
    });
  }
  if (waitingReason && waitingReason !== "idle") {
    signals.push({
      id: "waiting",
      label: `Waiting: ${waitingReason}`,
      variant: "outline",
    });
  }
  if (blockedReason) {
    signals.push({
      id: "blocked",
      label: `Blocked: ${blockedReason}`,
      variant: "destructive",
    });
  }
  if (schedulerState.nextAutoWakeAt) {
    signals.push({
      id: "next-wake",
      label: `Next wake: ${new Date(schedulerState.nextAutoWakeAt).toLocaleString()}`,
      variant: "outline",
    });
  }
  if (unresolvedScoreCount > 0) {
    signals.push({
      id: "unresolved",
      label: `${unresolvedScoreCount} unresolved`,
      variant: "secondary",
    });
  }
  if (retryCount > 0) {
    signals.push({
      id: "retries",
      label: `Retries: ${retryCount}`,
      variant: "outline",
    });
  }
  if (backoffMs > 0) {
    signals.push({
      id: "backoff",
      label: `Backoff: ${backoffMs} ms`,
      variant: "outline",
    });
  }

  return signals;
};
