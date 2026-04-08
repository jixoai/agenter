import type {
  ModelCallItem,
  ObservabilityTraceItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
} from "@agenter/client-sdk";

import { formatCycleLabel } from "./runtime-shell-format";

type AttentionContextView = RuntimeAttentionState["snapshot"]["contexts"][number];
type AttentionCommitView = AttentionContextView["commits"][number];
type AttentionCycleFrameView = RuntimeAttentionState["cycleFrames"][number];
type AttentionHookView = RuntimeAttentionState["hooks"][number];
type AttentionCommitRefView = AttentionCycleFrameView["inputCommitRefs"][number];

type BadgeVariant = "outline" | "secondary" | "destructive";

interface AttentionScoreSummaryView {
  text: string | null;
  activeCount: number;
  maxScore: number;
}

export interface RuntimeCycleTimelineSummary {
  headline: string;
  detail: string;
}

export interface RuntimeCycleResolvedContextView {
  key: string;
  contextId: string;
  owner: string | null;
  title: string;
  detail: string | null;
  scoreSummary: string | null;
}

export interface RuntimeCycleResolvedCommitView {
  key: string;
  contextId: string;
  commitId: string;
  owner: string | null;
  title: string;
  detail: string | null;
  scoreSummary: string | null;
}

export interface RuntimeCycleTimelineItem {
  id: string;
  cycle: RuntimeChatCycle;
  active: boolean;
  title: string;
  badgeLabel: string;
  statusLabel: string;
  statusVariant: BadgeVariant;
  compactTrigger: string | null;
  headline: string;
  detail: string;
}

export interface RuntimeCycleDetailModel {
  cycle: RuntimeChatCycle;
  title: string;
  badgeLabel: string;
  statusLabel: string;
  statusVariant: BadgeVariant;
  compactTrigger: string | null;
  summary: RuntimeCycleTimelineSummary;
  frame: AttentionCycleFrameView | null;
  inputContexts: RuntimeCycleResolvedContextView[];
  inputCommits: RuntimeCycleResolvedCommitView[];
  activeContexts: RuntimeCycleResolvedContextView[];
  producedCommits: RuntimeCycleResolvedCommitView[];
  hooks: AttentionHookView[];
  modelCalls: ModelCallItem[];
  primaryModelCall: ModelCallItem | null;
  traces: ObservabilityTraceItem[];
  modelConfig: {
    systemPrompt: string;
    requestMeta: Record<string, unknown>;
    requestMessages: unknown[];
    requestTools: unknown[];
    response: unknown;
    error: unknown;
    outcome: unknown;
  };
  metrics: {
    wakeSource: string;
    protocolMode: AttentionCycleFrameView["protocolMode"] | "none";
    contextCount: number;
    inputCount: number;
    outputCount: number;
    liveCount: number;
    inputCommitCount: number;
    producedCommitCount: number;
    remainingActiveCount: number;
    deliveredCount: number;
    failedCount: number;
    traceCount: number;
    compactTrigger: string | null;
  };
}

export const EMPTY_RUNTIME_ATTENTION_STATE: RuntimeAttentionState = {
  snapshot: { contexts: [] },
  active: [],
  cycleFrames: [],
  hooks: [],
};

type LooseRecord = Record<string, unknown>;

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

const asRecord = (value: unknown): LooseRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const humanizeToken = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value.replaceAll("_", " ");
};

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

const getCycleStatusMeta = (cycle: RuntimeChatCycle): { label: string; variant: BadgeVariant } => {
  switch (cycle.status) {
    case "error":
      return { label: "Error", variant: "destructive" };
    case "streaming":
      return { label: "Streaming", variant: "secondary" };
    case "collecting":
      return { label: "Collecting", variant: "secondary" };
    case "applying":
      return { label: "Applying", variant: "secondary" };
    case "pending":
      return { label: "Pending", variant: "outline" };
    default:
      return { label: "Done", variant: "outline" };
  }
};

