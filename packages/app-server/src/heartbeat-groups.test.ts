import { describe, expect, test } from "bun:test";

import type { SessionAiCallRecord, SessionMessageRecord } from "@agenter/session-system";

import { projectHeartbeatGroups } from "./heartbeat-groups";

const createMessage = (input: {
  id: number;
  messageId: string;
  aiCallId: number | null;
  scope?: SessionMessageRecord["scope"];
  role?: SessionMessageRecord["role"];
  createdAt: number;
  updatedAt?: number;
  isComplete?: boolean;
  text?: string;
  parts: SessionMessageRecord["parts"];
}): SessionMessageRecord => ({
  id: input.id,
  messageId: input.messageId,
  windowId: null,
  aiCallId: input.aiCallId,
  roundIndex: 0,
  scope: input.scope ?? "heartbeat_part",
  role: input.role ?? "assistant",
  createdAt: input.createdAt,
  updatedAt: input.updatedAt ?? input.createdAt,
  isComplete: input.isComplete ?? true,
  text: input.text ?? "",
  parts: input.parts,
});

const createAiCall = (input: {
  id: number;
  requestMessageIds: string[];
  responseMessageIds: string[];
  auxiliaryMessageIds?: string[];
  kind?: SessionAiCallRecord["kind"];
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
}): SessionAiCallRecord => ({
  id: input.id,
  roundIndex: 0,
  kind: input.kind ?? "attention",
  status: "done",
  provider: "test",
  model: "test",
  requestUrl: "",
  requestBody: {},
  responseBody: {},
  error: null,
  outcome: null,
  requestMessageIds: input.requestMessageIds,
  responseMessageIds: input.responseMessageIds,
  auxiliaryMessageIds: input.auxiliaryMessageIds ?? [],
  createdAt: input.createdAt ?? 100,
  updatedAt: input.updatedAt ?? 200,
  completedAt: input.completedAt ?? input.updatedAt ?? 200,
  isComplete: true,
});

