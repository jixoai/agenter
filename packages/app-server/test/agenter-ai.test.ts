import { AttentionEngine } from "@agenter/attention-system";
import type { TaskImportItem } from "@agenter/task-system";
import { describe, expect, test } from "bun:test";

import { AgenterAI } from "../src/agenter-ai";
import { type LoopBusMessage } from "../src/loop-bus";
import type { ModelClient } from "../src/model-client";
import type { PromptDocRecord } from "../src/prompt-docs";
import { FilePromptStore } from "../src/prompt-store";
import type { AppServerLogger } from "../src/types";

const createPromptDocs = (): PromptDocRecord => ({
  AGENTER: { syntax: "mdx", content: "" },
  AGENTER_SYSTEM: { syntax: "mdx", content: "You are agenter-ai." },
  SYSTEM_TEMPLATE: {
    syntax: "mdx",
    content: `<Slot name="AGENTER_SYSTEM" />\n\n<Slot name="AGENTER" />\n\n<Slot name="RESPONSE_CONTRACT" />`,
  },
  RESPONSE_CONTRACT: { syntax: "mdx", content: "Use tools when needed." },
});

const createLogger = (): AppServerLogger => ({
  log: () => {
    // no-op in tests
  },
});

type ModelRespondInput = Parameters<ModelClient["respondWithMeta"]>[0];

const flattenModelMessageContent = (message: unknown): string => {
  if (!message || typeof message !== "object" || !("content" in message)) {
    return "";
  }
  const content = message.content;
  if (content === null || content === undefined) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (!part || typeof part !== "object" || !("type" in part)) {
        return "";
      }
      if (part.type === "text" && "content" in part && typeof part.content === "string") {
        return part.content;
      }
      return `[${String(part.type)}]`;
    })
    .join("\n");
};

const extractAssistantReplay = (input: ModelRespondInput | undefined): string[] =>
  (input?.messages ?? [])
    .filter((message) => message.role === "assistant")
    .map((message) => flattenModelMessageContent(message));

const createModelClient = (
  handler: (input: ModelRespondInput) => ReturnType<ModelClient["respondWithMeta"]>,
): ModelClient => {
  const client = {
    getMeta() {
      return {
        provider: "openai-compatible",
        model: "deepseek-chat",
        providerId: "default",
        baseUrl: "https://api.deepseek.com/v1",
      };
    },
    getCompactConfig() {
      return {};
    },
    async summarizeText() {
      return { summary: "", skipped: "disabled in unit test" };
    },
    async respondWithMeta(input: ModelRespondInput) {
      return handler(input);
    },
  };
  return client as unknown as ModelClient;
};

const createTaskGateway = () => ({
  list: () => [],
  get: () => undefined,
  create: () => {
    throw new Error("task create should not be called in this test");
  },
  update: () => {
    throw new Error("task update should not be called in this test");
  },
  done: () => ({ ok: false, affected: [], reason: "not used in test" }),
  addDependency: () => {
    throw new Error("task addDependency should not be called in this test");
  },
  removeDependency: () => {
    throw new Error("task removeDependency should not be called in this test");
  },
  triggerManual: () => undefined,
  emitEvent: (input: { topic: string }) => ({ topic: input.topic, source: "tool" as const, affected: [] }),
  import: (_items: TaskImportItem[]) => ({ created: 0, updated: 0, items: [] }),
});

const createTerminalGateway = () => {
  const writeCalls: Array<{ terminalId: string; text: string; submit?: boolean; submitKey?: "enter" | "linefeed" }> =
    [];
  return {
    writeCalls,
    gateway: {
      list: () => [],
      run: async () => ({ ok: true, message: "started" }),
      kill: async () => ({ ok: true, message: "stopped" }),
      focus: async () => ({ ok: true, message: "focused", focusedTerminalIds: ["iflow"] }),
      write: async (input: {
        terminalId: string;
        text: string;
        submit?: boolean;
        submitKey?: "enter" | "linefeed";
      }) => {
        writeCalls.push(input);
        return { ok: true, message: "written" };
      },
      read: async () => ({ ok: true }),
      consumeDiff: async () => ({ ok: true, changed: false }),
      sliceDirty: async () => ({ ok: true, changed: false }),
    },
  };
};