const buildAttentionScoreSummary = (scores: Record<string, number>): AttentionScoreSummaryView | null => {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return null;
  }
  const activeScores = entries.map(([, score]) => score).filter((score) => score > 0);
  return {
    text:
      activeScores.length > 0
        ? `${activeScores.length} active · max ${Math.max(...activeScores)}`
        : `${entries.length} resolved`,
    activeCount: activeScores.length,
    maxScore: activeScores.length > 0 ? Math.max(...activeScores) : 0,
  };
};

const compareAttentionItemsByRecency = (left: AttentionCommitView, right: AttentionCommitView): number => {
  const delta = parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
  if (delta !== 0) {
    return delta;
  }
  return right.commitId.localeCompare(left.commitId);
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

const buildAttentionContextSnapshot = (
  attention: RuntimeAttentionState,
  contextId: string,
): {
  context: AttentionContextView;
  headCommit: AttentionCommitView | null;
  scoreSummary: AttentionScoreSummaryView | null;
} | null => {
  const context = attention.snapshot.contexts.find((entry) => entry.contextId === contextId) ?? null;
  if (!context) {
    return null;
  }
  const headCommit =
    (context.headCommitId ? context.commits.find((commit) => commit.commitId === context.headCommitId) : undefined) ??
    [...context.commits].sort(compareAttentionItemsByRecency)[0] ??
    null;
  return {
    context,
    headCommit,
    scoreSummary: buildAttentionScoreSummary(context.scoreMap),
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

const resolveContextView = (attention: RuntimeAttentionState, contextId: string): RuntimeCycleResolvedContextView => {
  const snapshot = buildAttentionContextSnapshot(attention, contextId);
  const context = snapshot?.context ?? null;
  return {
    key: contextId,
    contextId,
    owner: context?.owner ?? null,
    title: snapshot?.headCommit?.summary ?? context?.content.trim().split(/\r?\n/gu)[0] ?? contextId,
    detail: context?.content || getCommitDetailText(snapshot?.headCommit),
    scoreSummary: snapshot?.scoreSummary?.text ?? null,
  };
};

const resolveCommitView = (
  attention: RuntimeAttentionState,
  lookup: ReturnType<typeof buildContextLookup>,
  ref: AttentionCommitRefView,
): RuntimeCycleResolvedCommitView => {
  const resolved = lookup.commitsByRef.get(buildCommitKey(ref.contextId, ref.commitId));
  return {
    key: buildCommitKey(ref.contextId, ref.commitId),
    contextId: ref.contextId,
    commitId: ref.commitId,
    owner: resolved?.context.owner ?? null,
    title: resolved?.commit.summary ?? ref.commitId,
    detail: getCommitDetailText(resolved?.commit),
    scoreSummary: resolved ? (buildAttentionScoreSummary(resolved.commit.scores)?.text ?? null) : null,
  };
};

const findCycleModelCall = (cycle: RuntimeChatCycle, modelCalls: ModelCallItem[]): ModelCallItem | null => {
  if (cycle.modelCallId !== null) {
    const byId = modelCalls.find((entry) => entry.id === cycle.modelCallId);
    if (byId) {
      return byId;
    }
  }
  if (cycle.cycleId === null) {
    return null;
  }
  const candidates = modelCalls.filter((entry) => entry.cycleId === cycle.cycleId);
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((latest, current) => (current.id > latest.id ? current : latest));
};

const buildCycleAttentionDetail = (input: {
  cycle: RuntimeChatCycle;
  attention: RuntimeAttentionState;
  modelCalls: ModelCallItem[];
  traces: ObservabilityTraceItem[];
}) => {
  const lookup = buildContextLookup(input.attention);
  const cycleId = input.cycle.cycleId ?? null;
  const frame =
    cycleId === null ? null : (input.attention.cycleFrames.find((entry) => entry.cycleId === cycleId) ?? null);
  const hookIds = new Set(frame?.hookIds ?? []);
  const modelCallIds = new Set(frame?.modelCallIds ?? []);
  const traces = input.traces.filter((trace) => trace.cycleId === cycleId);
  const modelCalls = input.modelCalls.filter((call) => call.cycleId === cycleId || modelCallIds.has(call.id));
  const hooks = input.attention.hooks.filter(
    (record) => (cycleId !== null && record.cycleId === cycleId) || hookIds.has(record.id),
  );

  return {
    frame,
    inputContexts: (frame?.inputContextIds ?? []).map((contextId) => resolveContextView(input.attention, contextId)),
    inputCommits: (frame?.inputCommitRefs ?? []).map((ref) => resolveCommitView(input.attention, lookup, ref)),
    activeContexts: (frame?.activeContextIds ?? []).map((contextId) => resolveContextView(input.attention, contextId)),
    producedCommits: (frame?.producedCommitRefs ?? []).map((ref) => resolveCommitView(input.attention, lookup, ref)),
    hooks,
    modelCalls,
    traces,
  };
};

const buildFallbackHeadline = (
  cycle: RuntimeChatCycle,
  detail: ReturnType<typeof buildCycleAttentionDetail>,
): string => {
  if (cycle.kind === "compact") {
    return cycle.compactTrigger ? `Compact cycle (${cycle.compactTrigger})` : "Compact cycle";
  }
  const delivered = detail.hooks.find((record) => record.status === "delivered");
  if (delivered?.systemId === "message") {
    return "Delivered chat reply";
  }
  if (detail.activeContexts.length > 0) {
    return "Attention remains active";
  }
  if (detail.producedCommits.length > 0) {
    return "Attention cycle committed";
  }
  if (cycle.streaming?.content.trim().length) {
    return "Streaming attention work";
  }
  return "Attention cycle";
};

export const buildRuntimeCycleTimelineSummary = (input: {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState | null;
  modelCalls?: ModelCallItem[];
  traces?: ObservabilityTraceItem[];
}): RuntimeCycleTimelineSummary => {
  const detail = buildCycleAttentionDetail({
    cycle: input.cycle,
    attention: input.attention ?? EMPTY_RUNTIME_ATTENTION_STATE,
    modelCalls: input.modelCalls ?? [],
    traces: input.traces ?? [],
  });
  const contextIds = new Set<string>();
  for (const context of detail.inputContexts) {
    contextIds.add(context.contextId);
  }
  for (const context of detail.activeContexts) {
    contextIds.add(context.contextId);
  }
  for (const commit of [...detail.inputCommits, ...detail.producedCommits]) {
    contextIds.add(commit.contextId);
  }
  const deliveredCount = detail.hooks.filter((record) => record.status === "delivered").length;
  const failedCount = detail.hooks.filter((record) => record.status === "failed").length;
  const headline =
    (input.cycle.kind === "compact" ? null : detail.producedCommits[0]?.title) ??
    detail.activeContexts[0]?.title ??
    detail.inputCommits[0]?.title ??
    detail.inputContexts[0]?.title ??
    buildFallbackHeadline(input.cycle, detail);

  const parts = [
    input.cycle.wakeSource ? `wake ${humanizeToken(input.cycle.wakeSource)}` : null,
    input.cycle.kind === "compact" && input.cycle.compactTrigger
      ? `trigger ${humanizeToken(input.cycle.compactTrigger)}`
      : null,
    contextIds.size > 0 ? pluralize(contextIds.size, "context") : null,
    detail.inputCommits.length > 0 ? `${detail.inputCommits.length} inputs` : null,
    detail.producedCommits.length > 0 ? `${detail.producedCommits.length} commits` : null,
    detail.activeContexts.length > 0 ? `${detail.activeContexts.length} active` : "resolved",
    deliveredCount > 0 ? `${deliveredCount} delivered` : null,
    failedCount > 0 ? `${failedCount} failed` : null,
  ].filter((part): part is string => part !== null);

  return {
    headline,
    detail: parts.join(" · "),
  };
};

export const buildRuntimeCycleTimelineItems = (input: {
  cycles: RuntimeChatCycle[];
  activeCycle: RuntimeChatCycle | null;
  attention?: RuntimeAttentionState | null;
  modelCalls?: ModelCallItem[];
  traces?: ObservabilityTraceItem[];
}): RuntimeCycleTimelineItem[] => {
  return [...(input.cycles ?? [])].reverse().map((cycle) => {
    const status = getCycleStatusMeta(cycle);
    const summary = buildRuntimeCycleTimelineSummary({
      cycle,
      attention: input.attention,
      modelCalls: input.modelCalls,
      traces: input.traces,
    });
    return {
      id: cycle.id,
      cycle,
      active: input.activeCycle?.id === cycle.id,
      title: cycle.cycleId === null ? "Pending cycle" : `Cycle ${formatCycleLabel(cycle.cycleId)}`,
      badgeLabel: cycle.cycleId === null ? "Pending" : `#${cycle.cycleId}`,
      statusLabel: status.label,
      statusVariant: status.variant,
      compactTrigger: humanizeToken(cycle.compactTrigger),
      headline: summary.headline,
      detail: summary.detail,
    };
  });
};

export const buildRuntimeCycleDetailModel = (input: {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState | null;
  modelCalls?: ModelCallItem[];
  traces?: ObservabilityTraceItem[];
}): RuntimeCycleDetailModel => {
  const attention = input.attention ?? EMPTY_RUNTIME_ATTENTION_STATE;
  const detail = buildCycleAttentionDetail({
    cycle: input.cycle,
    attention,
    modelCalls: input.modelCalls ?? [],
    traces: input.traces ?? [],
  });
  const primaryModelCall = findCycleModelCall(input.cycle, detail.modelCalls);
  const requestRecord = asRecord(primaryModelCall?.request);
  const summary = buildRuntimeCycleTimelineSummary(input);
  const deliveredCount = detail.hooks.filter((record) => record.status === "delivered").length;
  const failedCount = detail.hooks.filter((record) => record.status === "failed").length;
  const contextIds = new Set<string>();
  for (const context of detail.inputContexts) {
    contextIds.add(context.contextId);
  }
  for (const context of detail.activeContexts) {
    contextIds.add(context.contextId);
  }
  for (const commit of [...detail.inputCommits, ...detail.producedCommits]) {
    contextIds.add(commit.contextId);
  }
  const status = getCycleStatusMeta(input.cycle);

  return {
    cycle: input.cycle,
    title: input.cycle.cycleId === null ? "Pending cycle" : `Cycle ${formatCycleLabel(input.cycle.cycleId)}`,
    badgeLabel: input.cycle.cycleId === null ? "Pending" : `#${input.cycle.cycleId}`,
    statusLabel: status.label,
    statusVariant: status.variant,
    compactTrigger: humanizeToken(input.cycle.compactTrigger),
    summary,
    frame: detail.frame,
    inputContexts: detail.inputContexts,
    inputCommits: detail.inputCommits,
    activeContexts: detail.activeContexts,
    producedCommits: detail.producedCommits,
    hooks: detail.hooks,
    modelCalls: detail.modelCalls,
    primaryModelCall,
    traces: detail.traces,
    modelConfig: {
      systemPrompt: asString(requestRecord?.systemPrompt),
      requestMeta: (asRecord(requestRecord?.meta) ?? {}) as Record<string, unknown>,
      requestMessages: asArray(requestRecord?.messages),
      requestTools: asArray(requestRecord?.tools),
      response: primaryModelCall?.response ?? null,
      error: primaryModelCall?.error ?? null,
      outcome: primaryModelCall?.outcome ?? null,
    },
    metrics: {
      wakeSource: humanizeToken(detail.frame?.wakeSource ?? input.cycle.wakeSource) ?? "manual",
      protocolMode: detail.frame?.protocolMode ?? "none",
      contextCount: contextIds.size,
      inputCount: input.cycle.inputs.length,
      outputCount: input.cycle.outputs.length,
      liveCount: input.cycle.liveMessages.length,
      inputCommitCount: detail.inputCommits.length,
      producedCommitCount: detail.producedCommits.length,
      remainingActiveCount: detail.activeContexts.length,
      deliveredCount,
      failedCount,
      traceCount: detail.traces.length,
      compactTrigger: humanizeToken(input.cycle.compactTrigger),
    },
  };
};
