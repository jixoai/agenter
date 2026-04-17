import type { SessionAiCallRecord } from "@agenter/session-system";
import type { AiApiStandard } from "@agenter/settings";

export type UsageAnalyticsResolvedGranularity = "raw" | "day" | "month" | "year";
export type UsageAnalyticsGranularity = "auto" | UsageAnalyticsResolvedGranularity;

export interface UsageAnalyticsQueryFilters {
  sessionId?: string;
  kind?: string;
  providerId?: string;
  model?: string;
}

export interface UsageAnalyticsQuery {
  sinceMs: number;
  untilMs: number;
  granularity?: UsageAnalyticsGranularity;
  filters?: UsageAnalyticsQueryFilters;
}

export interface UsageAnalyticsOptionalMetric {
  value: number;
  knownCallCount: number;
}

export interface UsageAnalyticsTotals {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: UsageAnalyticsOptionalMetric;
  reasoningTokens: UsageAnalyticsOptionalMetric;
  uncachedInputTokens: UsageAnalyticsOptionalMetric;
}

export interface UsageAnalyticsSeriesItem extends UsageAnalyticsTotals {
  bucketStartMs: number;
  bucketEndMs: number;
  granularity: UsageAnalyticsResolvedGranularity;
}

export interface UsageAnalyticsQueryResult {
  granularity: UsageAnalyticsResolvedGranularity;
  sinceMs: number;
  untilMs: number;
  filters: UsageAnalyticsQueryFilters;
  totals: UsageAnalyticsTotals;
  items: UsageAnalyticsSeriesItem[];
}

export interface UsageAnalyticsFactInput {
  principalId: string;
  sessionId: string;
  aiCallId: number;
  cycleId: number | null;
  roundIndex: number;
  kind: string;
  status: Exclude<SessionAiCallRecord["status"], "running">;
  providerId: string;
  apiStandard: AiApiStandard;
  vendor: string | null;
  profile: string | null;
  model: string;
  createdAt: number;
  completedAt: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  uncachedInputTokens: number | null;
  maxContextTokens: number | null;
}
