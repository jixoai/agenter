import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TerminalControlPlane } from "@agenter/terminal-system";
import { SessionRuntime } from "../src/session-runtime";

interface RuntimeInternals {
  sessionDb: {
    appendAiCall: (input: {
      roundIndex: number;
      kind: string;
      provider: string;
      model: string;
      requestUrl: string;
      requestBody: unknown;
      responseBody?: unknown;
      requestMessageIds?: string[];
      responseMessageIds?: string[];
      auxiliaryMessageIds?: string[];
      status?: "running" | "done" | "error" | "cancelled";
      isComplete?: boolean;
      createdAt?: number;
      updatedAt?: number;
      completedAt?: number | null;
    }) => { id: number };
    listMessagesByScope: (scope: "heartbeat_part", options?: { limit?: number }) => Array<{
      messageId: string;
      parts: Array<{
        partId: number;
        partType: string;
        payload: unknown;
        isComplete: boolean;
      }>;
    }>;
    getAiCallById: (id: number) => {
      responseMessageIds: string[];
    } | null;
  };
  activeModelCallId: number | null;
  activeModelResponseDraft:
    | {
        assistant?: {
          thinking?: string;
          text?: string;
          finishReason?: string | null;
        };
        assistantSegments: Array<{
          partType: "thinking" | "text";
          content: string;
          startedAt: number;
          updatedAt: number;
          isComplete: boolean;
        }>;
        toolTrace: Array<{
          invocationId: string;
          tool: string;
          input: unknown;
          output?: unknown;
          error?: string;
          startedAt: number;
          finishedAt: number;
        }>;
      }
    | null;
  promptWindowRoundIndex: number;
  createActiveCycle: (input: {
    cycleId: number;
    seq: number;
    createdAt: number;
    wakeSource: string | null;
    inputs: Array<{
      source: "message";
      role: "user";
      name: string;
      parts: Array<{ type: "text"; text: string }>;
      meta?: { clientMessageId?: string };
    }>;
  }) => void;
  handleAssistantStreamUpdate: (
    input:
      | {
          kind: "thinking";
          delta?: string;
          content: string;
          timestamp: number;
        }
      | {
          kind: "draft";
          delta?: string;
          content: string;
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          };
          finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
          timestamp: number;
        }
      | {
          kind: "tool_call";
          toolCallId: string;
          toolName: string;
          argsText: string;
          input?: unknown;
          timestamp: number;
        }
      | {
          kind: "tool_result";
          toolCallId: string;
          toolName: string;
          ok: boolean;
          result?: unknown;
          error?: string | null;
          timestamp: number;
        }
      | {
          kind: "run_finished";
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          };
          finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
          timestamp: number;
        },
  ) => void;
}

const PRIMARY_ROOM_ID = "0x0000000000000000000000000000000000000001";

const createRuntime = (): SessionRuntime => {
  const root = mkdtempSync(join(tmpdir(), "agenter-cycle-stream-"));
  return new SessionRuntime({
    sessionId: `s-${Date.now()}`,
    cwd: root,
    sessionRoot: join(root, "session"),
    sessionName: "cycle-stream",
    storeTarget: "workspace",
    primaryRoomId: PRIMARY_ROOM_ID,
    terminalSystem: new TerminalControlPlane({
      dbPath: join(root, "terminal.db"),
      outputRoot: join(root, "terminals"),
    }),
  });
};

