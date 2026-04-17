import type {
  CachedResourceState,
  HeartbeatGroupItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeSchedulerState,
  SessionEntry,
} from "@agenter/client-sdk";

import type { RuntimeHeartbeatProviderMetadata } from "./runtime-heartbeat-config-state";

export interface RuntimeHeartbeatCostEstimate {
  currency: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  bandLimitTokens: number | null;
  estimated: true;
}

export type RuntimeHeartbeatContextState =
  | { kind: "absent" }
  | {
      kind: "unavailable";
      modelCallId: number;
      status: ModelCallItem["status"];
      providerLabel: string | null;
      maxContextTokens: number | null;
    }
  | {
      kind: "available";
      modelCallId: number;
      status: ModelCallItem["status"];
      providerLabel: string | null;
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number | null;
      reasoningTokens: number | null;
      usedTokens: number;
      maxContextTokens: number | null;
      progress: number | null;
      remainingTokens: number | null;
      estimatedCost: RuntimeHeartbeatCostEstimate | null;
    };

export interface RuntimeHeartbeatAttentionFocusSummary {
  focused: number;
  background: number;
  muted: number;
  total: number;
  labelParts: string[];
}

export interface RuntimeHeartbeatStatusState {
  label: string;
  detail: string | null;
  animated: boolean;
  tone: "default" | "warning" | "destructive";
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toPositiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const toNonNegativeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const readUsage = (
  call: ModelCallItem,
): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  usedTokens: number;
} | null => {
  const response = asRecord(call.response);
  const usage = asRecord(response?.usage);
  if (!usage) {
    return null;
  }
  const inputTokens = toNonNegativeNumber(usage.inputTokens) ?? toNonNegativeNumber(usage.promptTokens) ?? 0;
  const outputTokens = toNonNegativeNumber(usage.outputTokens) ?? toNonNegativeNumber(usage.completionTokens) ?? 0;
  const cachedInputTokens = toNonNegativeNumber(usage.cachedInputTokens);
  const reasoningTokens = toNonNegativeNumber(usage.reasoningTokens);
  const usedTokens =
    toPositiveNumber(usage.totalTokens) ??
    [inputTokens, outputTokens, reasoningTokens ?? 0].reduce((total, value) => total + value, 0);
  if (usedTokens <= 0) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    usedTokens,
  };
};

const compareModelCallsDesc = (left: ModelCallItem, right: ModelCallItem): number => {
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }
  return right.id - left.id;
};

const latestModelCall = (modelCalls: ReadonlyArray<ModelCallItem>): ModelCallItem | null =>
  [...modelCalls].sort(compareModelCallsDesc)[0] ?? null;

const pickPricingBand = (
  providerMetadata: RuntimeHeartbeatProviderMetadata,
  promptTokens: number,
): RuntimeHeartbeatProviderMetadata["pricingBands"][number] | null => {
  const bands = [...providerMetadata.pricingBands].sort((left, right) => {
    if (left.upToTokens === null) {
      return 1;
    }
    if (right.upToTokens === null) {
      return -1;
    }
    return left.upToTokens - right.upToTokens;
  });
  return bands.find((band) => band.upToTokens === null || promptTokens <= band.upToTokens) ?? bands.at(-1) ?? null;
};

const estimateHeartbeatCost = (
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number | null },
  providerMetadata: RuntimeHeartbeatProviderMetadata | null,
): RuntimeHeartbeatCostEstimate | null => {
  if (!providerMetadata?.pricingCurrency || providerMetadata.pricingBands.length === 0) {
    return null;
  }
  const band = pickPricingBand(providerMetadata, usage.inputTokens);
  if (!band) {
    return null;
  }
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
  const inputCost =
    (uncachedInputTokens / 1_000_000) * band.inputPerMillion +
    (cachedInputTokens / 1_000_000) * (band.cachedInputPerMillion ?? band.inputPerMillion);
  const outputCost = (usage.outputTokens / 1_000_000) * band.outputPerMillion;
  return {
    currency: providerMetadata.pricingCurrency,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    bandLimitTokens: band.upToTokens,
    estimated: true,
  };
};

const humanizeToken = (value: string): string =>
  value
    .split(/[_-]/u)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");

const formatDurationLabel = (valueMs: number | null | undefined): string | null => {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs) || valueMs <= 0) {
    return null;
  }
  if (valueMs >= 60_000) {
    return `${Math.round(valueMs / 1000 / 60)} min`;
  }
  if (valueMs >= 1_000) {
    return `${Math.round(valueMs / 1000)} s`;
  }
  return `${Math.round(valueMs)} ms`;
};

