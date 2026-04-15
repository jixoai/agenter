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
}): SessionAiCallRecord => ({
  id: input.id,
  roundIndex: 0,
  kind: "attention",
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
  createdAt: 100,
  updatedAt: 200,
  completedAt: 200,
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
      messageId: "heartbeat-part:ai-call:7:response:assistant",
      aiCallId: 7,
      createdAt: 120,
      text: "working",
      parts: [
        {
          partId: 2,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:7:response:assistant",
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
      messageId: "heartbeat-part:ai-call:8:response:assistant",
      aiCallId: 8,
      createdAt: 220,
      parts: [
        {
          partId: 4,
          partIndex: 0,
          messageId: "heartbeat-part:ai-call:8:response:assistant",
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
});