describe("Feature: invocation-first heartbeat group projection", () => {
  test("Scenario: Given request rows and response rows for one ai_call When heartbeat groups are projected Then the call group keeps the request rows ahead of assistant output", () => {
    const userRequest = createMessage({
      id: 1,
      messageId: "heartbeat-part:ai-call:7:request:0",
      aiCallId: 7,
      role: "user",
      createdAt: 110,
      text: "scoreMap={room:1}",
      parts: [
        {
          partId: 1,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:7:request:0",
          windowId: null,
          aiCallId: 7,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "scoreMap={room:1}" },
          createdAt: 110,
          updatedAt: 110,
          isComplete: true,
        },
      ],
    });
    const assistantResponse = createMessage({
      id: 2,
      messageId: "heartbeat-part:ai-call:7:response:assistant:0",
      aiCallId: 7,
      createdAt: 120,
      text: "working",
      parts: [
        {
          partId: 2,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:7:response:assistant:0",
          windowId: null,
          aiCallId: 7,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "working" },
          createdAt: 120,
          updatedAt: 120,
          isComplete: true,
        },
      ],
    });

    const groups = projectHeartbeatGroups({
      aiCalls: [
        createAiCall({
          id: 7,
          requestMessageIds: [userRequest.messageId],
          responseMessageIds: [assistantResponse.messageId],
        }),
      ],
      inspectionMessages: [userRequest, assistantResponse],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("call");
    expect(groups[0]?.items.map((item) => item.messageId)).toEqual([userRequest.messageId, assistantResponse.messageId]);
  });

  test("Scenario: Given an assistant response row only contains an empty text part When heartbeat groups are projected Then the empty row is filtered out at query time", () => {
    const userRequest = createMessage({
      id: 3,
      messageId: "heartbeat-part:ai-call:8:request:0",
      aiCallId: 8,
      role: "user",
      createdAt: 210,
      text: "ping",
      parts: [
        {
          partId: 3,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:8:request:0",
          windowId: null,
          aiCallId: 8,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "ping" },
          createdAt: 210,
          updatedAt: 210,
          isComplete: true,
        },
      ],
    });
    const emptyAssistant = createMessage({
      id: 4,
      messageId: "heartbeat-part:ai-call:8:response:assistant:0",
      aiCallId: 8,
      createdAt: 220,
      parts: [
        {
          partId: 4,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:8:response:assistant:0",
          windowId: null,
          aiCallId: 8,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "assistant",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "" },
          createdAt: 220,
          updatedAt: 220,
          isComplete: true,
        },
      ],
    });

    const groups = projectHeartbeatGroups({
      aiCalls: [
        createAiCall({
          id: 8,
          requestMessageIds: [userRequest.messageId],
          responseMessageIds: [emptyAssistant.messageId],
        }),
      ],
      inspectionMessages: [userRequest, emptyAssistant],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.messageId)).toEqual([userRequest.messageId]);
  });

  test("Scenario: Given a compact ai_call carries a temporary system prompt When heartbeat groups are projected Then the compact rows stay in one compact group without creating fake before-call reset groups", () => {
    const durableSystemPrompt = createMessage({
      id: 10,
      messageId: "request_aux:systemPrompt:40",
      aiCallId: null,
      scope: "request_aux",
      role: "system",
      createdAt: 1_000,
      text: "default prompt",
      parts: [
        {
          partId: 10,
          partIndex: 0,
          messageId: "request_aux:systemPrompt:40",
          windowId: null,
          aiCallId: null,
          roundIndex: 0,
          scope: "request_aux",
          role: "system",
          partType: "systemPrompt",
          mimeType: null,
          payload: "default prompt",
          createdAt: 1_000,
          updatedAt: 1_000,
          isComplete: true,
        },
      ],
    });
    const firstRequest = createMessage({
      id: 11,
      messageId: "heartbeat-part:ai-call:40:request:0",
      aiCallId: 40,
      role: "user",
      createdAt: 1_010,
      text: "normal request",
      parts: [
        {
          partId: 11,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:40:request:0",
          windowId: null,
          aiCallId: 40,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "normal request" },
          createdAt: 1_010,
          updatedAt: 1_010,
          isComplete: true,
        },
      ],
    });
    const compactSystemPrompt = createMessage({
      id: 12,
      messageId: "request_aux:systemPrompt:41",
      aiCallId: null,
      scope: "request_aux",
      role: "system",
      createdAt: 2_000,
      text: "compact prompt",
      parts: [
        {
          partId: 12,
          partIndex: 0,
          messageId: "request_aux:systemPrompt:41",
          windowId: null,
          aiCallId: null,
          roundIndex: 0,
          scope: "request_aux",
          role: "system",
          partType: "systemPrompt",
          mimeType: null,
          payload: "compact prompt",
          createdAt: 2_000,
          updatedAt: 2_000,
          isComplete: true,
        },
      ],
    });
    const compactRequest = createMessage({
      id: 13,
      messageId: "heartbeat-part:ai-call:41:request:0",
      aiCallId: 41,
      role: "user",
      createdAt: 2_005,
      text: "compact request",
      parts: [
        {
          partId: 13,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:41:request:0",
          windowId: null,
          aiCallId: 41,
          roundIndex: 0,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "compact request" },
          createdAt: 2_005,
          updatedAt: 2_005,
          isComplete: true,
        },
      ],
    });
    const compactBoundary = createMessage({
      id: 14,
      messageId: "heartbeat-part:ai-call:41:compact",
      aiCallId: 41,
      role: "system",
      createdAt: 2_050,
      text: "Prompt window compacted (manual).",
      parts: [
        {
          partId: 14,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:41:compact",
          windowId: null,
          aiCallId: 41,
          roundIndex: 1,
          scope: "heartbeat_part",
          role: "system",
          partType: "compact",
          mimeType: null,
          payload: { type: "compact", text: "Prompt window compacted (manual)." },
          createdAt: 2_050,
          updatedAt: 2_050,
          isComplete: true,
        },
      ],
    });
    const secondRequest = createMessage({
      id: 15,
      messageId: "heartbeat-part:ai-call:42:request:0",
      aiCallId: 42,
      role: "user",
      createdAt: 3_000,
      text: "normal request after compact",
      parts: [
        {
          partId: 15,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:42:request:0",
          windowId: null,
          aiCallId: 42,
          roundIndex: 2,
          scope: "heartbeat_part",
          role: "user",
          partType: "text",
          mimeType: null,
          payload: { type: "text", content: "normal request after compact" },
          createdAt: 3_000,
          updatedAt: 3_000,
          isComplete: true,
        },
      ],
    });

    const groups = projectHeartbeatGroups({
      aiCalls: [
        createAiCall({
          id: 40,
          auxiliaryMessageIds: [durableSystemPrompt.messageId],
          requestMessageIds: [firstRequest.messageId],
          responseMessageIds: [],
          createdAt: 1_000,
          updatedAt: 1_100,
        }),
        createAiCall({
          id: 41,
          kind: "compact",
          auxiliaryMessageIds: [compactSystemPrompt.messageId],
          requestMessageIds: [compactRequest.messageId],
          responseMessageIds: [],
          createdAt: 2_000,
          updatedAt: 2_100,
        }),
        createAiCall({
          id: 42,
          auxiliaryMessageIds: [durableSystemPrompt.messageId],
          requestMessageIds: [secondRequest.messageId],
          responseMessageIds: [],
          createdAt: 3_000,
          updatedAt: 3_100,
        }),
      ],
      inspectionMessages: [
        durableSystemPrompt,
        firstRequest,
        compactSystemPrompt,
        compactRequest,
        compactBoundary,
        secondRequest,
      ],
    });

    expect(groups.map((group) => group.kind)).toEqual(["before-call", "call", "compact", "call"]);
    expect(groups.map((group) => group.groupId)).toEqual([
      "heartbeat-group:before-call:40",
      "heartbeat-group:call:40",
      "heartbeat-group:compact:41",
      "heartbeat-group:call:42",
    ]);
    expect(groups[2]?.items.map((item) => item.messageId)).toEqual([
      compactSystemPrompt.messageId,
      compactRequest.messageId,
      compactBoundary.messageId,
    ]);
  });
});