describe("Feature: session runtime live cycle projection", () => {
  test("Scenario: Given streamed tool events When the active cycle updates Then tool rows stay in the same cycle without injecting attention previews into chat streaming", () => {
    const runtime = createRuntime();
    const internal = runtime as unknown as RuntimeInternals;

    internal.createActiveCycle({
      cycleId: 11,
      seq: 11,
      createdAt: 11,
      wakeSource: "user",
      inputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "continue" }],
          meta: { clientMessageId: "client-11" },
        },
      ],
    });

    internal.handleAssistantStreamUpdate({
      kind: "tool_call",
      toolCallId: "tool-1",
      toolName: "attention_item_patch",
      argsText: '{"content":"Streaming reply',
      timestamp: 12,
    });

    let activeCycle = runtime.snapshot().activeCycle;
    expect(activeCycle?.streaming).toBeNull();
    expect(activeCycle?.liveMessages).toHaveLength(1);
    expect(activeCycle?.liveMessages[0]?.channel).toBe("tool");
    expect(activeCycle?.liveMessages[0]?.tool?.invocationId).toBe("tool-1");
    expect(activeCycle?.liveMessages[0]?.tool?.status).toBe("running");

    internal.handleAssistantStreamUpdate({
      kind: "tool_result",
      toolCallId: "tool-1",
      toolName: "attention_item_patch",
      ok: true,
      result: { ok: true, id: 7 },
      timestamp: 13,
    });

    activeCycle = runtime.snapshot().activeCycle;
    expect(activeCycle?.liveMessages).toHaveLength(1);
    expect(activeCycle?.liveMessages[0]?.channel).toBe("tool");
    expect(activeCycle?.liveMessages[0]?.tool?.status).toBe("success");
    expect(activeCycle?.status).toBe("streaming");
  });

  test("Scenario: Given a tool invocation hydrates arguments before completion When heartbeat rows are persisted Then the same invocation row upgrades in place before the result arrives", async () => {
    const runtime = createRuntime();
    try {
      await runtime.start();
      const internal = runtime as unknown as RuntimeInternals;

      internal.createActiveCycle({
        cycleId: 21,
        seq: 21,
        createdAt: 21,
        wakeSource: "user",
        inputs: [
          {
            source: "message",
            role: "user",
            name: "User",
            parts: [{ type: "text", text: "check the latest DeepSeek news" }],
            meta: { clientMessageId: "client-21" },
          },
        ],
      });

      const call = internal.sessionDb.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "test-provider",
        model: "test-model",
        requestUrl: "",
        requestBody: { messages: [] },
        status: "running",
        isComplete: false,
        createdAt: 21,
        updatedAt: 21,
      });
      internal.activeModelCallId = call.id;
      internal.activeModelResponseDraft = { assistantSegments: [], toolTrace: [] };
      internal.promptWindowRoundIndex = 0;

      internal.handleAssistantStreamUpdate({
        kind: "tool_call",
        toolCallId: "tool-bash-21",
        toolName: "root_workspace_bash",
        argsText: "",
        timestamp: 22,
      });

      const pending = internal.sessionDb
        .listMessagesByScope("heartbeat_part", { limit: 20 })
        .find((message) => message.messageId === `heartbeat-part:ai-call:${call.id}:tool:tool-bash-21`);

      expect(pending?.parts).toHaveLength(1);
      expect(pending?.parts[0]).toMatchObject({
        partId: pending?.parts[0]?.partId ?? -1,
        partType: "tool_call",
        payload: {
          invocationId: "tool-bash-21",
          tool: "root_workspace_bash",
          input: "",
          startedAt: 22,
        },
        isComplete: false,
      });

      const firstPartId = pending?.parts[0]?.partId;

      internal.handleAssistantStreamUpdate({
        kind: "tool_call",
        toolCallId: "tool-bash-21",
        toolName: "root_workspace_bash",
        argsText: "{\"command\":\"curl -s https://news.ycombinator.com/\"}",
        input: {
          command: "curl -s https://news.ycombinator.com/",
        },
        timestamp: 23,
      });

      const hydrated = internal.sessionDb
        .listMessagesByScope("heartbeat_part", { limit: 20 })
        .find((message) => message.messageId === `heartbeat-part:ai-call:${call.id}:tool:tool-bash-21`);
      expect(internal.sessionDb.getAiCallById(call.id)?.responseMessageIds).toContain(
        `heartbeat-part:ai-call:${call.id}:tool:tool-bash-21`,
      );

      expect(hydrated?.parts).toHaveLength(1);
      expect(hydrated?.parts[0]).toMatchObject({
        partId: firstPartId ?? -1,
        partType: "tool_call",
        payload: {
          invocationId: "tool-bash-21",
          tool: "root_workspace_bash",
          input: {
            command: "curl -s https://news.ycombinator.com/",
          },
          startedAt: 22,
        },
        isComplete: false,
      });

      internal.handleAssistantStreamUpdate({
        kind: "tool_result",
        toolCallId: "tool-bash-21",
        toolName: "root_workspace_bash",
        ok: true,
        result: {
          stdout: "",
          stderr: "",
          exitCode: 0,
        },
        timestamp: 24,
      });

      const completed = internal.sessionDb
        .listMessagesByScope("heartbeat_part", { limit: 20 })
        .find((message) => message.messageId === `heartbeat-part:ai-call:${call.id}:tool:tool-bash-21`);
      expect(internal.sessionDb.getAiCallById(call.id)?.responseMessageIds).toContain(
        `heartbeat-part:ai-call:${call.id}:tool:tool-bash-21`,
      );

      expect(completed?.parts).toHaveLength(2);
      expect(completed?.parts[0]).toMatchObject({
        partId: firstPartId ?? -1,
        partType: "tool_call",
        payload: {
          invocationId: "tool-bash-21",
          tool: "root_workspace_bash",
          input: {
            command: "curl -s https://news.ycombinator.com/",
          },
          startedAt: 22,
        },
        isComplete: true,
      });
      expect(completed?.parts[1]).toMatchObject({
        partId: completed?.parts[1]?.partId ?? -1,
        partType: "tool_result",
        payload: {
          invocationId: "tool-bash-21",
          tool: "root_workspace_bash",
          output: {
            stdout: "",
            stderr: "",
            exitCode: 0,
          },
          error: null,
          finishedAt: 24,
        },
        isComplete: true,
      });
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given thinking chunks arrive before assistant text When heartbeat rows are persisted Then the response row stores a streaming thinking part", async () => {
    const runtime = createRuntime();
    try {
      await runtime.start();
      const internal = runtime as unknown as RuntimeInternals;

      internal.createActiveCycle({
        cycleId: 31,
        seq: 31,
        createdAt: 31,
        wakeSource: "user",
        inputs: [
          {
            source: "message",
            role: "user",
            name: "User",
            parts: [{ type: "text", text: "在吗？" }],
            meta: { clientMessageId: "client-31" },
          },
        ],
      });

      const call = internal.sessionDb.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "test-provider",
        model: "test-model",
        requestUrl: "",
        requestBody: { messages: [] },
        status: "running",
        isComplete: false,
        createdAt: 31,
        updatedAt: 31,
      });
      internal.activeModelCallId = call.id;
      internal.activeModelResponseDraft = { assistantSegments: [], toolTrace: [] };
      internal.promptWindowRoundIndex = 0;

      internal.handleAssistantStreamUpdate({
        kind: "thinking",
        delta: "Need to inspect the latest room focus first.",
        content: "Need to inspect the latest room focus first.",
        timestamp: 32,
      });

      const responseRow = internal.sessionDb
        .listMessagesByScope("heartbeat_part", { limit: 20 })
        .find((message) => message.messageId === `heartbeat-part:ai-call:${call.id}:response:assistant:0`);

      expect(internal.sessionDb.getAiCallById(call.id)?.responseMessageIds).toContain(
        `heartbeat-part:ai-call:${call.id}:response:assistant:0`,
      );
      expect(responseRow?.parts).toMatchObject([
        {
          partType: "thinking",
          payload: {
            type: "thinking",
            text: "Need to inspect the latest room focus first.",
          },
          isComplete: false,
        },
      ]);
    } finally {
      await runtime.stop();
    }
  });

  test("Scenario: Given assistant thinking resumes after a tool boundary When heartbeat rows are persisted Then response segments stay in objective order instead of collapsing into one assistant snapshot", async () => {
    const runtime = createRuntime();
    try {
      await runtime.start();
      const internal = runtime as unknown as RuntimeInternals;

      internal.createActiveCycle({
        cycleId: 41,
        seq: 41,
        createdAt: 41,
        wakeSource: "user",
        inputs: [
          {
            source: "message",
            role: "user",
            name: "User",
            parts: [{ type: "text", text: "继续" }],
            meta: { clientMessageId: "client-41" },
          },
        ],
      });

      const call = internal.sessionDb.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        provider: "test-provider",
        model: "test-model",
        requestUrl: "",
        requestBody: { messages: [] },
        status: "running",
        isComplete: false,
        createdAt: 41,
        updatedAt: 41,
      });
      internal.activeModelCallId = call.id;
      internal.activeModelResponseDraft = { assistantSegments: [], toolTrace: [] };
      internal.promptWindowRoundIndex = 0;

      internal.handleAssistantStreamUpdate({
        kind: "thinking",
        delta: "Need to inspect the room.",
        content: "Need to inspect the room.",
        timestamp: 42,
      });
      internal.handleAssistantStreamUpdate({
        kind: "tool_call",
        toolCallId: "tool-room-41",
        toolName: "root_workspace_bash",
        argsText: "{\"command\":\"pwd\"}",
        input: { command: "pwd" },
        timestamp: 43,
      });
      internal.handleAssistantStreamUpdate({
        kind: "tool_result",
        toolCallId: "tool-room-41",
        toolName: "root_workspace_bash",
        ok: true,
        result: { stdout: "/repo/agenter\n", exitCode: 0 },
        timestamp: 44,
      });
      internal.handleAssistantStreamUpdate({
        kind: "thinking",
        delta: "Need to summarize the result.",
        content: "Need to summarize the result.",
        timestamp: 45,
      });
      internal.handleAssistantStreamUpdate({
        kind: "draft",
        delta: "已检查完成。",
        content: "已检查完成。",
        finishReason: "stop",
        timestamp: 46,
      });
      internal.handleAssistantStreamUpdate({
        kind: "run_finished",
        finishReason: "stop",
        timestamp: 47,
      });

      const messages = internal.sessionDb.listMessagesByScope("heartbeat_part", { limit: 20 });
      expect(messages.map((message) => message.messageId)).toEqual(
        expect.arrayContaining([
          `heartbeat-part:ai-call:${call.id}:response:assistant:0`,
          `heartbeat-part:ai-call:${call.id}:tool:tool-room-41`,
          `heartbeat-part:ai-call:${call.id}:response:assistant:1`,
          `heartbeat-part:ai-call:${call.id}:response:assistant:2`,
        ]),
      );

      const messageById = new Map(messages.map((message) => [message.messageId, message]));
      expect(messageById.get(`heartbeat-part:ai-call:${call.id}:response:assistant:0`)?.parts[0]).toMatchObject({
        partType: "thinking",
        payload: {
          type: "thinking",
          text: "Need to inspect the room.",
        },
        isComplete: true,
      });
      expect(messageById.get(`heartbeat-part:ai-call:${call.id}:response:assistant:1`)?.parts[0]).toMatchObject({
        partType: "thinking",
        payload: {
          type: "thinking",
          text: "Need to summarize the result.",
        },
        isComplete: true,
      });
      expect(messageById.get(`heartbeat-part:ai-call:${call.id}:response:assistant:2`)?.parts[0]).toMatchObject({
        partType: "text",
        payload: {
          type: "text",
          content: "已检查完成。",
        },
        isComplete: true,
      });
      expect(internal.sessionDb.getAiCallById(call.id)?.responseMessageIds).toEqual([
        `heartbeat-part:ai-call:${call.id}:response:assistant:0`,
        `heartbeat-part:ai-call:${call.id}:response:assistant:1`,
        `heartbeat-part:ai-call:${call.id}:response:assistant:2`,
        `heartbeat-part:ai-call:${call.id}:tool:tool-room-41`,
      ]);
    } finally {
      await runtime.stop();
    }
  });
});
