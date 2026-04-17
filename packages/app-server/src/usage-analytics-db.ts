import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database, type SQLQueryBindings } from "bun:sqlite";

import type {
  UsageAnalyticsFactInput,
  UsageAnalyticsOptionalMetric,
  UsageAnalyticsQuery,
  UsageAnalyticsQueryFilters,
  UsageAnalyticsQueryResult,
  UsageAnalyticsResolvedGranularity,
  UsageAnalyticsSeriesItem,
  UsageAnalyticsTotals,
} from "./usage-analytics-types";

const DAY_MS = 24 * 60 * 60 * 1_000;
const RAW_FACT_RETENTION_MS = 7 * DAY_MS;
const DAY_BUCKET_RETENTION_MS = 30 * DAY_MS;
const MONTH_BUCKET_RETENTION_MS = 365 * DAY_MS;

type BucketTableName = "usage_bucket_day" | "usage_bucket_month" | "usage_bucket_year";

const emptyOptionalMetric = (): UsageAnalyticsOptionalMetric => ({
  value: 0,
  knownCallCount: 0,
});

const emptyTotals = (): UsageAnalyticsTotals => ({
  callCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cachedInputTokens: emptyOptionalMetric(),
  reasoningTokens: emptyOptionalMetric(),
  uncachedInputTokens: emptyOptionalMetric(),
});

const sanitizeFilters = (filters: UsageAnalyticsQueryFilters | undefined): UsageAnalyticsQueryFilters => ({
  sessionId: filters?.sessionId?.trim() || undefined,
  kind: filters?.kind?.trim() || undefined,
  providerId: filters?.providerId?.trim() || undefined,
  model: filters?.model?.trim() || undefined,
});

const toBucketStartMs = (valueMs: number, granularity: Exclude<UsageAnalyticsResolvedGranularity, "raw">): number => {
  const date = new Date(valueMs);
  switch (granularity) {
    case "day":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    case "month":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    case "year":
      return Date.UTC(date.getUTCFullYear(), 0, 1);
  }
};

const toBucketEndMs = (
  bucketStartMs: number,
  granularity: Exclude<UsageAnalyticsResolvedGranularity, "raw">,
): number => {
  const date = new Date(bucketStartMs);
  switch (granularity) {
    case "day":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
    case "month":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    case "year":
      return Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  }
};

export const resolveUsageAnalyticsGranularity = (query: UsageAnalyticsQuery): UsageAnalyticsResolvedGranularity => {
  if (query.granularity && query.granularity !== "auto") {
    return query.granularity;
  }
  const windowMs = Math.max(0, query.untilMs - query.sinceMs);
  if (windowMs <= RAW_FACT_RETENTION_MS) {
    return "raw";
  }
  if (windowMs <= DAY_BUCKET_RETENTION_MS) {
    return "day";
  }
  if (windowMs <= MONTH_BUCKET_RETENTION_MS) {
    return "month";
  }
  return "year";
};

export const createEmptyUsageAnalyticsResult = (input: UsageAnalyticsQuery): UsageAnalyticsQueryResult => ({
  granularity: resolveUsageAnalyticsGranularity(input),
  sinceMs: input.sinceMs,
  untilMs: input.untilMs,
  filters: sanitizeFilters(input.filters),
  totals: emptyTotals(),
  items: [],
});

const bucketTableForGranularity = (granularity: Exclude<UsageAnalyticsResolvedGranularity, "raw">): BucketTableName => {
  switch (granularity) {
    case "day":
      return "usage_bucket_day";
    case "month":
      return "usage_bucket_month";
    case "year":
      return "usage_bucket_year";
  }
};

const vendorKey = (value: string | null | undefined): string => value ?? "";
const profileKey = (value: string | null | undefined): string => value ?? "";

