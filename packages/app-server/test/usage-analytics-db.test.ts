import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { UsageAnalyticsDb } from "../src/usage-analytics-db";
import type { UsageAnalyticsFactInput } from "../src/usage-analytics-types";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createUsageDb = (): UsageAnalyticsDb => {
  const root = mkdtempSync(join(tmpdir(), "agenter-usage-analytics-"));
  tempRoots.push(root);
  return new UsageAnalyticsDb(join(root, "usage.db"));
};

const createFact = (overrides: Partial<UsageAnalyticsFactInput> = {}): UsageAnalyticsFactInput => ({
  principalId: "principal-1",
  sessionId: "session-1",
  aiCallId: 1,
  cycleId: 8,
  roundIndex: 8,
  kind: "model",
  status: "done",
  providerId: "default",
  apiStandard: "openai-responses",
  vendor: "openai",
  profile: null,
  model: "gpt-test",
  createdAt: Date.UTC(2026, 3, 12, 14, 25, 0),
  completedAt: Date.UTC(2026, 3, 12, 14, 25, 5),
  inputTokens: 120,
  outputTokens: 48,
  totalTokens: 168,
  cachedInputTokens: 20,
  reasoningTokens: 10,
  uncachedInputTokens: 100,
  maxContextTokens: 128_000,
  ...overrides,
});

describe("Feature: usage analytics ledger projection", () => {
  test("Scenario: Given raw ai_call token facts When the same call is upserted and queried Then totals stay deduplicated and optional token fields stay objective", () => {
    const db = createUsageDb();
    try {
      db.upsertFact(createFact());
      db.upsertFact(
        createFact({
          aiCallId: 1,
          inputTokens: 150,
          outputTokens: 60,
          totalTokens: 210,
          cachedInputTokens: 30,
          reasoningTokens: 12,
          uncachedInputTokens: 120,
        }),
      );
      db.upsertFact(
        createFact({
          aiCallId: 2,
          cycleId: 9,
          createdAt: Date.UTC(2026, 3, 12, 14, 40, 0),
          completedAt: Date.UTC(2026, 3, 12, 14, 40, 6),
          inputTokens: 80,
          outputTokens: 20,
          totalTokens: 100,
          cachedInputTokens: null,
          reasoningTokens: null,
          uncachedInputTokens: null,
        }),
      );

      const result = db.query("principal-1", {
        sinceMs: Date.UTC(2026, 3, 12, 14, 20, 0),
        untilMs: Date.UTC(2026, 3, 12, 15, 0, 0),
        granularity: "raw",
      });

      expect(result.granularity).toBe("raw");
      expect(result.items).toHaveLength(2);
      expect(result.totals).toEqual({
        callCount: 2,
        inputTokens: 230,
        outputTokens: 80,
        totalTokens: 310,
        cachedInputTokens: {
          value: 30,
          knownCallCount: 1,
        },
        reasoningTokens: {
          value: 12,
          knownCallCount: 1,
        },
        uncachedInputTokens: {
          value: 120,
          knownCallCount: 1,
        },
      });
    } finally {
      db.close();
    }
  });

  test("Scenario: Given a long time window When analytics are queried with auto granularity Then the ledger rolls up to day buckets instead of returning raw rows", () => {
    const db = createUsageDb();
    try {
      db.upsertFact(createFact());
      db.upsertFact(
        createFact({
          aiCallId: 2,
          cycleId: 9,
          createdAt: Date.UTC(2026, 3, 18, 10, 0, 0),
          completedAt: Date.UTC(2026, 3, 18, 10, 0, 4),
          inputTokens: 64,
          outputTokens: 16,
          totalTokens: 80,
          cachedInputTokens: null,
          reasoningTokens: null,
          uncachedInputTokens: null,
        }),
      );

      const result = db.query("principal-1", {
        sinceMs: Date.UTC(2026, 3, 12, 0, 0, 0),
        untilMs: Date.UTC(2026, 3, 20, 0, 0, 0),
        granularity: "auto",
      });

      expect(result.granularity).toBe("day");
      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.callCount)).toEqual([1, 1]);
    } finally {
      db.close();
    }
  });
});
