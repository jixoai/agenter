import type { ModelCallItem, RuntimeAttentionState, RuntimeChatCycle } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildRuntimeCycleDetailModel, buildRuntimeCycleTimelineItems } from "./runtime-cycle-inspector-state";

const attention: RuntimeAttentionState = {
  snapshot: {
    contexts: [
      {
        contextId: "ctx-room",
        owner: "message",
        focusState: "focused",
        content: "Room context body",
        scoreMap: { unread: 2 },
        consumedPushCommitIds: [],
        headCommitId: "commit-3",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:30.000Z",
        commits: [
          {
            commitId: "commit-2",
            contextId: "ctx-room",
            ingressType: "commit",
            parentCommitIds: [],
            meta: { author: "system", source: "room" },
            scores: { unread: 1 },
            summary: "Incoming room update",
            change: { type: "update", value: "Need review." },
            createdAt: "2026-04-01T00:00:10.000Z",
          },
          {
            commitId: "commit-3",
            contextId: "ctx-room",
            ingressType: "commit",
            parentCommitIds: ["commit-2"],
            meta: { author: "assistant", source: "model" },
            scores: { unread: 0 },
            summary: "Delivered room answer",
            change: { type: "update", value: "Review is done." },
            createdAt: "2026-04-01T00:00:20.000Z",
          },
        ],
      },
    ],
  },
  active: [
    {
      contextId: "ctx-room",
      context: {
        contextId: "ctx-room",
        owner: "message",
        focusState: "focused",
        content: "Room context body",
        scoreMap: { unread: 2 },
        consumedPushCommitIds: [],
        headCommitId: "commit-3",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:30.000Z",
      },
      recentCommits: [
        {
          commitId: "commit-3",
          contextId: "ctx-room",
          ingressType: "commit",
          parentCommitIds: ["commit-2"],
          meta: { author: "assistant", source: "model" },
          scores: { unread: 0 },
          summary: "Delivered room answer",
          change: { type: "update", value: "Review is done." },
          createdAt: "2026-04-01T00:00:20.000Z",
        },
      ],
    },
  ],
  cycleFrames: [
    {
      cycleId: 12,
      seq: 3,
      createdAt: 1711929620000,
      wakeSource: "message_input",
      protocolMode: "delta",
      inputContextIds: ["ctx-room"],
      inputCommitRefs: [{ contextId: "ctx-room", commitId: "commit-2" }],
      activeContextIds: ["ctx-room"],
      producedCommitRefs: [{ contextId: "ctx-room", commitId: "commit-3" }],
      modelCallIds: [55],
      hookIds: ["hook-1"],
    },
  ],
  hooks: [
    {
      id: "hook-1",
      cycleId: 12,
      hookId: "message.deliver",
      systemId: "message",
      contextId: "ctx-room",
      commitId: "commit-3",
      status: "delivered",
      createdAt: 1711929630000,
      target: { chatId: "room-main" },
      output: { ok: true },
    },
  ],
};

const modelCall: ModelCallItem = {
  id: 55,
  cycleId: 12,
  roundIndex: 0,
  kind: "model",
  createdAt: 1711929621000,
  updatedAt: 1711929630000,
  completedAt: 1711929630000,
  isComplete: true,
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
  request: {
    systemPrompt: "You are helpful.",
    messages: [{ role: "user", content: "Need review." }],
    tools: [{ name: "deliver_message" }],
    meta: { temperature: 0.2 },
  },
  response: {
    assistant: {
      text: "Review is done.",
      finishReason: "stop",
    },
  },
  error: null,
  outcome: { code: "done" },
};

const olderCycle: RuntimeChatCycle = {
  id: "cycle:11",
  cycleId: 11,
  seq: 2,
  createdAt: 1711929610000,
  wakeSource: "timer",
  kind: "compact",
  status: "done",
  clientMessageIds: [],
  inputs: [],
  outputs: [],
  liveMessages: [],
  streaming: null,
  modelCallId: null,
  compactTrigger: "manual",
};

const cycle: RuntimeChatCycle = {
  id: "cycle:12",
  cycleId: 12,
  seq: 3,
  createdAt: 1711929620000,
  wakeSource: "message_input",
  kind: "model",
  status: "done",
  clientMessageIds: ["client-1"],
  inputs: [
    {
      source: "message",
      sourceId: "room-main",
      role: "user",
      name: "User prompt",
      parts: [{ type: "text", text: "Need review." }],
      meta: { clientMessageId: "client-1" },
    },
  ],
  outputs: [
    {
      id: "message-1",
      role: "assistant",
      content: "Review is done.",
      timestamp: 1711929630000,
      cycleId: 12,
      channel: "to_user",
      format: "markdown",
      attachments: [],
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 55,
};

describe("Feature: Runtime cycle inspector state", () => {
  test("Scenario: Given cycles stay in ledger order When building timeline items Then the newest cycle stays first while active state only marks the selected cycle", () => {
    const items = buildRuntimeCycleTimelineItems({
      cycles: [olderCycle, cycle],
      activeCycle: olderCycle,
      attention,
      modelCalls: [modelCall],
      traces: [],
    });

    expect(items.map((item) => item.id)).toEqual(["cycle:12", "cycle:11"]);
    expect(items.map((item) => item.active)).toEqual([false, true]);
    expect(items[0]?.headline).toBe("Delivered room answer");
  });

  test("Scenario: Given attention and model-call facts for a cycle When building the detail model Then produced commits hooks and model payload stay inspectable", () => {
    const detail = buildRuntimeCycleDetailModel({
      cycle,
      attention,
      modelCalls: [modelCall],
      traces: [],
    });

    expect(detail.summary.headline).toBe("Delivered room answer");
    expect(detail.metrics.contextCount).toBe(1);
    expect(detail.metrics.deliveredCount).toBe(1);
    expect(detail.producedCommits[0]?.title).toBe("Delivered room answer");
    expect(detail.inputCommits[0]?.title).toBe("Incoming room update");
    expect(detail.modelCalls[0]?.id).toBe(55);
    expect(detail.modelConfig.systemPrompt).toBe("You are helpful.");
    expect(detail.modelConfig.requestTools).toEqual([{ name: "deliver_message" }]);
  });
});
