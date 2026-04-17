import type { AiApiStandard } from "@agenter/settings";

import type { ResolvedSessionConfig } from "./session-config";

export interface ProviderSnapshot {
  providerId: string;
  apiStandard: AiApiStandard;
  vendor: string | null;
  profile: string | null;
  model: string;
  maxContextTokens: number | null;
}

export interface TokenUsageSnapshot {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  uncachedInputTokens: number | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNonNegativeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const isAiApiStandard = (value: unknown): value is AiApiStandard =>
  value === "gemini" ||
  value === "anthropic" ||
  value === "openai-chat" ||
  value === "openai-completion" ||
  value === "openai-responses";

export const buildProviderSnapshot = (config: ResolvedSessionConfig | null): ProviderSnapshot | null => {
  if (!config) {
    return null;
  }
  return {
    providerId: config.ai.providerId,
    apiStandard: config.ai.apiStandard,
    vendor: config.ai.vendor ?? null,
    profile: config.ai.profile ?? null,
    model: config.ai.model,
    maxContextTokens: config.ai.maxContextTokens ?? null,
  };
};

export const readProviderSnapshot = (value: unknown): ProviderSnapshot | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (typeof record.providerId !== "string" || record.providerId.length === 0) {
    return null;
  }
  if (!isAiApiStandard(record.apiStandard)) {
    return null;
  }
  if (typeof record.model !== "string" || record.model.length === 0) {
    return null;
  }
  return {
    providerId: record.providerId,
    apiStandard: record.apiStandard,
    vendor: typeof record.vendor === "string" && record.vendor.length > 0 ? record.vendor : null,
    profile: typeof record.profile === "string" && record.profile.length > 0 ? record.profile : null,
    model: record.model,
    maxContextTokens: toNonNegativeNumber(record.maxContextTokens),
  };
};

export const readProviderSnapshotFromRequestBody = (value: unknown): ProviderSnapshot | null => {
  const request = asRecord(value);
  const config = asRecord(request?.config);
  return readProviderSnapshot(config?.providerSnapshot);
};

export const normalizeTokenUsage = (value: unknown): TokenUsageSnapshot | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const inputTokens = toNonNegativeNumber(record.inputTokens) ?? toNonNegativeNumber(record.promptTokens);
  const outputTokens = toNonNegativeNumber(record.outputTokens) ?? toNonNegativeNumber(record.completionTokens);
  const cachedInputTokens = toNonNegativeNumber(record.cachedInputTokens);
  const reasoningTokens = toNonNegativeNumber(record.reasoningTokens);
  const uncachedInputTokens = toNonNegativeNumber(record.uncachedInputTokens);
  const totalTokens =
    toNonNegativeNumber(record.totalTokens) ??
    (inputTokens !== null || outputTokens !== null || reasoningTokens !== null
      ? (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
      : null);
  if (
    inputTokens === null &&
    outputTokens === null &&
    totalTokens === null &&
    cachedInputTokens === null &&
    reasoningTokens === null &&
    uncachedInputTokens === null
  ) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    reasoningTokens,
    uncachedInputTokens,
  };
};
