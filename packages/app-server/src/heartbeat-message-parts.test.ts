import { describe, expect, test } from "bun:test";

import { toHeartbeatResponseMessageUpsertInput } from "./heartbeat-message-parts";

describe("Feature: Heartbeat response message part ordering", () => {
  test("Scenario: Given tool activity starts before assistant text is first streamed When heartbeat response parts are rebuilt Then the stored part order follows first-seen event timing instead of fixed type order", () => {
    const message = toHeartbeatResponseMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      createdAt: 1_000,
      updatedAt: 1_900,
      isComplete: true,
      response: {
        assistant: {
          text: "Reply after the tool returned.",
          textStartedAt: 1_800,
        },
        toolTrace: [
          {
            invocationId: "tool-1",
            tool: "root_workspace_bash",
            input: { command: "pwd" },
            output: { stdout: "/repo/agenter\n" },
            startedAt: 1_200,
            finishedAt: 1_500,
          },
        ],
      },
    });

    expect(message?.parts.map((part) => part.partType)).toEqual(["tool_call", "tool_result", "text"]);
  });

  test("Scenario: Given only a running tool call exists so far When heartbeat response parts are rebuilt Then the unfinished tool call remains present without waiting for a later result", () => {
    const message = toHeartbeatResponseMessageUpsertInput({
      aiCallId: 9,
      roundIndex: 3,
      createdAt: 1_000,
      updatedAt: 1_050,
      isComplete: false,
      response: {
        toolTrace: [
          {
            invocationId: "tool-2",
            tool: "root_workspace_bash",
            input: "",
            startedAt: 1_020,
            finishedAt: 1_020,
          },
        ],
      },
    });

    expect(message?.parts).toEqual([
      {
        partType: "tool_call",
        payload: {
          invocationId: "tool-2",
          tool: "root_workspace_bash",
          input: "",
          startedAt: 1_020,
        },
        isComplete: true,
      },
    ]);
  });
});
