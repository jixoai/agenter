import type { CachedResourceState, HeartbeatGroupItem, ModelCallItem, RuntimeAttentionState, RuntimeSchedulerState } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import type { RuntimeHeartbeatProviderMetadata } from "./runtime-heartbeat-config-state";
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

const providerMetadata: RuntimeHeartbeatProviderMetadata = {
  providerId: "default",
  model: "gpt-test",
  maxContextTokens: 128_000,
  pricingCurrency: "USD",
  pricingBands: [
    {
      upToTokens: 128_000,
      inputPerMillion: 2.5,
      cachedInputPerMillion: null,
      outputPerMillion: 10,
    },
  ],
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
  test("Scenario: Given latest model-call usage and provider metadata When building context state Then footer exposes tokens progress and estimated cost", () => {
    expect(buildHeartbeatContextState([settledCall], providerMetadata)).toEqual({
      kind: "available",
      modelCallId: 41,
      status: "done",
      providerLabel: "default · gpt-test",
      promptTokens: 320,
      completionTokens: 152,
      totalTokens: 472,
      maxContextTokens: 128_000,
      progress: 472 / 128_000,
      remainingTokens: 128_000 - 472,
      estimatedCost: {
        currency: "USD",
        inputCost: (320 / 1_000_000) * 2.5,
        outputCost: (152 / 1_000_000) * 10,
        totalCost: (320 / 1_000_000) * 2.5 + (152 / 1_000_000) * 10,
        bandLimitTokens: 128_000,
        estimated: true,
      },
    });
  });

  test("Scenario: Given the latest model call is still running without usage When building context state Then the footer falls back to unavailable instead of guessing", () => {
    expect(buildHeartbeatContextState([settledCall, runningCallWithoutUsage], providerMetadata)).toEqual({
      kind: "unavailable",
      modelCallId: 42,
      status: "running",
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
