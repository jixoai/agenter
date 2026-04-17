import type {
  CachedResourceState,
  HeartbeatGroupItem,
  ModelCallItem,
  RuntimeAttentionState,
  RuntimeSchedulerState,
} from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import {
  buildHeartbeatAttentionFocusSummary,
  buildHeartbeatContextState,
  buildHeartbeatStatusState,
} from "./runtime-heartbeat-statusbar-state";

const settledCall: ModelCallItem = {
  id: 41,
  cycleId: 8,
  roundIndex: 8,
  kind: "model",
  status: "done",
  provider: "openai/chat",
  model: "gpt-test",
  providerSnapshot: {
    providerId: "default",
    apiStandard: "openai-responses",
    vendor: "openai",
    profile: null,
    model: "gpt-test",
    maxContextTokens: 128_000,
  },
  requestUrl: "https://example.test/v1/chat/completions",
  request: { meta: { cycleId: 8 } },
  response: {
    assistant: { text: "All set." },
    usage: {
      promptTokens: 320,
      completionTokens: 152,
      totalTokens: 472,
    },
  },
  error: null,
  outcome: { code: "done" },
  createdAt: 1712931900000,
  updatedAt: 1712931950000,
  completedAt: 1712931950000,
  isComplete: true,
};

const runningCallWithoutUsage: ModelCallItem = {
  ...settledCall,
  id: 42,
  status: "running",
  response: {
    assistant: { text: "Streaming..." },
  },
  createdAt: 1712931960000,
  updatedAt: 1712931970000,
  completedAt: null,
  isComplete: false,
};

const compactCall: ModelCallItem = {
  ...settledCall,
  id: 43,
  kind: "compact",
  response: {
    usage: {
      promptTokens: 4096,
      completionTokens: 128,
      totalTokens: 4224,
    },
  },
  createdAt: 1712931980000,
  updatedAt: 1712931990000,
  completedAt: 1712931990000,
};

const usageOnlyCall: ModelCallItem = {
  ...settledCall,
  id: 44,
  providerSnapshot: {
    providerId: "fallback",
    apiStandard: "openai-responses",
    vendor: "openai",
    profile: null,
    model: "gpt-usage-only",
    maxContextTokens: null,
  },
  request: {
    meta: { cycleId: 8 },
    config: {
      maxToken: 64_000,
    },
  },
};

const previousRoundModelCall: ModelCallItem = {
  ...settledCall,
  id: 35,
  roundIndex: 7,
  response: {
    assistant: { text: "Earlier round reply." },
    usage: {
      promptTokens: 900,
      completionTokens: 80,
      totalTokens: 980,
    },
  },
  createdAt: 1712931700000,
  updatedAt: 1712931710000,
  completedAt: 1712931710000,
};

const previousRoundCompactCall: ModelCallItem = {
  ...compactCall,
  id: 36,
  roundIndex: 7,
  createdAt: 1712931720000,
  updatedAt: 1712931730000,
  completedAt: 1712931730000,
  response: {
    usage: {
      promptTokens: 1024,
      completionTokens: 32,
      totalTokens: 1056,
    },
  },
};

const currentRoundEarlierCall: ModelCallItem = {
  ...settledCall,
  id: 40,
  roundIndex: 8,
  response: {
    assistant: { text: "Tool follow-up." },
    usage: {
      promptTokens: 280,
      completionTokens: 48,
      totalTokens: 328,
    },
  },
  createdAt: 1712931800000,
  updatedAt: 1712931810000,
  completedAt: 1712931810000,
};

const failedCall: ModelCallItem = {
  ...settledCall,
  id: 39,
  roundIndex: 7,
  status: "error",
  isComplete: true,
  response: {
    usage: {
      promptTokens: 10_000,
      completionTokens: 999,
      totalTokens: 10_999,
    },
  },
  error: { message: "provider failed" },
  outcome: { code: "error" },
  createdAt: 1712931790000,
  updatedAt: 1712931795000,
  completedAt: 1712931795000,
};

const attentionState: RuntimeAttentionState = {
  snapshot: {
    contexts: [
      {
        contextId: "ctx-room",
        owner: "message",
        focusState: "focused",
        content: "Room context",
        contentFormat: "markdown",
        scoreMap: { room: 1 },
        headCommitId: "commit-1",
        createdAt: "2026-04-12T14:25:00.000Z",
        updatedAt: "2026-04-12T14:26:00.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
        consumedPushCommitIds: [],
      },
      {
        contextId: "ctx-workspace",
        owner: "workspace",
        focusState: "background",
        content: "Workspace context",
        contentFormat: "markdown",
        scoreMap: {},
        headCommitId: "commit-2",
        createdAt: "2026-04-12T14:25:10.000Z",
        updatedAt: "2026-04-12T14:26:10.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
        consumedPushCommitIds: [],
      },
      {
        contextId: "ctx-terminal",
        owner: "terminal",
        focusState: "muted",
        content: "Terminal context",
        contentFormat: "markdown",
        scoreMap: {},
        headCommitId: "commit-3",
        createdAt: "2026-04-12T14:25:20.000Z",
        updatedAt: "2026-04-12T14:26:20.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
        consumedPushCommitIds: [],
      },
    ],
  },
  active: [],
  cycleFrames: [],
  hooks: [],
};

