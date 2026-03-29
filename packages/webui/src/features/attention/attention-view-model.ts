import type {
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";

export type AttentionContextView = RuntimeAttentionState["snapshot"]["contexts"][number];
export type AttentionCommitView = AttentionContextView["commits"][number];
export type AttentionCycleFrameView = RuntimeAttentionState["cycleFrames"][number];
export type AttentionHookView = RuntimeAttentionState["hooks"][number];
export type AttentionCommitRefView = AttentionCycleFrameView["inputCommitRefs"][number];

export interface AttentionSelectionState {
  contextId: string | null;
  itemId: string | null;
}

export type AttentionPanelTab = "context" | "items";

export interface AttentionScoreEntryView {
  key: string;
  score: number;
  resolved: boolean;
}

export interface AttentionScoreSummaryView {
  text: string | null;
  activeCount: number;
  resolvedCount: number;
  maxScore: number;
  totalScore: number;
  entries: AttentionScoreEntryView[];
}

export interface AttentionContextSnapshotView {
  context: AttentionContextView;
  headCommit: AttentionCommitView | null;
  activeCount: number;
  commitCount: number;
  commitsTruncated: boolean;
  scoreSummary: AttentionScoreSummaryView | null;
}

export interface ResolvedAttentionContextView {
  key: string;
  contextId: string;
  owner: string | null;
  context: AttentionContextView | null;
  title: string;
  detail: string | null;
  scoreSummary: string | null;
}

export interface ResolvedAttentionCommitView {
  key: string;
  contextId: string;
  commitId: string;
  owner: string | null;
  commit: AttentionCommitView | null;
  title: string;
  detail: string | null;
  scoreSummary: string | null;
}

export interface CycleAttentionDetailView {
  frame: AttentionCycleFrameView | null;
  inputContexts: ResolvedAttentionContextView[];
  inputCommits: ResolvedAttentionCommitView[];
  activeContexts: ResolvedAttentionContextView[];
  producedCommits: ResolvedAttentionCommitView[];
  hooks: AttentionHookView[];
  modelCalls: ModelCallItem[];
  traces: RuntimeTraceItem[];
}

export const EMPTY_RUNTIME_ATTENTION_STATE: RuntimeAttentionState = {
  snapshot: { contexts: [] },
  active: [],
  cycleFrames: [],
  hooks: [],
};

const buildCommitKey = (contextId: string, commitId: string): string => `${contextId}:${commitId}`;

const parseTimestamp = (value: string | number | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string" || value.length === 0) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildContextLookup = (attention: RuntimeAttentionState) => {
  const commitsByRef = new Map<string, { context: AttentionContextView; commit: AttentionCommitView }>();

  for (const context of attention.snapshot.contexts) {
    for (const commit of context.commits) {
      commitsByRef.set(buildCommitKey(context.contextId, commit.commitId), { context, commit });
    }
  }

  return { commitsByRef };
};

export const compareAttentionItemsByRecency = (left: AttentionCommitView, right: AttentionCommitView): number => {
  const delta = parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
  if (delta !== 0) {
    return delta;
  }
  return right.commitId.localeCompare(left.commitId);
};

export const buildAttentionScoreSummary = (scores: Record<string, number>): AttentionScoreSummaryView | null => {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return null;
  }

  const nextEntries = entries
    .map(([key, score]) => ({
      key,
      score,
      resolved: score <= 0,
    }))
    .sort((left, right) => {
      if (left.resolved !== right.resolved) {
        return left.resolved ? 1 : -1;
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.key.localeCompare(right.key);
    });

  const activeCount = nextEntries.filter((entry) => !entry.resolved).length;
  const resolvedCount = nextEntries.length - activeCount;
  const maxScore = nextEntries.reduce((max, entry) => Math.max(max, entry.score), 0);
  const totalScore = nextEntries.reduce((sum, entry) => sum + entry.score, 0);
  const parts: string[] = [];
  if (activeCount > 0) {
    parts.push(`${activeCount} active`);
    parts.push(`max ${maxScore}`);
  }
  if (resolvedCount > 0) {
    parts.push(`${resolvedCount} resolved`);
  }

  return {
    text: parts.length > 0 ? parts.join(" · ") : null,
    activeCount,
    resolvedCount,
    maxScore,
    totalScore,
    entries: nextEntries,
  };
};

export const buildAttentionContextSnapshot = (
  attention: RuntimeAttentionState,
  contextId: string | null | undefined,
): AttentionContextSnapshotView | null => {
  const context = attention.snapshot.contexts.find((entry) => entry.contextId === contextId) ?? null;
  if (!context) {
    return null;
  }

  const activeCount = Object.values(context.scoreMap).filter((score) => score > 0).length;
  const headCommit =
    (context.headCommitId ? context.commits.find((commit) => commit.commitId === context.headCommitId) : undefined) ??
    [...context.commits].sort(compareAttentionItemsByRecency)[0] ??
    null;

  return {
    context,
    headCommit,
    activeCount,
    commitCount: context.commitCount ?? context.commits.length,
    commitsTruncated: context.commitsTruncated ?? false,
    scoreSummary: buildAttentionScoreSummary(context.scoreMap),
  };
};

export const sortAttentionContexts = (
  attention: RuntimeAttentionState = EMPTY_RUNTIME_ATTENTION_STATE,
): AttentionContextView[] => {
  return [...attention.snapshot.contexts].sort((left, right) => {
    const leftSummary = buildAttentionScoreSummary(left.scoreMap);
    const rightSummary = buildAttentionScoreSummary(right.scoreMap);
    const leftActive = leftSummary?.activeCount ?? 0;
    const rightActive = rightSummary?.activeCount ?? 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    const leftScore = leftSummary?.maxScore ?? 0;
    const rightScore = rightSummary?.maxScore ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftUpdated = parseTimestamp(left.updatedAt);
    const rightUpdated = parseTimestamp(right.updatedAt);
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }

    return left.contextId.localeCompare(right.contextId);
  });
};

