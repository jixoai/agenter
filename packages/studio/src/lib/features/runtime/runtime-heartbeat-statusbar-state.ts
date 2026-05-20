import type {
  CachedResourceState,
  HeartbeatGroupItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeSchedulerState,
  SessionEntry,
} from "@agenter/client-sdk";

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

export const buildHeartbeatContextState = (
  modelCalls: ReadonlyArray<ModelCallItem>,
  configuredMaxContextTokens?: number | null,
): RuntimeHeartbeatContextState => {
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
