import { describe, expect, test } from "bun:test";

import {
  toHeartbeatResponseSegmentMessageUpsertInputs,
  toHeartbeatToolInvocationMessageUpsertInput,
} from "./heartbeat-message-parts";

describe("Feature: Heartbeat response message part ordering", () => {
  test("Scenario: Given assistant output is segmented over time When heartbeat response rows are rebuilt Then each segment keeps its own durable assistant message", () => {
    const messages = toHeartbeatResponseSegmentMessageUpsertInputs({
      aiCallId: 9,
      roundIndex: 3,
      segments: [
        {
          partType: "thinking",
          content: "Need to inspect the latest facts first.",
          startedAt: 1_200,
          updatedAt: 1_500,
          isComplete: true,
        },
        {
          partType: "text",
          content: "Reply after the tool returned.",
          startedAt: 1_800,
          updatedAt: 1_900,
          isComplete: false,
        },
      ],
    });

    expect(messages).toMatchObject([
      {
        messageId: "heartbeat-part:ai-call:9:response:assistant:0",
        parts: [
          {
            partType: "thinking",
            payload: {
              type: "thinking",
              text: "Need to inspect the latest facts first.",
            },
            isComplete: true,
          },
        ],
      },
      {
        messageId: "heartbeat-part:ai-call:9:response:assistant:1",
        parts: [
          {
            partType: "text",
            payload: {
              type: "text",
              content: "Reply after the tool returned.",
            },
            isComplete: false,
          },
        ],
      },
    ]);
  });

  test("Scenario: Given only a running tool call exists so far When the invocation row is rebuilt Then the unfinished tool call remains present without waiting for a later result", () => {
    const message = toHeartbeatToolInvocationMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      updatedAt: 1_050,
      invocation: {
        invocationId: "tool-2",
        tool: "root_bash",
        input: "",
        startedAt: 1_020,
        finishedAt: 1_020,
      },
    });

    expect(message.messageId).toBe("heartbeat-part:ai-call:9:tool:tool-2");
    expect(message.parts).toEqual([
      {
        partType: "tool_call",
        payload: {
          invocationId: "tool-2",
          tool: "root_bash",
          input: "",
          startedAt: 1_020,
        },
        isComplete: false,
      },
    ]);
  });

  test("Scenario: Given a completed invocation has both call and result facts When the invocation row is rebuilt Then the same row carries both linked parts", () => {
    const message = toHeartbeatToolInvocationMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      updatedAt: 1_500,
      invocation: {
        invocationId: "tool-3",
        tool: "root_bash",
        input: { command: "pwd" },
        output: { stdout: "/repo/agenter\n", exitCode: 0 },
        startedAt: 1_200,
        finishedAt: 1_500,
      },
    });

    expect(message.parts).toEqual([
      {
        partType: "tool_call",
        payload: {
          invocationId: "tool-3",
          tool: "root_bash",
          input: { command: "pwd" },
          startedAt: 1_200,
        },
        isComplete: true,
      },
      {
        partType: "tool_result",
        payload: {
          invocationId: "tool-3",
          tool: "root_bash",
          output: { stdout: "/repo/agenter\n", exitCode: 0 },
          error: null,
          finishedAt: 1_500,
        },
        isComplete: true,
      },
    ]);
  });
});
