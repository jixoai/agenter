import { describe, expect, test } from "vitest";

import {
  buildHeartbeatAttentionFocusSummary,
  buildHeartbeatContextState,
  buildHeartbeatStatusState,
  buildHeartbeatSubnavbarTitle,
  createCachedResourceState,
  type ModelCallItem,
} from "../src";

const modelCall = (input: {
  id: number;
  roundIndex: number;
  outputTokens: number;
  updatedAt?: number;
}): ModelCallItem => ({
  id: input.id,
  kind: "chat",
  status: "done",
  provider: "openai",
  model: "gpt-test",
  roundIndex: input.roundIndex,
  createdAt: 1_000 + input.id,
  updatedAt: input.updatedAt ?? 1_000 + input.id,
  isComplete: true,
  providerSnapshot: {
    providerId: "openai",
    model: "gpt-test",
    maxContextTokens: 128_000,
  },
  request: null,
  response: {
    usage: {
      outputTokens: input.outputTokens,
    },
  },
});

describe("Feature: Heartbeat context usage projection", () => {
  test("Scenario: Given model call usage When building status projections Then context detail is available but subnavbar omits token usage", () => {
    const contextState = buildHeartbeatContextState(
      [
        modelCall({ id: 1, roundIndex: 1, outputTokens: 32_000, updatedAt: 1_100 }),
        modelCall({ id: 2, roundIndex: 2, outputTokens: 8_000, updatedAt: 1_200 }),
      ],
      128_000,
    );
    expect(contextState.kind).toBe("available");
    if (contextState.kind !== "available") {
      return;
    }
    expect(contextState.inputTokens).toBe(32_000);
    expect(contextState.outputTokens).toBe(8_000);
    expect(contextState.usedTokens).toBe(40_000);
    expect(contextState.progress).toBeCloseTo(0.3125);

    const statusTitle = buildHeartbeatSubnavbarTitle({
      statusState: buildHeartbeatStatusState({
        sessionStatus: "running",
        schedulerState: { runtimeStatus: "running" },
        heartbeatGroups: { ...createCachedResourceState([]), loaded: true },
      }),
      contextState,
      attentionSummary: buildHeartbeatAttentionFocusSummary({ snapshot: { contexts: [{ focusState: "focused" }] } }),
      recordCount: 2,
      recordCountVisible: true,
      livePushStatus: "active",
    });

    expect(statusTitle).toContain("Running");
    expect(statusTitle).toContain("Live push active");
    expect(statusTitle).toContain("2 records");
    expect(statusTitle).toContain("1 focused");
    expect(statusTitle).not.toContain("40000");
    expect(statusTitle).not.toContain("tokens");
  });
});
