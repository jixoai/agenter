import type { ModelCallDeltaItem, ModelCallItem, RequestAuxItem, RuntimeChatMessage } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildRuntimeHeartbeatTimeline } from "./runtime-heartbeat-timeline";

describe("Feature: runtime heartbeat timeline assembly", () => {
  test("Scenario: Given heartbeat rows request-aux rows and model calls When building the timeline Then items stay in causal order and live deltas stay attached to their model call", () => {
    const messages: RuntimeChatMessage[] = [
      {
        id: "11",
        role: "user",
        content: "check the weather",
        timestamp: 100,
      },
      {
        id: "12",
        role: "assistant",
        channel: "to_user",
        content: "looking it up now",
        timestamp: 180,
      },
    ];
    const requestAux: RequestAuxItem[] = [
      {
        id: 21,
        messageId: "aux-system",
        windowId: null,
        aiCallId: 7,
        roundIndex: 1,
        scope: "request_aux",
        role: "system",
        createdAt: 120,
        updatedAt: 120,
        isComplete: true,
        text: "You are a Linux expert.",
        parts: [
          {
            partId: 21,
            partIndex: 0,
            messageId: "aux-system",
            windowId: null,
            aiCallId: 7,
            roundIndex: 1,
            scope: "request_aux",
            role: "system",
            partType: "systemPrompt",
            mimeType: null,
            payload: "You are a Linux expert.",
            createdAt: 120,
            updatedAt: 120,
            isComplete: true,
          },
        ],
      },
    ];
    const modelCalls: ModelCallItem[] = [
      {
        id: 7,
        cycleId: 7,
        roundIndex: 1,
        kind: "attention",
        status: "running",
        provider: "openai-compatible",
        model: "test-model",
        requestUrl: "https://example.test/v1/chat/completions",
        request: {},
        response: null,
        error: null,
        outcome: null,
        createdAt: 140,
        updatedAt: 150,
        completedAt: null,
        isComplete: false,
      },
    ];
    const deltas: ModelCallDeltaItem[] = [
      {
        id: 2,
        seq: 2,
        modelCallId: 7,
        cycleId: 7,
        timestamp: 160,
        kind: "tool_result",
        data: { stdout: "sunny" },
      },
      {
        id: 1,
        seq: 1,
        modelCallId: 7,
        cycleId: 7,
        timestamp: 150,
        kind: "tool_call",
        data: { name: "workspace.bash" },
      },
    ];

    const timeline = buildRuntimeHeartbeatTimeline({
      messages,
      requestAux,
      modelCalls,
      modelCallDeltas: deltas,
    });

    expect(timeline.map((item) => item.kind)).toEqual(["heartbeat", "request_aux", "model_call", "heartbeat"]);
    expect(timeline[2]?.kind).toBe("model_call");
    expect(timeline[2]?.kind === "model_call" ? timeline[2].liveDeltas.map((delta) => delta.id) : []).toEqual([1, 2]);
  });
});