const createHeartbeatGroupsState = (
  overrides?: Partial<CachedResourceState<HeartbeatGroupItem[]>>,
): CachedResourceState<HeartbeatGroupItem[]> => ({
  data: [],
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: Date.now(),
  ...overrides,
});

const createSchedulerState = (overrides?: Partial<RuntimeSchedulerState>): RuntimeSchedulerState => ({
  schemaVersion: 2,
  stateVersion: 1,
  running: false,
  paused: false,
  runtimeStatus: "idle",
  phase: "stopped",
  gate: "open",
  queueSize: 0,
  cycle: 0,
  sentBatches: 0,
  updatedAt: 0,
  lastMessageAt: null,
  lastResponseAt: null,
  lastWakeAt: null,
  lastWakeSource: null,
  lastWakeCause: null,
  activeContextCount: 0,
  activeItemCount: 0,
  unresolvedScoreCount: 0,
  waitingReason: null,
  nextAutoWakeAt: null,
  backoffMs: null,
  retryCount: 0,
  blockedReason: null,
  lastProgressAt: null,
  lastError: null,
  ...overrides,
});

describe("Feature: Runtime Heartbeat statusbar selectors", () => {
  test("Scenario: Given retained ai_call facts across two rounds When building context state Then footer aggregates current-round output against prior-round input", () => {
    expect(
      buildHeartbeatContextState([
        previousRoundModelCall,
        previousRoundCompactCall,
        failedCall,
        currentRoundEarlierCall,
        settledCall,
      ]),
    ).toEqual({
      kind: "available",
      modelCallId: 41,
      status: "done",
      providerLabel: "default · gpt-test",
      inputTokens: 112,
      outputTokens: 200,
      cachedInputTokens: null,
      reasoningTokens: null,
      usedTokens: 312,
      maxContextTokens: 128_000,
      progress: 312 / 128_000,
      remainingTokens: 128_000 - 312,
    });
  });

  test("Scenario: Given the latest model call only exposes usage totals When building context state Then footer falls back to request maxToken so context progress remains objective", () => {
    expect(buildHeartbeatContextState([usageOnlyCall])).toEqual({
      kind: "available",
      modelCallId: 44,
      status: "done",
      providerLabel: "fallback · gpt-usage-only",
      inputTokens: 0,
      outputTokens: 152,
      cachedInputTokens: null,
      reasoningTokens: null,
      usedTokens: 152,
      maxContextTokens: 64_000,
      progress: 152 / 64_000,
      remainingTokens: 64_000 - 152,
    });
  });

  test("Scenario: Given the operator updates max tokens in current config When building context state Then the current config budget overrides the stale ai_call budget", () => {
    expect(buildHeartbeatContextState([usageOnlyCall], 200_000)).toEqual({
      kind: "available",
      modelCallId: 44,
      status: "done",
      providerLabel: "fallback · gpt-usage-only",
      inputTokens: 0,
      outputTokens: 152,
      cachedInputTokens: null,
      reasoningTokens: null,
      usedTokens: 152,
      maxContextTokens: 200_000,
      progress: 152 / 200_000,
      remainingTokens: 200_000 - 152,
    });
  });

  test("Scenario: Given the latest model call is still running without usage When building context state Then the footer preserves aggregated round truth instead of collapsing to unavailable", () => {
    expect(
      buildHeartbeatContextState([previousRoundModelCall, currentRoundEarlierCall, settledCall, runningCallWithoutUsage]),
    ).toEqual({
      kind: "available",
      modelCallId: 42,
      status: "running",
      providerLabel: "default · gpt-test",
      inputTokens: 80,
      outputTokens: 200,
      cachedInputTokens: null,
      reasoningTokens: null,
      usedTokens: 280,
      maxContextTokens: 128_000,
      progress: 280 / 128_000,
      remainingTokens: 128_000 - 280,
    });
  });

  test("Scenario: Given the latest model call is a compact cycle When building context state Then the footer resets instead of reusing pre-compact usage", () => {
    expect(buildHeartbeatContextState([settledCall, compactCall])).toEqual({
      kind: "unavailable",
      modelCallId: 43,
      status: "done",
      providerLabel: "default · gpt-test",
      maxContextTokens: 128_000,
    });
  });

  test("Scenario: Given scheduler waiting truth and a warm refresh When building footer status Then runtime state and resource hint are composed objectively", () => {
    expect(
      buildHeartbeatStatusState({
        sessionStatus: "running",
        schedulerState: createSchedulerState({
          runtimeStatus: "waiting",
          waitingReason: "attention_debt",
        }),
        heartbeatGroups: createHeartbeatGroupsState({
          refreshing: true,
        }),
      }),
    ).toEqual({
      label: "Waiting",
      detail: "Attention Debt · Refreshing Heartbeat",
      animated: false,
      tone: "warning",
    });
  });

  test("Scenario: Given attention contexts When building shimmer summary Then focused background and muted counts stay objective", () => {
    expect(buildHeartbeatAttentionFocusSummary(attentionState)).toEqual({
      focused: 1,
      background: 1,
      muted: 1,
      total: 3,
      labelParts: ["1 focused", "1 background", "1 muted"],
    });
  });
});
