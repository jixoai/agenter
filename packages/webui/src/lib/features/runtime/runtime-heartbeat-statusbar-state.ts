import type { ModelCallItem, RuntimeAttentionState } from "@agenter/client-sdk";

export type RuntimeHeartbeatContextState =
  | { kind: "absent" }
  | {
      kind: "unavailable";
      modelCallId: number;
      status: ModelCallItem["status"];
    }
  | {
      kind: "available";
      modelCallId: number;
      status: ModelCallItem["status"];
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };

export interface RuntimeHeartbeatAttentionFocusSummary {
  focused: number;
  background: number;
  muted: number;
  total: number;
  running: boolean;
  labelParts: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readUsage = (
  call: ModelCallItem,
): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null => {
  const response = asRecord(call.response);
  const usage = asRecord(response?.usage);
  if (!usage) {
    return null;
  }
  const promptTokens = typeof usage.promptTokens === "number" ? usage.promptTokens : null;
  const completionTokens = typeof usage.completionTokens === "number" ? usage.completionTokens : null;
  const totalTokens = typeof usage.totalTokens === "number" ? usage.totalTokens : null;
  if (promptTokens === null || completionTokens === null || totalTokens === null) {
    return null;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens,
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

const latestModelCalls = (modelCalls: ReadonlyArray<ModelCallItem>): ModelCallItem[] => {
  return [...modelCalls].sort(compareModelCallsDesc);
};

export const buildHeartbeatContextState = (modelCalls: ReadonlyArray<ModelCallItem>): RuntimeHeartbeatContextState => {
  const latestCall = latestModelCalls(modelCalls)[0];
  if (!latestCall) {
    return { kind: "absent" };
  }
  const usage = readUsage(latestCall);
  if (!usage) {
    return {
      kind: "unavailable",
      modelCallId: latestCall.id,
      status: latestCall.status,
    };
  }
  return {
    kind: "available",
    modelCallId: latestCall.id,
    status: latestCall.status,
    ...usage,
  };
};

export const buildHeartbeatAttentionFocusSummary = (
  attention: RuntimeAttentionState | null | undefined,
  modelCalls: ReadonlyArray<ModelCallItem>,
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

  const latestCall = latestModelCalls(modelCalls)[0] ?? null;
  const running = latestCall?.status === "running";
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
    running,
    labelParts,
  };
};
