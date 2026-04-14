import type { ModelCallItem, RuntimeAttentionState } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildHeartbeatAttentionFocusSummary, buildHeartbeatContextState } from "./runtime-heartbeat-statusbar-state";

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

describe("Feature: Runtime Heartbeat statusbar selectors", () => {
  test("Scenario: Given the latest model call includes usage When building context state Then the footer exposes prompt completion and total tokens", () => {
    expect(buildHeartbeatContextState([settledCall])).toEqual({
      kind: "available",
      modelCallId: 41,
      status: "done",
      promptTokens: 320,
      completionTokens: 152,
      totalTokens: 472,
    });
  });

  test("Scenario: Given the latest model call is still running without usage When building context state Then the footer falls back to unavailable instead of guessing", () => {
    expect(buildHeartbeatContextState([settledCall, runningCallWithoutUsage])).toEqual({
      kind: "unavailable",
      modelCallId: 42,
      status: "running",
    });
  });

  test("Scenario: Given attention contexts and a running AI call When building shimmer summary Then the footer groups focused background and muted counts with running state", () => {
    expect(buildHeartbeatAttentionFocusSummary(attentionState, [runningCallWithoutUsage])).toEqual({
      focused: 1,
      background: 1,
      muted: 1,
      total: 3,
      running: true,
      labelParts: ["1 focused", "1 background", "1 muted"],
    });
  });
});
