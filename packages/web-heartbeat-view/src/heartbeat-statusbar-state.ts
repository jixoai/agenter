import type {
  CachedResourceState,
  HeartbeatConfigBinding,
  HeartbeatGroupItem,
  HeartbeatLivePushStatus,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeSchedulerState,
  SessionEntry,
} from "./types";

export type HeartbeatContextState =
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
    };

export interface HeartbeatAttentionFocusSummary {
  focused: number;
  background: number;
  muted: number;
  total: number;
  labelParts: string[];
}

export interface HeartbeatStatusState {
  label: string;
  detail: string | null;
  animated: boolean;
  tone: "default" | "warning" | "destructive";
}

export interface HeartbeatModelConfigSummary {
  modelLabel: string;
  configLabel: string;
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

const readCallOutputTokens = (call: ModelCallItem): number | null => {
  const response = asRecord(call.response);
  const usage = asRecord(response?.usage);
  if (!usage) {
    return null;
  }
  return toNonNegativeNumber(usage.outputTokens) ?? toNonNegativeNumber(usage.completionTokens);
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

const isSuccessfulCompletedCall = (call: ModelCallItem): boolean => call.isComplete && call.status === "done";

const readProviderSnapshot = (
  call: ModelCallItem,
): {
  providerLabel: string | null;
  maxContextTokens: number | null;
} => {
  const snapshot = asRecord(call.providerSnapshot);
  const request = asRecord(call.request);
  const config = asRecord(request?.config);
  const providerId =
    typeof snapshot?.providerId === "string" && snapshot.providerId.length > 0 ? snapshot.providerId : call.provider;
  const model = typeof snapshot?.model === "string" && snapshot.model.length > 0 ? snapshot.model : call.model;
  return {
    providerLabel:
      [providerId, model].filter((part) => typeof part === "string" && part.length > 0).join(" · ") || null,
    maxContextTokens:
      toPositiveNumber(snapshot?.maxContextTokens) ??
      toPositiveNumber(config?.maxContextTokens) ??
      toPositiveNumber(config?.maxToken),
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

export const formatHeartbeatContextLabel = (contextState: HeartbeatContextState): string => {
  if (contextState.kind === "absent") {
    return "No model call";
  }
  if (contextState.kind === "unavailable") {
    return contextState.providerLabel ? `${contextState.providerLabel} · usage unavailable` : "Usage unavailable";
  }
  const max = contextState.maxContextTokens ? ` / ${contextState.maxContextTokens}` : "";
  return `${contextState.usedTokens}${max} tokens`;
};

export const formatHeartbeatTokenCount = (value: number): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return value.toLocaleString("en-US");
};

export const formatHeartbeatContextPercentLabel = (contextState: HeartbeatContextState): string => {
  if (contextState.kind !== "available" || contextState.progress === null) {
    return "Usage";
  }
  return `${(contextState.progress * 100).toFixed(1)}%`;
};

export const formatHeartbeatContextUsedLimitLabel = (contextState: HeartbeatContextState): string => {
  if (contextState.kind === "absent") {
    return "No model call";
  }
  if (contextState.kind === "unavailable") {
    return contextState.maxContextTokens
      ? `Usage unavailable / ${formatHeartbeatTokenCount(contextState.maxContextTokens)}`
      : "Usage unavailable";
  }
  if (contextState.maxContextTokens) {
    return `${formatHeartbeatTokenCount(contextState.usedTokens)} / ${formatHeartbeatTokenCount(contextState.maxContextTokens)}`;
  }
  return `${formatHeartbeatTokenCount(contextState.usedTokens)} used`;
};

export const resolveHeartbeatConfiguredContextLimit = (configBinding: HeartbeatConfigBinding | null | undefined): number | null =>
  configBinding?.providerMetadata?.maxContextTokens ?? configBinding?.draft.maxToken ?? null;

export const buildHeartbeatModelConfigSummary = (
  configBinding: HeartbeatConfigBinding | null | undefined,
  contextState: HeartbeatContextState,
): HeartbeatModelConfigSummary => {
  const modelLabel =
    configBinding?.providerLabel ??
    (contextState.kind !== "absent" && contextState.providerLabel ? contextState.providerLabel : "Model unavailable");
  const draft = configBinding?.draft;
  const configParts = draft
    ? [
        draft.temperature !== null ? `temperature:${draft.temperature}` : null,
        draft.topK !== null ? `topK:${draft.topK}` : null,
        draft.maxToken !== null ? `max:${draft.maxToken}` : null,
        `thinking:${draft.thinkingEnabled ? "true" : "false"}`,
        draft.thinkingBudgetTokens !== null ? `thinkingBudget:${draft.thinkingBudgetTokens}` : null,
      ].filter((value): value is string => value !== null)
    : [];
  return {
    modelLabel,
    configLabel: configParts.length > 0 ? configParts.join(" · ") : "No config facts available",
  };
};

export const formatHeartbeatAttentionLabel = (attentionSummary: HeartbeatAttentionFocusSummary): string =>
  attentionSummary.total > 0 ? attentionSummary.labelParts.join(" · ") : "No attention contexts";

const formatLivePushLabel = (livePushStatus: HeartbeatLivePushStatus | undefined): string => {
  switch (livePushStatus) {
    case "active":
      return "Live push active";
    case "inactive":
      return "No live push";
    default:
      return "Live push unknown";
  }
};

export const buildHeartbeatSubnavbarTitle = (input: {
  statusState: HeartbeatStatusState;
  contextState: HeartbeatContextState;
  attentionSummary: HeartbeatAttentionFocusSummary;
  recordCount: number;
  recordCountVisible: boolean;
  livePushStatus?: HeartbeatLivePushStatus;
}): string => {
  const statusLabel = input.statusState.detail
    ? `${input.statusState.label}: ${input.statusState.detail}`
    : input.statusState.label;
  const recordLabel = input.recordCountVisible
    ? `${input.recordCount} ${input.recordCount === 1 ? "record" : "records"}`
    : null;
  const attentionLabel = input.attentionSummary.total > 0 ? formatHeartbeatAttentionLabel(input.attentionSummary) : null;
  return [
    statusLabel,
    formatLivePushLabel(input.livePushStatus),
    recordLabel,
    attentionLabel,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" · ");
};

export const buildHeartbeatContextState = (
  modelCalls: ReadonlyArray<ModelCallItem>,
  configuredMaxContextTokens?: number | null,
): HeartbeatContextState => {
  const latestCall = latestModelCall(modelCalls);
  if (!latestCall) {
    return { kind: "absent" };
  }
  const providerSnapshot = readProviderSnapshot(latestCall);
  const resolvedMaxContextTokens = toPositiveNumber(configuredMaxContextTokens) ?? providerSnapshot.maxContextTokens;
  if (latestCall.kind === "compact") {
    return {
      kind: "unavailable",
      modelCallId: latestCall.id,
      status: latestCall.status,
      providerLabel: providerSnapshot.providerLabel,
      maxContextTokens: resolvedMaxContextTokens,
    };
  }
  const currentRoundIndex = latestCall.roundIndex;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const call of modelCalls) {
    if (!isSuccessfulCompletedCall(call)) {
      continue;
    }
    const completionTokens = readCallOutputTokens(call);
    if (completionTokens === null || completionTokens <= 0) {
      continue;
    }
    if (call.roundIndex === currentRoundIndex) {
      outputTokens += completionTokens;
      continue;
    }
    if (call.roundIndex < currentRoundIndex) {
      inputTokens += completionTokens;
    }
  }

  const usedTokens = inputTokens + outputTokens;
  if (usedTokens <= 0) {
    return {
      kind: "unavailable",
      modelCallId: latestCall.id,
      status: latestCall.status,
      providerLabel: providerSnapshot.providerLabel,
      maxContextTokens: resolvedMaxContextTokens,
    };
  }
  const maxContextTokens = resolvedMaxContextTokens;
  const progress = maxContextTokens ? Math.min(1, usedTokens / maxContextTokens) : null;
  return {
    kind: "available",
    modelCallId: latestCall.id,
    status: latestCall.status,
    providerLabel: providerSnapshot.providerLabel,
    inputTokens,
    outputTokens,
    cachedInputTokens: null,
    reasoningTokens: null,
    usedTokens,
    maxContextTokens,
    progress,
    remainingTokens: maxContextTokens ? Math.max(0, maxContextTokens - usedTokens) : null,
  };
};

export const buildHeartbeatAttentionFocusSummary = (
  attention: RuntimeAttentionState | null | undefined,
): HeartbeatAttentionFocusSummary => {
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
}): HeartbeatStatusState => {
  const scheduler = input.schedulerState;
  const resourceHint = buildResourceHint(input.heartbeatGroups);
  let label = "Idle";
  let detail: string | null = null;
  let animated = false;
  let tone: HeartbeatStatusState["tone"] = "default";

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
