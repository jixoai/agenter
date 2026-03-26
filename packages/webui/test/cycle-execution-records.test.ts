import { describe, expect, test } from "vitest";

import { normalizeCycleExecutionRecords } from "../src/features/process/cycle-execution-records";

describe("Feature: cycle execution records", () => {
  test("Scenario: Given tool call and result messages When execution records are normalized Then they collapse into one tool trace", () => {
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
          id: "tool-call-11",
          role: "assistant",
          channel: "tool_call",
          content: [
            "```yaml+tool_call",
            'tool: terminal_read',
            'timestamp: "2026-03-24T09:00:12.000Z"',
            "input:",
            "  terminalId: iflow",
            "```",
          ].join("\n"),
          timestamp: 12,
          cycleId: 11,
          tool: { name: "terminal_read" },
        },
        {
          id: "tool-result-11",
          role: "assistant",
          channel: "tool_result",
          content: [
            "```yaml+tool_result",
            'tool: terminal_read',
            'timestamp: "2026-03-24T09:00:12.000Z"',
            "ok: true",
            "output:",
            "  terminalId: iflow",
            "  kind: diff",
            "  seq: 18",
            "  cols: 120",
            "  rows: 30",
            "```",
          ].join("\n"),
          timestamp: 13,
          cycleId: 11,
          tool: { name: "terminal_read", ok: true },
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
      kind: "tool-trace",
      toolTrace: {
        toolName: "terminal_read",
        status: "done",
      },
    });
    if (records[0]?.kind !== "tool-trace") {
      throw new Error("expected tool trace record");
    }
    expect(records[0].toolTrace.callContent).toContain("yaml+tool_call");
    expect(records[0].toolTrace.resultContent).toContain("yaml+tool_result");
    expect(records[1]).toMatchObject({
      kind: "message",
      message: {
        channel: "self_talk",
        content: "Need one more terminal diff before replying.",
      },
    });
  });
});
