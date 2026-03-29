import type {
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
  ObservabilityTraceItem as RuntimeTraceItem,
} from "@agenter/client-sdk";

import {
  buildCycleAttentionDetail,
  type CycleAttentionDetailView,
  EMPTY_RUNTIME_ATTENTION_STATE,
} from "../attention/attention-view-model";

export interface CycleStatusMeta {
  label: string;
  toneClassName: string;
}

export interface CycleTimelineSummary {
  headline: string;
  detail: string;
}

export interface CycleContextBucketView {
  key: string;
  contextId: string;
  owner: string | null;
  inputContexts: CycleAttentionDetailView["inputContexts"];
  inputCommits: CycleAttentionDetailView["inputCommits"];
  activeContexts: CycleAttentionDetailView["activeContexts"];
  producedCommits: CycleAttentionDetailView["producedCommits"];
}

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

const collectCycleContextIds = (detail: CycleAttentionDetailView): Set<string> =>
  new Set(
    [...detail.inputContexts, ...detail.inputCommits, ...detail.activeContexts, ...detail.producedCommits]
      .map((entry) => entry.contextId)
      .filter((contextId) => contextId.length > 0),
  );

const buildFallbackHeadline = (cycle: RuntimeChatCycle, detail: CycleAttentionDetailView): string => {
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

export const formatCycleTitle = (cycle: RuntimeChatCycle, fallbackOrdinal?: number): string => {
  if (cycle.cycleId === null) {
    return fallbackOrdinal ? `Pending cycle ${fallbackOrdinal}` : "Pending cycle";
  }
  return `Cycle ${cycle.cycleId}`;
};

export const formatCycleBadge = (cycle: RuntimeChatCycle, fallbackOrdinal?: number): string => {
  if (cycle.cycleId === null) {
    return fallbackOrdinal ? `P${fallbackOrdinal}` : "Pending";
  }
  return `#${cycle.cycleId}`;
};

export const getCycleStatusMeta = (cycle: RuntimeChatCycle): CycleStatusMeta => {
  switch (cycle.status) {
    case "error":
      return { label: "Error", toneClassName: "bg-rose-100 text-rose-700" };
    case "streaming":
      return { label: "Streaming", toneClassName: "bg-teal-100 text-teal-700" };
    case "collecting":
      return { label: "Collecting", toneClassName: "bg-amber-100 text-amber-700" };
    case "applying":
      return { label: "Applying", toneClassName: "bg-sky-100 text-sky-700" };
    case "pending":
      return { label: "Pending", toneClassName: "bg-slate-100 text-slate-600" };
    default:
      return { label: "Done", toneClassName: "bg-emerald-100 text-emerald-700" };
  }
};

export const buildCycleTimelineSummary = (input: {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  traces?: RuntimeTraceItem[];
}): CycleTimelineSummary => {
  const detail = buildCycleAttentionDetail(input);
  const contextCount = collectCycleContextIds(detail).size;
  const deliveredCount = detail.hooks.filter((record) => record.status === "delivered").length;
  const failedCount = detail.hooks.filter((record) => record.status === "failed").length;
  const headline =
    (input.cycle.kind === "compact" ? null : detail.producedCommits[0]?.title) ??
    detail.activeContexts[0]?.title ??
    detail.inputCommits[0]?.title ??
    detail.inputContexts[0]?.title ??
    buildFallbackHeadline(input.cycle, detail);

  const parts = [
    input.cycle.wakeSource ? `wake ${input.cycle.wakeSource}` : null,
    input.cycle.kind === "compact" && input.cycle.compactTrigger ? `trigger ${input.cycle.compactTrigger}` : null,
    contextCount > 0 ? pluralize(contextCount, "context") : null,
    detail.inputContexts.length > 0 ? `${detail.inputContexts.length} in` : null,
    detail.inputCommits.length > 0 ? `${detail.inputCommits.length} input commits` : null,
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

export const buildCycleContextBuckets = (detail: CycleAttentionDetailView): CycleContextBucketView[] => {
  const buckets = new Map<string, CycleContextBucketView>();

  const ensureBucket = (contextId: string, owner: string | null): CycleContextBucketView => {
    const existing = buckets.get(contextId);
    if (existing) {
      return existing;
    }
      const next: CycleContextBucketView = {
        key: contextId,
        contextId,
        owner,
        inputContexts: [],
        inputCommits: [],
        activeContexts: [],
        producedCommits: [],
      };
    buckets.set(contextId, next);
    return next;
  };

  for (const context of detail.inputContexts) {
    ensureBucket(context.contextId, context.owner).inputContexts.push(context);
  }
  for (const commit of detail.inputCommits) {
    ensureBucket(commit.contextId, commit.owner).inputCommits.push(commit);
  }
  for (const context of detail.activeContexts) {
    ensureBucket(context.contextId, context.owner).activeContexts.push(context);
  }
  for (const commit of detail.producedCommits) {
    ensureBucket(commit.contextId, commit.owner).producedCommits.push(commit);
  }

  return [...buckets.values()].sort((left, right) => {
    const leftWeight =
      left.producedCommits.length * 10 + left.activeContexts.length * 5 + left.inputCommits.length * 3 + left.inputContexts.length;
    const rightWeight =
      right.producedCommits.length * 10 + right.activeContexts.length * 5 + right.inputCommits.length * 3 + right.inputContexts.length;
    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight;
    }
    return left.contextId.localeCompare(right.contextId);
  });
};

export const buildCycleInspectorDetail = (input: {
  cycle: RuntimeChatCycle;
  attention?: RuntimeAttentionState;
  modelCalls?: ModelCallItem[];
  traces?: RuntimeTraceItem[];
}) => {
  const detail = buildCycleAttentionDetail({
    cycle: input.cycle,
    attention: input.attention ?? EMPTY_RUNTIME_ATTENTION_STATE,
    modelCalls: input.modelCalls ?? [],
    traces: input.traces ?? [],
  });
  const contextBuckets = buildCycleContextBuckets(detail);
  const deliveredCount = detail.hooks.filter((record) => record.status === "delivered").length;
  const failedCount = detail.hooks.filter((record) => record.status === "failed").length;

  return {
    detail,
    contextBuckets,
    summary: buildCycleTimelineSummary(input),
    metrics: {
      wakeSource: detail.frame?.wakeSource ?? input.cycle.wakeSource ?? "manual",
      protocolMode: detail.frame?.protocolMode ?? "none",
      contextCount: collectCycleContextIds(detail).size,
      inputCommitCount: detail.inputCommits.length,
      deliveredCount,
      failedCount,
      remainingActiveCount: detail.activeContexts.length,
      compactTrigger: input.cycle.kind === "compact" ? (input.cycle.compactTrigger ?? null) : null,
    },
  };
};