const buildFactWhereClause = (input: {
  principalId: string;
  sessionId: string;
  kind: string;
  status: string;
  providerId: string;
  apiStandard: string;
  vendor: string | null;
  profile: string | null;
  model: string;
  startMs: number;
  endMs: number;
}): { whereSql: string; params: SQLQueryBindings[] } => ({
  whereSql: `principal_id = ? and session_id = ? and kind = ? and status = ? and provider_id = ? and api_standard = ? and vendor = ? and profile = ? and model = ? and event_at >= ? and event_at < ?`,
  params: [
    input.principalId,
    input.sessionId,
    input.kind,
    input.status,
    input.providerId,
    input.apiStandard,
    vendorKey(input.vendor),
    profileKey(input.profile),
    input.model,
    input.startMs,
    input.endMs,
  ],
});

const addQueryFilters = (filters: UsageAnalyticsQueryFilters, params: SQLQueryBindings[], clauses: string[]): void => {
  if (filters.sessionId) {
    clauses.push("session_id = ?");
    params.push(filters.sessionId);
  }
  if (filters.kind) {
    clauses.push("kind = ?");
    params.push(filters.kind);
  }
  if (filters.providerId) {
    clauses.push("provider_id = ?");
    params.push(filters.providerId);
  }
  if (filters.model) {
    clauses.push("model = ?");
    params.push(filters.model);
  }
};

const reduceItemsToTotals = (items: UsageAnalyticsSeriesItem[]): UsageAnalyticsTotals => {
  const totals = emptyTotals();
  for (const item of items) {
    totals.callCount += item.callCount;
    totals.inputTokens += item.inputTokens;
    totals.outputTokens += item.outputTokens;
    totals.totalTokens += item.totalTokens;
    totals.cachedInputTokens.value += item.cachedInputTokens.value;
    totals.cachedInputTokens.knownCallCount += item.cachedInputTokens.knownCallCount;
    totals.reasoningTokens.value += item.reasoningTokens.value;
    totals.reasoningTokens.knownCallCount += item.reasoningTokens.knownCallCount;
    totals.uncachedInputTokens.value += item.uncachedInputTokens.value;
    totals.uncachedInputTokens.knownCallCount += item.uncachedInputTokens.knownCallCount;
  }
  return totals;
};

export class UsageAnalyticsDb {
  private readonly db: Database;

