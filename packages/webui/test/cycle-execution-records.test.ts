import { describe, expect, test } from "vitest";

import { normalizeCycleExecutionRecords } from "../src/features/process/cycle-execution-records";

describe("Feature: cycle execution records", () => {
  test("Scenario: Given a structured tool invocation message When execution records are normalized Then they map directly to one tool invocation card model", () => {
    const records = normalizeCycleExecutionRecords({
      id: "cycle:11",
      cycleId: 11,
      seq: 11,
      createdAt: 11,
      wakeSource: "user",
      kind: "model",
      status: "done",
      clientMessageIds: [],
      inputs: [],
      outputs: [
        {
          id: "tool-11",
          role: "assistant",
          channel: "tool",
          content: [
            "```yaml",
            "tool: terminal_read",
            "status: success",
            "```",
          ].join("\n"),
          timestamp: 13,
          cycleId: 11,
          tool: {
            invocationId: "terminal-read-11",
            name: "terminal_read",
            status: "success",
            startedAt: 12,
            finishedAt: 13,
            call: {
              value: {
                terminalId: "iflow",
              },
            },
            result: {
              value: {
                terminalId: "iflow",
                kind: "diff",
                seq: 18,
                cols: 120,
                rows: 30,
              },
            },
          },
        },
        {
          id: "self-talk-11",
          role: "assistant",
          channel: "self_talk",
          content: "Need one more terminal diff before replying.",
          timestamp: 14,
          cycleId: 11,
        },
      ],
      liveMessages: [],
      streaming: null,
      modelCallId: 12,
    });

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      kind: "tool-invocation",
      invocation: {
        toolName: "terminal_read",
        status: "success",
      },
    });
    if (records[0]?.kind !== "tool-invocation") {
      throw new Error("expected tool invocation record");
    }
    expect(records[0].invocation.call?.value).toMatchObject({ terminalId: "iflow" });
    expect(records[0].invocation.result?.value).toMatchObject({ terminalId: "iflow", kind: "diff" });
    expect(records[1]).toMatchObject({
      kind: "message",
      message: {
        channel: "self_talk",
        content: "Need one more terminal diff before replying.",
      },
    });
  });
});