const createAttentionGateway = () => {
  const engine = new AttentionEngine();
  return {
    engine,
    gateway: {
      list: () => engine.list(),
      add: async (input: { content: string; from: string; score?: number; remark?: string }) => engine.add(input),
      remark: async (input: { id: number; score?: number; remark?: string }) => engine.remark(input),
      query: async (input: { offset?: number; limit?: number; query?: string; includeInactive?: boolean }) =>
        engine.query(input),
      reply: async (input: {
        replyContent: string;
        from?: string;
        score?: number;
        relationships?: Array<{ id: number; score?: number; remark?: string }>;
      }) => engine.reply(input),
    },
  };
};

const createUserMessage = (text: string): LoopBusMessage => ({
  id: "m-user",
  timestamp: Date.now(),
  name: "User",
  role: "user",
  type: "text",
  source: "chat",
  text,
});

describe("Feature: AgenterAI behavior", () => {
  test("Scenario: Given terminal help mdx When model receives context Then <CliHelp/> is rendered before call", async () => {
    let capturedMessages: unknown[] | null = null;
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      capturedMessages = input.messages;
      return {
        thinking: "",
        text: "I have read terminal help.",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const terminalHelpPayload = JSON.stringify({
      kind: "terminal-help",
      terminalId: "iflow",
      command: "iflow",
      source: "./.agenter/man/iflow.md",
      doc: { syntax: "mdx", content: '<CliHelp command="iflow"/>' },
      manuals: { iflow: "IFLOW HELP CONTENT" },
    });

    await ai.send([
      createUserMessage("Read help first"),
      {
        id: "m-help",
        timestamp: Date.now() + 1,
        name: "Terminal-iflow",
        role: "user",
        type: "text",
        source: "terminal",
        text: terminalHelpPayload,
      },
    ]);

    const captured = Array.isArray(capturedMessages) ? capturedMessages : [];
    const joinedHistory = captured.map((item) => flattenModelMessageContent(item)).join("\n\n");
    expect(joinedHistory).toContain("IFLOW HELP CONTENT");
    expect(joinedHistory).not.toContain("<CliHelp");
  });

  test("Scenario: Given terminal snapshot tail as one string When model receives terminal context Then multiline tail stays intact", async () => {
    let capturedMessages: unknown[] | null = null;
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      capturedMessages = input.messages;
      return {
        thinking: "",
        text: "snapshot received",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const terminalSnapshotPayload = JSON.stringify({
      kind: "terminal-snapshot",
      terminalId: "iflow",
      seq: 30,
      cols: 80,
      rows: 24,
      cursor: { x: 0, y: 23 },
      tail: "line 1\nline 2\nline 3",
    });

    await ai.send([
      createUserMessage("inspect terminal snapshot"),
      {
        id: "m-snapshot",
        timestamp: Date.now() + 1,
        name: "Terminal-iflow",
        role: "user",
        type: "text",
        source: "terminal",
        text: terminalSnapshotPayload,
      },
    ]);

    const captured = Array.isArray(capturedMessages) ? capturedMessages : [];
    const joinedHistory = captured.map((item) => flattenModelMessageContent(item)).join("\n\n");
    expect(joinedHistory).toContain("tailLines: 3");
    expect(joinedHistory).toContain("line 1\nline 2\nline 3");
  });

  test("Scenario: Given active attention_list When model uses attention_reply relationships Then attention items are cleared", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const userItem = chat.engine.add({ content: "请做一个单页网页小游戏", from: "user", score: 100 });

    const modelClient = createModelClient(async (input) => {
      const callTool = async (toolName: string, rawInput: unknown) => {
        const tool = input.tools.find((item) => item.name === toolName);
        expect(tool).toBeDefined();
        if (!tool || typeof tool.execute !== "function") {
          throw new Error(`tool not executable: ${toolName}`);
        }
        return tool.execute(rawInput, {
          toolCallId: `call-${toolName}`,
          emitCustomEvent: () => {
            // no-op
          },
        });
      };

      const list = (await callTool("attention_list", {})) as { items: Array<{ id: number }> };
      expect(list.items.some((item) => item.id === userItem.id)).toBeTrue();

      await callTool("attention_reply", {
        replyContent: "我已确认需求，开始实现。",
        done: false,
        stage: "act",
        relationships: [{ id: userItem.id, score: 0, remark: "已处理" }],
      });

      return {
        thinking: "已读取对话注意力并处理。",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(chat.engine.list()).toHaveLength(0);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeTrue();
  });

  test("Scenario: Given no active attention items When model calls attention_reply Then no user-visible reply is emitted", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      const tool = input.tools.find((item) => item.name === "attention_reply");
      expect(tool).toBeDefined();
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("attention_reply tool missing");
      }

      const result = (await tool.execute(
        {
          replyContent: "startup ping",
          stage: "observe",
        },
        {
          toolCallId: "call-attention_reply",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; id: number; message?: string };

      expect(result).toEqual({
        ok: false,
        id: 0,
        message: "no active attention items to answer",
      });

      return {
        thinking: "No active attention items, keep observing.",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("continue")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();
  });

  test("Scenario: Given no attention_reply When model returns plain text Then output is published as a user-facing assistant reply", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async () => ({
      thinking: "Observation: terminal idle\nDecision: wait\nNext: collect diff",
      text: "assistant internal note",
      finishReason: "stop",
    }));

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("下一步")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    const outputs = response.outputs?.toUser ?? [];
    expect(outputs.filter((item) => item.channel === "to_user").map((item) => item.content)).toEqual([
      "assistant internal note",
    ]);
    expect(outputs.filter((item) => item.channel === "self_talk").map((item) => item.content)).toEqual([
      "Observation: terminal idle\nDecision: wait\nNext: collect diff",
    ]);
  });

  test("Scenario: Given assistant self-talk in history When the next turn is built Then replayed history preserves factual self-talk without synthetic headings", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const seenInputs: ModelRespondInput[] = [];
    let round = 0;

    const modelClient = createModelClient(async (input) => {
      seenInputs.push(input);
      round += 1;
      if (round === 1) {
        return {
          thinking: "Observation: terminal idle",
          text: "Decision: wait for user",
          finishReason: "stop",
        };
      }
      return {
        thinking: "",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("first turn")]);
    await ai.send([createUserMessage("second turn")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    expect(replay).toEqual(["Observation: terminal idle", "Decision: wait for user"]);
    expect(replay.join("\n\n")).not.toContain("### Notes");
    expect(replay.join("\n\n")).not.toContain("### Replies");
    expect(replay.join("\n\n")).not.toContain("### Tool activity");
  });

  test("Scenario: Given assistant tool activity and reply When the next turn is built Then replayed history preserves factual order and raw tool fences", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "inspect terminal and report back", from: "user", score: 100 });
    const seenInputs: ModelRespondInput[] = [];
    let round = 0;

    const modelClient = createModelClient(async (input) => {
      seenInputs.push(input);
      round += 1;
      if (round === 1) {
        const terminalRead = input.tools.find((tool) => tool.name === "terminal_read");
        expect(terminalRead).toBeDefined();
        if (!terminalRead || typeof terminalRead.execute !== "function") {
          throw new Error("terminal_read tool missing");
        }

        await terminalRead.execute(
          {
            terminalId: "iflow",
          },
          {
            toolCallId: "call-terminal-read",
            emitCustomEvent: () => {},
          },
        );

        const attentionReply = input.tools.find((tool) => tool.name === "attention_reply");
        expect(attentionReply).toBeDefined();
        if (!attentionReply || typeof attentionReply.execute !== "function") {
          throw new Error("attention_reply tool missing");
        }

        await attentionReply.execute(
          {
            replyContent: "Terminal checked.",
            done: true,
            stage: "done",
            relationships: [{ id: tracked.id, score: 0, remark: "handled" }],
          },
          {
            toolCallId: "call-attention-reply",
            emitCustomEvent: () => {},
          },
        );

        return {
          thinking: "Observation: terminal focused",
          text: "Decision: report result",
          finishReason: "stop",
        };
      }
      return {
        thinking: "",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("first turn")]);
    await ai.send([createUserMessage("second turn")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    expect(replay).toHaveLength(7);
    expect(replay[0]).toBe("Observation: terminal focused");
    expect(replay[1]).toBe("Decision: report result");
    expect(replay[2]).toContain("```yaml+tool_call");
    expect(replay[2]).toContain("tool: terminal_read");
    expect(replay[3]).toContain("```yaml+tool_result");
    expect(replay[3]).toContain("tool: terminal_read");
    expect(replay[4]).toContain("```yaml+tool_call");
    expect(replay[4]).toContain("tool: attention_reply");
    expect(replay[5]).toContain("```yaml+tool_result");
    expect(replay[5]).toContain("tool: attention_reply");
    expect(replay[6]).toBe("Terminal checked.");
  });

  test("Scenario: Given /compact-like forced compact When next loop runs Then summarize includes attention_list and attention_reply still clears records", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "提醒我确认发布时间", from: "user", score: 100 });
    const summarizeInputs: string[] = [];

    let round = 0;
    const modelClient = {
      getMeta() {
        return {
          provider: "openai-compatible",
          model: "deepseek-chat",
          providerId: "default",
          baseUrl: "https://api.deepseek.com/v1",
        };
      },
      getCompactConfig() {
        return {};
      },
      async summarizeText(text: string) {
        summarizeInputs.push(text);
        return { summary: "compacted" };
      },
      async respondWithMeta(input: ModelRespondInput) {
        round += 1;
        if (round === 1) {
          return { thinking: "round1", text: "", finishReason: "stop" };
        }

        const attentionReply = input.tools.find((tool) => tool.name === "attention_reply");
        expect(attentionReply).toBeDefined();
        if (!attentionReply || typeof attentionReply.execute !== "function") {
          throw new Error("attention_reply tool missing");
        }

        await attentionReply.execute(
          {
            replyContent: "已完成压缩并继续处理。",
            done: true,
            stage: "done",
            relationships: [{ id: tracked.id, score: 0, remark: "压缩后已处理" }],
          },
          {
            toolCallId: "call-chat-reply",
            emitCustomEvent: () => {
              // no-op
            },
          },
        );
        return {
          thinking: "round2",
          text: "",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("第一轮")]);
    ai.requestCompact("test-/compact");
    const response = await ai.send([createUserMessage("/compact")]);

    expect(response).toBeDefined();
    if (!response) {
      return;
    }
    expect(summarizeInputs.length).toBeGreaterThan(0);
    expect(summarizeInputs.join("\n")).toContain("attention_system");
    expect(chat.engine.list()).toHaveLength(0);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeTrue();
  });

  test("Scenario: Given a stalled model call When timeout elapses Then AgenterAI persists running then error lifecycle records", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const lifecycle: Array<{
      status: "running" | "done" | "error";
      completedAt?: number;
      error?: { message: string; details?: unknown };
    }> = [];

    const modelClient = createModelClient(
      () =>
        new Promise(() => {
          // keep pending; AgenterAI timeout should resolve the outer flow
        }),
    );

    const ai = new AgenterAI({
      modelClient,
      modelCallTimeoutMs: 10,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      onModelCall: (record) => {
        lifecycle.push({
          status: record.status,
          completedAt: record.completedAt,
          error: record.error,
        });
      },
    });

    const response = await ai.send([createUserMessage("hello")]);

    expect(lifecycle).toHaveLength(2);
    expect(lifecycle[0]?.status).toBe("running");
    expect(lifecycle[0]?.completedAt).toBeUndefined();
    expect(lifecycle[1]?.status).toBe("error");
    expect(lifecycle[1]?.completedAt).toBeNumber();
    expect(lifecycle[1]?.error?.message).toContain("timed out after 10ms");
    expect(lifecycle[1]?.error?.details).toEqual({ timeout: true });
    expect((response.outputs?.toUser ?? []).some((item) => item.content.includes("timed out after 10ms"))).toBeTrue();
  });
});
