import { describe, expect, test } from "bun:test";
import { ChatEngine } from "@agenter/chat-system";
import type { TaskImportItem } from "@agenter/task-system";

import { AgentRuntime } from "../src/agent-runtime";
import { AgenterAI } from "../src/agenter-ai";
import type { LoopBusInput, LoopBusMessage } from "../src/loop-bus";
import type { ModelClient, TextOnlyModelMessage } from "../src/model-client";
import type { PromptDocRecord } from "../src/prompt-docs";
import { FilePromptStore } from "../src/prompt-store";
import type { AppServerLogger, ChatMessage } from "../src/types";

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
    // no-op
  },
});

type ModelRespondInput = Parameters<ModelClient["respondWithMeta"]>[0];

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

const createTerminalGateway = () => ({
  list: () => [],
  run: async () => ({ ok: true, message: "started" }),
  kill: async () => ({ ok: true, message: "stopped" }),
  focus: async () => ({ ok: true, message: "focused", focusedTerminalId: "iflow" }),
  write: async () => ({ ok: true, message: "written" }),
  read: async () => ({ ok: true }),
  sliceDirty: async () => ({ ok: true, changed: false }),
});

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pushAndTrackUser = (input: {
  bus: AgentRuntime<ChatMessage>;
  chatEngine: ChatEngine;
  text: string;
}): LoopBusMessage => {
  input.chatEngine.add({
    content: input.text,
    from: "user",
    score: 100,
  });
  return input.bus.pushMessage({
    name: "User",
    role: "user",
    type: "text",
    source: "chat",
    text: input.text,
  });
};

describe("Feature: runtime loop with chat-system facts", () => {
  test("Scenario: Given user message without immediate chat_reply When loop idles Then chat-system facts trigger next round and clear attention", async () => {
    const chatEngine = new ChatEngine();
    const assistantOutputs: ChatMessage[] = [];
    const seenInputBatches: LoopBusMessage[][] = [];

    let modelCalls = 0;
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
      async summarizeText() {
        return { summary: "", skipped: "not used" };
      },
      async respondWithMeta(input: ModelRespondInput) {
        modelCalls += 1;
        seenInputBatches.push(input.messages.flatMap((item) => {
          const content = item.content.map((part) => part.content).join("\n");
          return [{
            id: createId(),
            timestamp: Date.now(),
            name: item.role,
            role: "user" as const,
            type: "text" as const,
            source: "chat" as const,
            text: content,
          }];
        }));

        if (modelCalls === 1) {
          return {
            thinking: "Observation: user asked task\nDecision: wait for more facts\nNext: check chat attention",
            text: "",
            finishReason: "stop" as const,
          };
        }

        const listTool = input.tools.find((tool) => tool.name === "chat_list");
        const replyTool = input.tools.find((tool) => tool.name === "chat_reply");
        expect(listTool).toBeDefined();
        expect(replyTool).toBeDefined();
        if (!listTool || !replyTool || typeof listTool.execute !== "function" || typeof replyTool.execute !== "function") {
          throw new Error("chat tools unavailable");
        }

        const listed = (await listTool.execute(
          {},
          { toolCallId: "call-chat-list", emitCustomEvent: () => undefined },
        )) as { items: Array<{ id: number }> };
        expect(listed.items.length).toBeGreaterThan(0);

        await replyTool.execute(
          {
            replyContent: "收到，我会继续推进。",
            done: true,
            stage: "done",
            relationships: listed.items.map((item) => ({ id: item.id, score: 0, remark: "cleared" })),
          },
          { toolCallId: "call-chat-reply", emitCustomEvent: () => undefined },
        );

        return {
          thinking: "Attention handled.",
          text: "",
          finishReason: "stop" as const,
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: createTerminalGateway(),
      taskGateway: createTaskGateway(),
      chatGateway: {
        list: () => chatEngine.list(),
        add: async (input) => chatEngine.add(input),
        remark: async (input) => chatEngine.remark(input),
        query: async (input) => chatEngine.query(input),
        reply: async (input) => chatEngine.reply(input),
      },
    });

    let injectedFacts = 0;
    const runtime = new AgentRuntime<ChatMessage>({
      processor: ai,
      logger: createLogger(),
      idleCollectIntervalMs: 120,
      collectInputs: async () => {
        const active = chatEngine.list();
        if (active.length === 0) {
          return;
        }
        injectedFacts += 1;
        return {
          name: "ChatSystem",
          role: "user",
          type: "text",
          source: "chat-system",
          text: JSON.stringify({ kind: "chat-system-list", count: active.length, items: active }),
        };
      },
      onUserMessage: (message) => {
        assistantOutputs.push(message);
      },
    });

    runtime.start();
    pushAndTrackUser({ bus: runtime, chatEngine, text: "继续处理这个任务" });

    const deadline = Date.now() + 2_500;
    while (Date.now() < deadline) {
      if (modelCalls >= 2 && chatEngine.list().length === 0) {
        break;
      }
      await Bun.sleep(40);
    }
    runtime.stop();

    expect(modelCalls).toBeGreaterThanOrEqual(2);
    expect(injectedFacts).toBeGreaterThanOrEqual(1);
    expect(chatEngine.list()).toHaveLength(0);
    expect(assistantOutputs.some((item) => item.channel === "to_user")).toBeTrue();
    expect(assistantOutputs.some((item) => item.channel === "self_talk")).toBeTrue();
    expect(seenInputBatches.length).toBeGreaterThanOrEqual(2);
  });
});