  constructor(filePath: string) {
    const fullPath = resolve(filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    this.db = new Database(fullPath, { create: true, strict: true });
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  upsertFact(input: UsageAnalyticsFactInput): void {
    this.db.exec("begin immediate");
    try {
      this.db
        .query(
          `insert into usage_fact (
             principal_id,
             session_id,
             ai_call_id,
             cycle_id,
             round_index,
             kind,
             status,
             provider_id,
             api_standard,
             vendor,
             profile,
             model,
             created_at,
             completed_at,
             event_at,
             input_tokens,
             output_tokens,
             total_tokens,
             cached_input_tokens,
             reasoning_tokens,
             uncached_input_tokens,
             max_context_tokens
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           on conflict(session_id, ai_call_id) do update set
             cycle_id = excluded.cycle_id,
             round_index = excluded.round_index,
             kind = excluded.kind,
             status = excluded.status,
             provider_id = excluded.provider_id,
             api_standard = excluded.api_standard,
             vendor = excluded.vendor,
             profile = excluded.profile,
             model = excluded.model,
             created_at = excluded.created_at,
             completed_at = excluded.completed_at,
             event_at = excluded.event_at,
             input_tokens = excluded.input_tokens,
             output_tokens = excluded.output_tokens,
             total_tokens = excluded.total_tokens,
             cached_input_tokens = excluded.cached_input_tokens,
             reasoning_tokens = excluded.reasoning_tokens,
             uncached_input_tokens = excluded.uncached_input_tokens,
             max_context_tokens = excluded.max_context_tokens`,
        )
        .run(
          input.principalId,
          input.sessionId,
          input.aiCallId,
          input.cycleId,
          input.roundIndex,
          input.kind,
          input.status,
          input.providerId,
          input.apiStandard,
          vendorKey(input.vendor),
          profileKey(input.profile),
          input.model,
          input.createdAt,
          input.completedAt,
          input.completedAt,
          input.inputTokens,
          input.outputTokens,
          input.totalTokens,
          input.cachedInputTokens,
          input.reasoningTokens,
          input.uncachedInputTokens,
          input.maxContextTokens,
        );

      this.recomputeBuckets(input, "day");
      this.recomputeBuckets(input, "month");
      this.recomputeBuckets(input, "year");
      this.pruneRetentionWindows(input.completedAt);
      this.db.exec("commit");
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
  }

  query(principalId: string, input: UsageAnalyticsQuery): UsageAnalyticsQueryResult {
    const filters = sanitizeFilters(input.filters);
    const granularity = resolveUsageAnalyticsGranularity(input);
    const items =
      granularity === "raw"
        ? this.queryFacts(principalId, input.sinceMs, input.untilMs, filters)
        : this.queryBuckets(principalId, input.sinceMs, input.untilMs, granularity, filters);
    return {
      granularity,
      sinceMs: input.sinceMs,
      untilMs: input.untilMs,
      filters,
      totals: reduceItemsToTotals(items),
      items,
    };
  }

  private queryFacts(
    principalId: string,
    sinceMs: number,
    untilMs: number,
    filters: UsageAnalyticsQueryFilters,
  ): UsageAnalyticsSeriesItem[] {
    const clauses = ["principal_id = ?", "event_at >= ?", "event_at <= ?"];
    const params: SQLQueryBindings[] = [principalId, sinceMs, untilMs];
    addQueryFilters(filters, params, clauses);
    const rows = this.db
      .query(
        `select
           event_at as bucket_start_ms,
           event_at as bucket_end_ms,
           1 as call_count,
           coalesce(input_tokens, 0) as input_tokens,
           coalesce(output_tokens, 0) as output_tokens,
           coalesce(total_tokens, 0) as total_tokens,
           coalesce(cached_input_tokens, 0) as cached_input_tokens_value,
           case when cached_input_tokens is null then 0 else 1 end as cached_input_tokens_known_count,
           coalesce(reasoning_tokens, 0) as reasoning_tokens_value,
           case when reasoning_tokens is null then 0 else 1 end as reasoning_tokens_known_count,
           coalesce(uncached_input_tokens, 0) as uncached_input_tokens_value,
           case when uncached_input_tokens is null then 0 else 1 end as uncached_input_tokens_known_count
         from usage_fact
         where ${clauses.join(" and ")}
         order by bucket_start_ms asc, ai_call_id asc`,
      )
      .all(...params) as Array<{
      bucket_start_ms: number;
      bucket_end_ms: number;
      call_count: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cached_input_tokens_value: number;
      cached_input_tokens_known_count: number;
      reasoning_tokens_value: number;
      reasoning_tokens_known_count: number;
      uncached_input_tokens_value: number;
      uncached_input_tokens_known_count: number;
    }>;
    return rows.map((row) => ({
      bucketStartMs: row.bucket_start_ms,
      bucketEndMs: row.bucket_end_ms,
      granularity: "raw",
      callCount: row.call_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      cachedInputTokens: {
        value: row.cached_input_tokens_value,
        knownCallCount: row.cached_input_tokens_known_count,
      },
      reasoningTokens: {
        value: row.reasoning_tokens_value,
        knownCallCount: row.reasoning_tokens_known_count,
      },
      uncachedInputTokens: {
        value: row.uncached_input_tokens_value,
        knownCallCount: row.uncached_input_tokens_known_count,
      },
    }));
  }

  private queryBuckets(
    principalId: string,
    sinceMs: number,
    untilMs: number,
    granularity: Exclude<UsageAnalyticsResolvedGranularity, "raw">,
    filters: UsageAnalyticsQueryFilters,
  ): UsageAnalyticsSeriesItem[] {
    const clauses = ["principal_id = ?", "bucket_start_ms < ?", "bucket_end_ms > ?"];
    const params: SQLQueryBindings[] = [principalId, untilMs, sinceMs];
    addQueryFilters(filters, params, clauses);
    const table = bucketTableForGranularity(granularity);
    const rows = this.db
      .query(
        `select
           bucket_start_ms,
           bucket_end_ms,
           sum(call_count) as call_count,
           sum(input_tokens_sum) as input_tokens,
           sum(output_tokens_sum) as output_tokens,
           sum(total_tokens_sum) as total_tokens,
           sum(cached_input_tokens_sum) as cached_input_tokens_value,
           sum(cached_input_tokens_known_count) as cached_input_tokens_known_count,
           sum(reasoning_tokens_sum) as reasoning_tokens_value,
           sum(reasoning_tokens_known_count) as reasoning_tokens_known_count,
           sum(uncached_input_tokens_sum) as uncached_input_tokens_value,
           sum(uncached_input_tokens_known_count) as uncached_input_tokens_known_count
         from ${table}
         where ${clauses.join(" and ")}
         group by bucket_start_ms, bucket_end_ms
         order by bucket_start_ms asc`,
      )
      .all(...params) as Array<{
      bucket_start_ms: number;
      bucket_end_ms: number;
      call_count: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cached_input_tokens_value: number;
      cached_input_tokens_known_count: number;
      reasoning_tokens_value: number;
      reasoning_tokens_known_count: number;
      uncached_input_tokens_value: number;
      uncached_input_tokens_known_count: number;
    }>;
    return rows.map((row) => ({
      bucketStartMs: row.bucket_start_ms,
      bucketEndMs: row.bucket_end_ms,
      granularity,
      callCount: row.call_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      cachedInputTokens: {
        value: row.cached_input_tokens_value,
        knownCallCount: row.cached_input_tokens_known_count,
      },
      reasoningTokens: {
        value: row.reasoning_tokens_value,
        knownCallCount: row.reasoning_tokens_known_count,
      },
      uncachedInputTokens: {
        value: row.uncached_input_tokens_value,
        knownCallCount: row.uncached_input_tokens_known_count,
      },
    }));
  }

  private recomputeBuckets(
    input: UsageAnalyticsFactInput,
    granularity: Exclude<UsageAnalyticsResolvedGranularity, "raw">,
  ): void {
    const bucketStartMs = toBucketStartMs(input.completedAt, granularity);
    const bucketEndMs = toBucketEndMs(bucketStartMs, granularity);
    const { whereSql, params } = buildFactWhereClause({
      principalId: input.principalId,
      sessionId: input.sessionId,
      kind: input.kind,
      status: input.status,
      providerId: input.providerId,
      apiStandard: input.apiStandard,
      vendor: input.vendor,
      profile: input.profile,
      model: input.model,
      startMs: bucketStartMs,
      endMs: bucketEndMs,
    });
    const aggregate = this.db
      .query(
        `select
           count(*) as call_count,
           coalesce(sum(coalesce(input_tokens, 0)), 0) as input_tokens_sum,
           coalesce(sum(coalesce(output_tokens, 0)), 0) as output_tokens_sum,
           coalesce(sum(coalesce(total_tokens, 0)), 0) as total_tokens_sum,
           coalesce(sum(cached_input_tokens), 0) as cached_input_tokens_sum,
           coalesce(sum(case when cached_input_tokens is null then 0 else 1 end), 0) as cached_input_tokens_known_count,
           coalesce(sum(reasoning_tokens), 0) as reasoning_tokens_sum,
           coalesce(sum(case when reasoning_tokens is null then 0 else 1 end), 0) as reasoning_tokens_known_count,
           coalesce(sum(uncached_input_tokens), 0) as uncached_input_tokens_sum,
           coalesce(sum(case when uncached_input_tokens is null then 0 else 1 end), 0) as uncached_input_tokens_known_count
         from usage_fact
         where ${whereSql}`,
      )
      .get(...params) as {
      call_count: number;
      input_tokens_sum: number;
      output_tokens_sum: number;
      total_tokens_sum: number;
      cached_input_tokens_sum: number;
      cached_input_tokens_known_count: number;
      reasoning_tokens_sum: number;
      reasoning_tokens_known_count: number;
      uncached_input_tokens_sum: number;
      uncached_input_tokens_known_count: number;
    };
    const table = bucketTableForGranularity(granularity);
    if (!aggregate || aggregate.call_count <= 0) {
      this.db
        .query(
          `delete from ${table}
           where principal_id = ? and session_id = ? and kind = ? and status = ? and provider_id = ? and api_standard = ? and vendor = ? and profile = ? and model = ? and bucket_start_ms = ?`,
        )
        .run(
          input.principalId,
          input.sessionId,
          input.kind,
          input.status,
          input.providerId,
          input.apiStandard,
          vendorKey(input.vendor),
          profileKey(input.profile),
          input.model,
          bucketStartMs,
        );
      return;
    }
    this.db
      .query(
        `insert into ${table} (
           principal_id,
           session_id,
           kind,
           status,
           provider_id,
           api_standard,
           vendor,
           profile,
           model,
           bucket_start_ms,
           bucket_end_ms,
           call_count,
           input_tokens_sum,
           output_tokens_sum,
           total_tokens_sum,
           cached_input_tokens_sum,
           cached_input_tokens_known_count,
           reasoning_tokens_sum,
           reasoning_tokens_known_count,
           uncached_input_tokens_sum,
           uncached_input_tokens_known_count
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(
           principal_id,
           session_id,
           kind,
           status,
           provider_id,
           api_standard,
           vendor,
           profile,
           model,
           bucket_start_ms
         ) do update set
           bucket_end_ms = excluded.bucket_end_ms,
           call_count = excluded.call_count,
           input_tokens_sum = excluded.input_tokens_sum,
           output_tokens_sum = excluded.output_tokens_sum,
           total_tokens_sum = excluded.total_tokens_sum,
           cached_input_tokens_sum = excluded.cached_input_tokens_sum,
           cached_input_tokens_known_count = excluded.cached_input_tokens_known_count,
           reasoning_tokens_sum = excluded.reasoning_tokens_sum,
           reasoning_tokens_known_count = excluded.reasoning_tokens_known_count,
           uncached_input_tokens_sum = excluded.uncached_input_tokens_sum,
           uncached_input_tokens_known_count = excluded.uncached_input_tokens_known_count`,
      )
      .run(
        input.principalId,
        input.sessionId,
        input.kind,
        input.status,
        input.providerId,
        input.apiStandard,
        vendorKey(input.vendor),
        profileKey(input.profile),
        input.model,
        bucketStartMs,
        bucketEndMs,
        aggregate.call_count,
        aggregate.input_tokens_sum,
        aggregate.output_tokens_sum,
        aggregate.total_tokens_sum,
        aggregate.cached_input_tokens_sum,
        aggregate.cached_input_tokens_known_count,
        aggregate.reasoning_tokens_sum,
        aggregate.reasoning_tokens_known_count,
        aggregate.uncached_input_tokens_sum,
        aggregate.uncached_input_tokens_known_count,
      );
  }

  private pruneRetentionWindows(nowMs: number): void {
    this.db.query(`delete from usage_fact where event_at < ?`).run(nowMs - RAW_FACT_RETENTION_MS);
    this.db.query(`delete from usage_bucket_day where bucket_end_ms < ?`).run(nowMs - DAY_BUCKET_RETENTION_MS);
    this.db.query(`delete from usage_bucket_month where bucket_end_ms < ?`).run(nowMs - MONTH_BUCKET_RETENTION_MS);
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists usage_fact (
        principal_id text not null,
        session_id text not null,
        ai_call_id integer not null,
        cycle_id integer,
        round_index integer not null,
        kind text not null,
        status text not null,
        provider_id text not null,
        api_standard text not null,
        vendor text not null default '',
        profile text not null default '',
        model text not null,
        created_at integer not null,
        completed_at integer not null,
        event_at integer not null,
        input_tokens integer,
        output_tokens integer,
        total_tokens integer,
        cached_input_tokens integer,
        reasoning_tokens integer,
        uncached_input_tokens integer,
        max_context_tokens integer,
        primary key (session_id, ai_call_id)
      );
      create index if not exists usage_fact_principal_event_idx on usage_fact (principal_id, event_at);
      create index if not exists usage_fact_principal_filter_idx on usage_fact (
        principal_id,
        session_id,
        kind,
        provider_id,
        model,
        event_at
      );

      create table if not exists usage_bucket_day (
        principal_id text not null,
        session_id text not null,
        kind text not null,
        status text not null,
        provider_id text not null,
        api_standard text not null,
        vendor text not null default '',
        profile text not null default '',
        model text not null,
        bucket_start_ms integer not null,
        bucket_end_ms integer not null,
        call_count integer not null,
        input_tokens_sum integer not null,
        output_tokens_sum integer not null,
        total_tokens_sum integer not null,
        cached_input_tokens_sum integer not null,
        cached_input_tokens_known_count integer not null,
        reasoning_tokens_sum integer not null,
        reasoning_tokens_known_count integer not null,
        uncached_input_tokens_sum integer not null,
        uncached_input_tokens_known_count integer not null,
        primary key (
          principal_id,
          session_id,
          kind,
          status,
          provider_id,
          api_standard,
          vendor,
          profile,
          model,
          bucket_start_ms
        )
      );
      create index if not exists usage_bucket_day_principal_time_idx on usage_bucket_day (principal_id, bucket_start_ms, bucket_end_ms);

      create table if not exists usage_bucket_month (
        principal_id text not null,
        session_id text not null,
        kind text not null,
        status text not null,
        provider_id text not null,
        api_standard text not null,
        vendor text not null default '',
        profile text not null default '',
        model text not null,
        bucket_start_ms integer not null,
        bucket_end_ms integer not null,
        call_count integer not null,
        input_tokens_sum integer not null,
        output_tokens_sum integer not null,
        total_tokens_sum integer not null,
        cached_input_tokens_sum integer not null,
        cached_input_tokens_known_count integer not null,
        reasoning_tokens_sum integer not null,
        reasoning_tokens_known_count integer not null,
        uncached_input_tokens_sum integer not null,
        uncached_input_tokens_known_count integer not null,
        primary key (
          principal_id,
          session_id,
          kind,
          status,
          provider_id,
          api_standard,
          vendor,
          profile,
          model,
          bucket_start_ms
        )
      );
      create index if not exists usage_bucket_month_principal_time_idx on usage_bucket_month (principal_id, bucket_start_ms, bucket_end_ms);

      create table if not exists usage_bucket_year (
        principal_id text not null,
        session_id text not null,
        kind text not null,
        status text not null,
        provider_id text not null,
        api_standard text not null,
        vendor text not null default '',
        profile text not null default '',
        model text not null,
        bucket_start_ms integer not null,
        bucket_end_ms integer not null,
        call_count integer not null,
        input_tokens_sum integer not null,
        output_tokens_sum integer not null,
        total_tokens_sum integer not null,
        cached_input_tokens_sum integer not null,
        cached_input_tokens_known_count integer not null,
        reasoning_tokens_sum integer not null,
        reasoning_tokens_known_count integer not null,
        uncached_input_tokens_sum integer not null,
        uncached_input_tokens_known_count integer not null,
        primary key (
          principal_id,
          session_id,
          kind,
          status,
          provider_id,
          api_standard,
          vendor,
          profile,
          model,
          bucket_start_ms
        )
      );
      create index if not exists usage_bucket_year_principal_time_idx on usage_bucket_year (principal_id, bucket_start_ms, bucket_end_ms);
    `);
  }
}
