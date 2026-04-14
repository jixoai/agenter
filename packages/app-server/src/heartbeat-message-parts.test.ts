import { describe, expect, test } from "bun:test";

import {
  toHeartbeatResponseMessageUpsertInput,
  toHeartbeatToolInvocationMessageUpsertInput,
} from "./heartbeat-message-parts";

describe("Feature: Heartbeat response message part ordering", () => {
  test("Scenario: Given assistant thinking starts before assistant text When heartbeat response parts are rebuilt Then the stored part order follows assistant-authored timing only", () => {
    const message = toHeartbeatResponseMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      createdAt: 1_000,
      updatedAt: 1_900,
      isComplete: true,
      response: {
        assistant: {
          thinking: "Need to inspect the latest facts first.",
          thinkingStartedAt: 1_200,
          text: "Reply after the tool returned.",
          textStartedAt: 1_800,
        },
      },
    });

    expect(message?.parts.map((part) => part.partType)).toEqual(["thinking", "text"]);
  });

  test("Scenario: Given only a running tool call exists so far When the invocation row is rebuilt Then the unfinished tool call remains present without waiting for a later result", () => {
    const message = toHeartbeatToolInvocationMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      updatedAt: 1_050,
      invocation: {
        invocationId: "tool-2",
        tool: "root_workspace_bash",
        input: "",
        startedAt: 1_020,
        finishedAt: 1_020,
      },
    });

    expect(message.messageId).toBe("heartbeat-part:ai-call:9:tool:tool-2");
    expect(message?.parts).toEqual([
      {
        partType: "tool_call",
        payload: {
          invocationId: "tool-2",
          tool: "root_workspace_bash",
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
        tool: "root_workspace_bash",
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
          tool: "root_workspace_bash",
          input: { command: "pwd" },
          startedAt: 1_200,
        },
        isComplete: true,
      },
      {
        partType: "tool_result",
        payload: {
          invocationId: "tool-3",
          tool: "root_workspace_bash",
          output: { stdout: "/repo/agenter\n", exitCode: 0 },
          error: null,
          finishedAt: 1_500,
        },
        isComplete: true,
      },
    ]);
  });
});
