import { ChatEngine } from "@agenter/chat-system";
import type { TaskImportItem } from "@agenter/task-system";
import { describe, expect, test } from "bun:test";

import { AgenterAI } from "../src/agenter-ai";
import { type LoopBusMessage } from "../src/loop-bus";
import type { ModelClient, TextOnlyModelMessage } from "../src/model-client";
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
      focus: async () => ({ ok: true, message: "focused", focusedTerminalId: "iflow" }),
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
      sliceDirty: async () => ({ ok: true, changed: false }),
    },
  };
};

const createChatGateway = () => {
  const engine = new ChatEngine();
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
    let capturedMessages: TextOnlyModelMessage[] | null = null;
    const terminal = createTerminalGateway();
    const chat = createChatGateway();
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
      chatGateway: chat.gateway,
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

    const joinedHistory =
      capturedMessages?.map((item) => item.content.map((part) => part.content).join("\n")).join("\n\n") ?? "";
    expect(joinedHistory).toContain("IFLOW HELP CONTENT");
    expect(joinedHistory).not.toContain("<CliHelp");
  });

  test("Scenario: Given active chat_list When model uses chat_reply relationships Then attention items are cleared", async () => {
    const terminal = createTerminalGateway();
    const chat = createChatGateway();
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

      const list = (await callTool("chat_list", {})) as { items: Array<{ id: number }> };
      expect(list.items.some((item) => item.id === userItem.id)).toBeTrue();

      await callTool("chat_reply", {
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
      chatGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(chat.engine.list()).toHaveLength(0);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeTrue();
  });

  test("Scenario: Given no chat_reply When model returns plain text Then output stays self_talk only", async () => {
    const terminal = createTerminalGateway();
    const chat = createChatGateway();
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
      chatGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("下一步")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    const outputs = response.outputs?.toUser ?? [];
    expect(outputs.some((item) => item.channel === "to_user")).toBeFalse();
    expect(outputs.some((item) => item.channel === "self_talk")).toBeTrue();
  });

  test("Scenario: Given /compact-like forced compact When next loop runs Then summarize includes chat_list and chat_reply still clears records", async () => {
    const terminal = createTerminalGateway();
    const chat = createChatGateway();
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

        const chatReply = input.tools.find((tool) => tool.name === "chat_reply");
        expect(chatReply).toBeDefined();
        if (!chatReply || typeof chatReply.execute !== "function") {
          throw new Error("chat_reply tool missing");
        }

        await chatReply.execute(
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
      chatGateway: chat.gateway,
    });

    await ai.send([createUserMessage("第一轮")]);
    ai.requestCompact("test-/compact");
    const response = await ai.send([createUserMessage("/compact")]);

    expect(response).toBeDefined();
    if (!response) {
      return;
    }
    expect(summarizeInputs.length).toBeGreaterThan(0);
    expect(summarizeInputs.join("\n")).toContain("chat_attention");
    expect(chat.engine.list()).toHaveLength(0);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeTrue();
  });
});