const buildResourceHint = (resource: CachedResourceState<HeartbeatGroupItem[]>): string | null => {
  if (!resource.loaded && resource.loading) {
    return "Loading Heartbeat";
  }
  if (!resource.loaded && resource.error) {
    return "Heartbeat load failed";
  }
  if (resource.refreshing) {
    return "Refreshing Heartbeat";
  }
  if (resource.loaded && resource.error) {
    return "Heartbeat refresh failed";
  }
  return null;
};

export const buildHeartbeatContextState = (
  modelCalls: ReadonlyArray<ModelCallItem>,
  providerMetadata: RuntimeHeartbeatProviderMetadata | null,
): RuntimeHeartbeatContextState => {
  const latestCall = latestModelCall(modelCalls);
  if (!latestCall) {
    return { kind: "absent" };
  }
  const providerLabel = providerMetadata
    ? [providerMetadata.providerId, providerMetadata.model].filter(Boolean).join(" · ")
    : null;
  if (latestCall.kind === "compact") {
    return {
      kind: "unavailable",
      modelCallId: latestCall.id,
      status: latestCall.status,
      providerLabel,
      maxContextTokens: providerMetadata?.maxContextTokens ?? null,
    };
  }
  const usage = readUsage(latestCall);
  if (!usage) {
    return {
      kind: "unavailable",
      modelCallId: latestCall.id,
      status: latestCall.status,
      providerLabel,
      maxContextTokens: providerMetadata?.maxContextTokens ?? null,
    };
  }
  const maxContextTokens = providerMetadata?.maxContextTokens ?? null;
  const progress = maxContextTokens ? Math.min(1, usage.usedTokens / maxContextTokens) : null;
  return {
    kind: "available",
    modelCallId: latestCall.id,
    status: latestCall.status,
    providerLabel,
    ...usage,
    maxContextTokens,
    progress,
    remainingTokens: maxContextTokens ? Math.max(0, maxContextTokens - usage.usedTokens) : null,
    estimatedCost: estimateHeartbeatCost(usage, providerMetadata),
  };
};

export const buildHeartbeatAttentionFocusSummary = (
  attention: RuntimeAttentionState | null | undefined,
): RuntimeHeartbeatAttentionFocusSummary => {
  let focused = 0;
  let background = 0;
  let muted = 0;

  for (const context of attention?.snapshot.contexts ?? []) {
    switch (context.focusState) {
      case "background":
        background += 1;
        break;
      case "muted":
        muted += 1;
        break;
      default:
        focused += 1;
        break;
    }
  }

  const labelParts = [
    focused > 0 ? `${focused} focused` : null,
    background > 0 ? `${background} background` : null,
    muted > 0 ? `${muted} muted` : null,
  ].filter((value): value is string => value !== null);

  return {
    focused,
    background,
    muted,
    total: focused + background + muted,
    labelParts,
  };
};

export const buildHeartbeatStatusState = (input: {
  sessionStatus: SessionEntry["status"];
  schedulerState: RuntimeSchedulerState | null | undefined;
  heartbeatGroups: CachedResourceState<HeartbeatGroupItem[]>;
}): RuntimeHeartbeatStatusState => {
  const scheduler = input.schedulerState;
  const resourceHint = buildResourceHint(input.heartbeatGroups);
  let label = "Idle";
  let detail: string | null = null;
  let animated = false;
  let tone: RuntimeHeartbeatStatusState["tone"] = "default";

  if (scheduler) {
    switch (scheduler.runtimeStatus) {
      case "running":
        label = "Running";
        animated = true;
        break;
      case "waiting":
        label = "Waiting";
        tone = "warning";
        detail = scheduler.waitingReason ? humanizeToken(scheduler.waitingReason) : null;
        break;
      case "backoff":
        label = "Backoff";
        tone = "warning";
        detail = [
          scheduler.waitingReason ? humanizeToken(scheduler.waitingReason) : null,
          formatDurationLabel(scheduler.backoffMs),
        ]
          .filter((value): value is string => Boolean(value))
          .join(" · ");
        break;
      case "blocked":
        label = "Blocked";
        tone = "destructive";
        detail = scheduler.blockedReason ?? null;
        break;
      case "paused":
        label = "Paused";
        break;
      default:
        label = "Idle";
        break;
    }
  } else {
    switch (input.sessionStatus) {
      case "starting":
        label = "Starting";
        tone = "warning";
        break;
      case "running":
        label = "Running";
        break;
      case "paused":
        label = "Paused";
        break;
      case "error":
        label = "Error";
        tone = "destructive";
        break;
      case "stopped":
        label = "Stopped";
        break;
      default:
        label = input.sessionStatus;
        break;
    }
  }

  const detailParts = [detail && detail.length > 0 ? detail : null, resourceHint].filter((value): value is string =>
    Boolean(value),
  );
  return {
    label,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    animated,
    tone,
  };
};