export const selectDefaultItemId = (
  context: AttentionContextView | undefined,
  _attention: RuntimeAttentionState = EMPTY_RUNTIME_ATTENTION_STATE,
): string | null => {
  if (!context) {
    return null;
  }
  return context.headCommitId ?? [...context.commits].sort(compareAttentionItemsByRecency)[0]?.commitId ?? null;
};

export const deriveAttentionSelection = (
  attention: RuntimeAttentionState,
  input?: Partial<AttentionSelectionState> | null,
): AttentionSelectionState => {
  const contexts = sortAttentionContexts(attention);
  if (contexts.length === 0) {
    return { contextId: null, itemId: null };
  }

  const selectedContext = contexts.find((context) => context.contextId === input?.contextId) ?? contexts[0]!;
  const itemId =
    selectedContext.commits.find((commit) => commit.commitId === input?.itemId)?.commitId ??
    selectDefaultItemId(selectedContext, attention);

  return {
    contextId: selectedContext.contextId,
    itemId,
  };
};

const getCommitDetailText = (commit: AttentionCommitView | null | undefined): string | null => {
  if (!commit) {
    return null;
  }
  if (commit.change.type === "clean") {
    return null;
  }
  return commit.change.value;
};

const resolveContextView = (attention: RuntimeAttentionState, contextId: string): ResolvedAttentionContextView => {
  const context = attention.snapshot.contexts.find((entry) => entry.contextId === contextId) ?? null;
  const snapshot = context ? buildAttentionContextSnapshot(attention, contextId) : null;
  return {
    key: contextId,
    contextId,
    owner: context?.owner ?? null,
    context,
    title: snapshot?.headCommit?.summary ?? context?.content.trim().split(/\r?\n/g)[0] ?? contextId,
    detail: context?.content || getCommitDetailText(snapshot?.headCommit),
    scoreSummary: snapshot?.scoreSummary?.text ?? null,
  };
};

const resolveCommitView = (
  attention: RuntimeAttentionState,
  ref: AttentionCommitRefView,
): ResolvedAttentionCommitView => {
  const lookup = buildContextLookup(attention).commitsByRef.get(buildCommitKey(ref.contextId, ref.commitId));
  return {
    key: buildCommitKey(ref.contextId, ref.commitId),
    contextId: ref.contextId,
    commitId: ref.commitId,
    owner: lookup?.context.owner ?? null,
    commit: lookup?.commit ?? null,
    title: lookup?.commit.summary ?? ref.commitId,
    detail: getCommitDetailText(lookup?.commit),
    scoreSummary: lookup ? (buildAttentionScoreSummary(lookup.commit.scores)?.text ?? null) : null,
  };
};

export const buildCycleAttentionDetail = (input: {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  traces?: RuntimeTraceItem[];
}): CycleAttentionDetailView => {
  const attention = input.attention ?? EMPTY_RUNTIME_ATTENTION_STATE;
  const cycleId = input.cycle.cycleId ?? null;
  const frame = cycleId === null ? null : (attention.cycleFrames.find((entry) => entry.cycleId === cycleId) ?? null);
  const hookIds = new Set(frame?.hookIds ?? []);
  const modelCallIds = new Set(frame?.modelCallIds ?? []);
  const traces = (input.traces ?? []).filter((trace) => trace.cycleId === cycleId);
  const modelCalls = (input.modelCalls ?? []).filter((call) => call.cycleId === cycleId || modelCallIds.has(call.id));
  const hooks = attention.hooks.filter(
    (record) => (cycleId !== null && record.cycleId === cycleId) || hookIds.has(record.id),
  );

  return {
    frame,
    inputContexts: (frame?.inputContextIds ?? []).map((contextId) => resolveContextView(attention, contextId)),
    inputCommits: (frame?.inputCommitRefs ?? []).map((ref) => resolveCommitView(attention, ref)),
    activeContexts: (frame?.activeContextIds ?? []).map((contextId) => resolveContextView(attention, contextId)),
    producedCommits: (frame?.producedCommitRefs ?? []).map((ref) => resolveCommitView(attention, ref)),
    hooks,
    modelCalls,
    traces,
  };
};
