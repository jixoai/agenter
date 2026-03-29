import type { ModelCallDeltaItem, ModelCallItem, RuntimeChatCycle } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildCycleModelCallWorkbench } from "../src/features/process/cycle-modelcall-workbench";

const baseCycle: RuntimeChatCycle = {
  id: "cycle:21",
  cycleId: 21,
  seq: 21,
  createdAt: 21,
  wakeSource: "user",
  kind: "model",
  status: "done",
  clientMessageIds: ["client-21"],
  inputs: [],
  outputs: [],
  liveMessages: [],
  streaming: null,
  modelCallId: 201,
};

describe("Feature: cycle model-call transcript normalization", () => {
  test("Scenario: Given one request message with multiple parts When the workbench builds Then it stays one input bubble row", () => {
    const modelCalls: ModelCallItem[] = [
      {
        id: 201,
        cycleId: 21,
        createdAt: 101,
        completedAt: 102,
        status: "done",
        provider: "openai-compatible",
        model: "deepseek-chat",
        request: {
          systemPrompt: "You are concise.",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Inspect the terminal diff." },
                { type: "text", text: "Focus on the retry burst only." },
              ],
            },
          ],
          tools: [],
        },
        response: {
          assistant: {
            thinking: "Need one terminal read.",
            text: "The retry burst comes from the deploy watcher retry loop.",
          },
          decision: {
            kind: "model",
            attentionRound: false,
          },
          usage: {
            totalTokens: 42,
          },
        },
        outcome: {
          code: "done",
        },
      },
    ];

    const workbench = buildCycleModelCallWorkbench({
      cycle: baseCycle,
      modelCalls,
      modelCallDeltas: [],
    });

    const inputRows = workbench.transcript.filter(
      (row): row is Extract<(typeof workbench.transcript)[number], { type: "message" }> =>
        row.type === "message" && row.lane === "input",
    );
    expect(inputRows).toHaveLength(1);
    expect(inputRows[0]?.content).toContain("Inspect the terminal diff.");
    expect(inputRows[0]?.content).toContain("Focus on the retry burst only.");

    const responseMetaRow = workbench.transcript.find(
      (row): row is Extract<(typeof workbench.transcript)[number], { type: "message" }> =>
        row.type === "message" && row.label === "response meta",
    );
    expect(responseMetaRow?.content).toContain("```json");
  });

  test("Scenario: Given final response rows and repeated deltas When the workbench builds Then tool invocations stay merged and repeated drafts are skipped", () => {
    const modelCalls: ModelCallItem[] = [
      {
        id: 201,
        cycleId: 21,
        createdAt: 101,
        completedAt: 105,
        status: "done",
        provider: "openai-compatible",
        model: "deepseek-chat",
        request: {
          systemPrompt: "You are concise.",
          messages: [{ role: "user", content: "Continue tracing." }],
          tools: [{ name: "terminal_read", description: "Read terminal output" }],
        },
        response: {
          assistant: {
            text: "Still tracing the remaining answer debt...",
          },
          toolTrace: [
            {
              invocationId: "tool-continue-1",
              tool: "terminal_read",
              input: { terminalId: "iflow", mode: "diff" },
              output: { terminalId: "iflow", kind: "diff" },
              startedAt: 103,
              finishedAt: 104,
            },
          ],
        },
        outcome: {
          code: "done",
        },
      },
    ];
    const modelCallDeltas: ModelCallDeltaItem[] = [
      {
        id: 1,
        seq: 1,
        modelCallId: 201,
        cycleId: 21,
        timestamp: 103,
        kind: "assistant_draft",
        data: { content: "Still tracing the remaining answer debt..." },
      },
      {
        id: 2,
        seq: 2,
        modelCallId: 201,
        cycleId: 21,
        timestamp: 103,
        kind: "tool_call",
        data: {
          toolCallId: "tool-continue-1",
          toolName: "terminal_read",
          input: { terminalId: "iflow", mode: "diff" },
          argsText: '{"terminalId":"iflow","mode":"diff"}',
        },
      },
    ];

    const workbench = buildCycleModelCallWorkbench({
      cycle: baseCycle,
      modelCalls,
      modelCallDeltas,
    });

    const toolRows = workbench.transcript.filter(
      (row): row is Extract<(typeof workbench.transcript)[number], { type: "tool" }> => row.type === "tool",
    );
    expect(toolRows).toHaveLength(1);
    expect(toolRows[0]?.invocation.toolName).toBe("terminal_read");
    expect(toolRows[0]?.invocation.status).toBe("success");

    const draftRows = workbench.transcript.filter(
      (row): row is Extract<(typeof workbench.transcript)[number], { type: "message" }> =>
        row.type === "message" && row.label === "assistant draft",
    );
    expect(draftRows).toHaveLength(0);
  });
});
