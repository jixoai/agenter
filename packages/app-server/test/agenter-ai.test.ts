import type {
  AttentionActiveContextMatch,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import { AttentionSystem } from "@agenter/attention-system";
import type { TaskImportItem } from "@agenter/task-system";
import { describe, expect, test } from "bun:test";

import { AgenterAI, type AgentModelCallRecord } from "../src/agenter-ai";
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

const isAssistantHistoryMessage = (message: unknown): message is { role: "assistant" } =>
  typeof message === "object" && message !== null && "role" in message && message.role === "assistant";

const toReplayMessages = (input: ModelRespondInput | readonly unknown[] | undefined): readonly unknown[] => {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return (input as ModelRespondInput).messages;
};

const extractAssistantReplay = (input: ModelRespondInput | readonly unknown[] | undefined): string[] => {
  const messages = toReplayMessages(input);
  return messages.filter(isAssistantHistoryMessage).map((message) => flattenModelMessageContent(message));
};

const extractUserReplay = (input: ModelRespondInput | readonly unknown[] | undefined): string[] => {
  const messages = toReplayMessages(input);
  return messages
    .filter((message): message is { role: "user" } => typeof message === "object" && message !== null && "role" in message && message.role === "user")
    .map((message) => flattenModelMessageContent(message));
};

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
      create: async () => ({ ok: true, message: "created" }),
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
      snapshot: async () => ({ ok: true }),
      getConfig: async () => ({ transport: { port: 4100 } }),
      setConfig: async () => ({ transport: { port: 4100 } }),
    },
  };
};

const createAttentionGateway = () => {
  const system = new AttentionSystem();
  const defaultContextId = "ctx-main";
  system.createContext({ contextId: defaultContextId, owner: "tester" });

  const listActive = (): AttentionActiveContextMatch[] => system.listActiveContexts();
  const commitLegacy = (input: { content: string; from: string; score?: number; remark?: string }) => {
    const hash = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const commit = system.commit(defaultContextId, {
      meta: {
        author: input.from,
        source: "test",
      },
      scores: {
        [hash]: input.score ?? 100,
      },
      summary: input.content,
      change: input.remark
        ? {
            type: "update",
            value: input.remark,
            format: "text/plain",
          }
        : {
            type: "update",
            value: input.content,
            format: "text/plain",
          },
    }).commit;
    return {
      ...commit,
      id: commit.commitId,
    };
  };

  return {
    system,
    defaultContextId,
    engine: {
      add: commitLegacy,
      list: () => listActive(),
      query: (input: { minScore?: number; query?: string }) =>
        system.query({
          minScore: input.minScore,
          text: input.query,
          limit: 200,
        }),
    },
    gateway: {
      listContexts: (): AttentionContextDescriptor[] => system.listContexts(),
      listActive: () => listActive(),
      query: async (input: {
        contextId?: string;
        hash?: string;
        depth?: number;
        minScore?: number;
        author?: string;
        source?: string;
        text?: string;
        offset?: number;
        limit?: number;
      }): Promise<AttentionCommitMatch[]> => system.query(input),
      commit: async (input: AttentionCommitToolInput) =>
        system.commit(input.contextId, {
          parentCommitIds: input.parentCommitIds,
          meta: input.meta,
          scores: input.scores,
          summary: input.summary,
          change: input.change,
        }).commit,
    },
  };
};

const createMessageGateway = () => {
  const sent: Array<{
    chatId: string;
    content: string;
    rootId?: string;
    from?: string;
    to?: string;
  }> = [];
  return {
    sent,
    gateway: {
      send: async (input: {
        chatId: string;
        content: string;
        rootId?: string;
        from?: string;
        to?: string;
      }) => {
        sent.push(input);
        return {
          ok: true,
          messageId: `msg-${sent.length}`,
        };
      },
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

const createAttentionMessage = (
  text: string,
  input: {
    id?: string;
    name?: string;
    timestamp?: number;
    meta?: Record<string, string | number | boolean | null>;
  } = {},
): LoopBusMessage => ({
  id: input.id ?? "m-attention",
  timestamp: input.timestamp ?? Date.now(),
  name: input.name ?? "Attention-ctx-main",
  role: "user",
  type: "text",
  source: "attention",
  text,
  meta: {
    attentionContextId: "ctx-main",
    attentionHeadCommitId: "commit-1",
    ...(input.meta ?? {}),
  },
});

describe("Feature: AgenterAI behavior", () => {
  test("Scenario: Given a model call When terminal tools are exposed Then create config and snapshot tools are available while legacy aliases stay hidden", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    let toolNames: string[] = [];

    const modelClient = createModelClient(async (input) => {
      toolNames = input.tools.map((tool) => tool.name);
      return {
        thinking: "",
        text: "checked",
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

    await ai.send([createUserMessage("inspect the terminal surface")]);

    expect(toolNames).toContain("terminal_create");
    expect(toolNames).toContain("terminal_read");
    expect(toolNames).toContain("terminal_snapshot");
    expect(toolNames).toContain("terminal_get_config");
    expect(toolNames).toContain("terminal_set_config");
    expect(toolNames).not.toContain("terminal_run");
  });

  test("Scenario: Given a message gateway When tools are exposed Then message_send is available and dispatches through message-system", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    let toolNames: string[] = [];

    const modelClient = createModelClient(async (input) => {
      toolNames = input.tools.map((tool) => tool.name);
      const tool = input.tools.find((entry) => entry.name === "message_send");
      expect(tool).toBeDefined();
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("message_send tool missing");
      }

      const result = (await tool.execute(
        {
          chatId: "chat-main",
          content: "hello from tool",
        },
        {
          toolCallId: "call-message-send",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; messageId: string };

      expect(result.ok).toBeTrue();
      expect(result.messageId).toBe("msg-1");
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
      messageGateway: message.gateway,
    });

    await ai.send([createUserMessage("dispatch a message")]);

    expect(toolNames).toContain("message_send");
    expect(message.sent).toEqual([
      {
        chatId: "chat-main",
        content: "hello from tool",
      },
    ]);
  });

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

  test("Scenario: Given active attention items When model patches the tracked item and still emits plain text Then the item is cleared without leaking a duplicate user-visible reply", async () => {
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

      const list = (await callTool("attention_query", {
        contextId: chat.defaultContextId,
        minScore: 1,
        limit: 20,
      })) as { items: Array<{ commit: { commitId: string } }> };
      expect(list.items.some((item) => item.commit.commitId === userItem.commitId)).toBeTrue();

      await callTool("attention_commit", {
        contextId: chat.defaultContextId,
        parentCommitIds: [userItem.commitId],
        meta: {
          author: "assistant",
          source: "test",
        },
        scores: Object.fromEntries(Object.keys(userItem.scores).map((key) => [key, 0])),
        summary: "我已确认需求，开始实现。",
        change: {
          type: "update",
          value: "已处理",
          format: "text/plain",
        },
        done: false,
        stage: "act",
      });

      return {
        thinking: "已读取对话注意力并处理。",
        text: "我已确认需求，开始实现。",
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
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();
  });

  test("Scenario: Given no active attention items When model appends a resolved item Then an internal fact is recorded without a user-visible reply", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      const tool = input.tools.find((item) => item.name === "attention_commit");
      expect(tool).toBeDefined();
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("attention_commit tool missing");
      }

      const result = (await tool.execute(
        {
          contextId: chat.defaultContextId,
          meta: {
            author: "system",
            source: "test",
          },
          scores: {
            "startup-ping": 0,
          },
          summary: "startup ping",
          change: {
            type: "update",
            value: "startup ping",
            format: "text/plain",
          },
          stage: "observe",
        },
        {
          toolCallId: "call-attention_commit",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; commitId: string };

      expect(result.ok).toBeTrue();
      expect(result.commitId.length).toBeGreaterThan(0);

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

    expect(chat.engine.list()).toHaveLength(0);
    expect(chat.engine.query({ minScore: 0, query: "startup ping" })).toHaveLength(1);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();
  });

  test("Scenario: Given no attention item write When model returns plain text Then output is published as a user-facing assistant reply", async () => {
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

  test("Scenario: Given an attention-only round When model returns plain text without mutation Then the runtime retries once, records the no-op as invalid, and keeps no false assistant history", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    let calls = 0;
    const modelCalls: AgentModelCallRecord[] = [];
    const ai = new AgenterAI({
      modelClient: createModelClient(async () => ({
        thinking: `Observation: unresolved attention still pending (${++calls})`,
        text: "I'll tell the user I am done now.",
        finishReason: "stop",
      })),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([createAttentionMessage("contextId: ctx-main\nitemId: item-1\npending score")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(calls).toBe(2);
    expect(response.done).toBeFalse();
    expect(response.outputs?.toUser ?? []).toEqual([]);
    expect(extractAssistantReplay(ai.inspectDebugState().history)).toEqual([]);

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(2);
    expect(finalRecords.every((record) => record.status === "error")).toBeTrue();
    expect(finalRecords[0]?.outcome?.reason).toBe("attention.no_progress");
    expect(finalRecords[0]?.outcome?.retryable).toBeTrue();
    expect(finalRecords[1]?.outcome?.reason).toBe("attention.no_progress");
    expect(finalRecords[1]?.outcome?.retryable).toBeFalse();
  });

  test("Scenario: Given chat-backed attention When the model clears scores without dispatching a visible reply Then the runtime retries until message_send closes the loop", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    const tracked = chat.engine.add({ content: "Reply with exactly PLAYWRIGHT-MOCK-REPLY", from: "user", score: 100 });
    let calls = 0;
    const modelCalls: AgentModelCallRecord[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        calls += 1;
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        const messageSend = input.tools.find((tool) => tool.name === "message_send");
        expect(attentionCommit).toBeDefined();
        expect(messageSend).toBeDefined();
        if (
          !attentionCommit ||
          typeof attentionCommit.execute !== "function" ||
          !messageSend ||
          typeof messageSend.execute !== "function"
        ) {
          throw new Error("message attention tools missing");
        }

        if (calls === 1) {
          await attentionCommit.execute(
            {
              contextId: chat.defaultContextId,
              parentCommitIds: [tracked.commitId],
              meta: {
                author: "assistant",
                source: "test",
                systemId: "message",
                subjectId: "chat-main",
                channelId: "chat-main",
              },
              scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
              summary: "Reply with exactly PLAYWRIGHT-MOCK-REPLY",
              change: {
                type: "update",
                value: "PLAYWRIGHT-MOCK-REPLY",
                format: "text/plain",
              },
              done: true,
              stage: "done",
            },
            {
              toolCallId: "call-attention-commit-1",
              emitCustomEvent: () => {},
            },
          );
          return {
            thinking: "",
            text: "",
            finishReason: "stop",
          };
        }

        await messageSend.execute(
          {
            chatId: "chat-main",
            content: "PLAYWRIGHT-MOCK-REPLY",
          },
          {
            toolCallId: "call-message-send-2",
            emitCustomEvent: () => {},
          },
        );
        await attentionCommit.execute(
          {
            contextId: chat.defaultContextId,
            meta: {
              author: "assistant",
              source: "test",
              systemId: "message",
              subjectId: "chat-main",
              channelId: "chat-main",
            },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
            summary: "Reply with exactly PLAYWRIGHT-MOCK-REPLY",
            change: {
              type: "update",
              value: "PLAYWRIGHT-MOCK-REPLY",
              format: "text/plain",
            },
            done: true,
            stage: "done",
          },
          {
            toolCallId: "call-attention-commit-2",
            emitCustomEvent: () => {},
          },
        );
        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      messageGateway: message.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([
      {
        ...createAttentionMessage("contextId: ctx-main\nscore: 100"),
        meta: {
          attentionContextId: chat.defaultContextId,
          attentionHeadCommitId: tracked.commitId,
          chatId: "chat-main",
        },
      },
    ]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(calls).toBe(2);
    expect(response.done).toBeTrue();
    expect(message.sent.map((item) => ({ chatId: item.chatId, content: item.content }))).toEqual([
      {
        chatId: "chat-main",
        content: "PLAYWRIGHT-MOCK-REPLY",
      },
    ]);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(2);
    expect(finalRecords[0]?.status).toBe("error");
    expect(finalRecords[0]?.outcome?.reason).toBe("attention.missing_message_dispatch");
    expect(finalRecords[0]?.outcome?.retryable).toBeTrue();
    expect(finalRecords[1]?.status).toBe("done");
  });

  test("Scenario: Given a focused main chat and an unfocused relay chat When the model resolves both contexts Then only the focused chat requires a visible dispatch", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    const modelCalls: AgentModelCallRecord[] = [];
    let calls = 0;

    chat.system.createContext({ contextId: "ctx-chat-main", owner: "tester" });
    chat.system.createContext({ contextId: "ctx-chat-gaubee", owner: "tester" });

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        calls += 1;
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        const messageSend = input.tools.find((tool) => tool.name === "message_send");
        if (
          !attentionCommit ||
          typeof attentionCommit.execute !== "function" ||
          !messageSend ||
          typeof messageSend.execute !== "function"
        ) {
          throw new Error("message attention tools missing");
        }

        await messageSend.execute(
          {
            chatId: "chat-main",
            content: "gaubee 说中午吃蛋炒饭",
          },
          {
            toolCallId: "call-message-send-main",
            emitCustomEvent: () => {},
          },
        );
        await attentionCommit.execute(
          {
            contextId: "ctx-chat-main",
            meta: {
              author: "assistant",
              source: "test",
              systemId: "message",
              subjectId: "chat-main",
              channelId: "chat-main",
            },
            scores: { hash_main: 0 },
            summary: "main reply delivered",
            change: {
              type: "update",
              value: "gaubee 说中午吃蛋炒饭",
              format: "text/plain",
            },
            done: true,
          },
          {
            toolCallId: "call-attention-commit-main",
            emitCustomEvent: () => {},
          },
        );
        await attentionCommit.execute(
          {
            contextId: "ctx-chat-gaubee",
            meta: {
              author: "assistant",
              source: "test",
              systemId: "message",
              subjectId: "chat-gaubee",
              channelId: "chat-gaubee",
            },
            scores: { hash_gaubee: 0 },
            summary: "relay reply consumed",
            change: {
              type: "update",
              value: "gaubee reply has been consumed by the main conversation",
              format: "text/plain",
            },
            done: true,
          },
          {
            toolCallId: "call-attention-commit-gaubee",
            emitCustomEvent: () => {},
          },
        );
        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      messageGateway: message.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([
      createAttentionMessage("ctx-chat-main pending", {
        id: "attention-main",
        name: "Attention-ctx-chat-main",
        timestamp: 1,
        meta: {
          attentionContextId: "ctx-chat-main",
          attentionHeadCommitId: "commit-main",
          chatId: "chat-main",
          chatFocused: true,
          createdAt: "2026-03-26T10:00:00.000Z",
        },
      }),
      createAttentionMessage("ctx-chat-gaubee pending", {
        id: "attention-gaubee",
        name: "Attention-ctx-chat-gaubee",
        timestamp: 2,
        meta: {
          attentionContextId: "ctx-chat-gaubee",
          attentionHeadCommitId: "commit-gaubee",
          chatId: "chat-gaubee",
          chatFocused: false,
          createdAt: "2026-03-26T10:00:01.000Z",
        },
      }),
    ]);

    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(calls).toBe(1);
    expect(message.sent).toEqual([
      {
        chatId: "chat-main",
        content: "gaubee 说中午吃蛋炒饭",
      },
    ]);
    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(1);
    expect(finalRecords[0]?.status).toBe("done");
    expect(finalRecords[0]?.outcome?.code).toBe("done");
  });

  test("Scenario: Given an attention-only round When model only calls read tools without mutating attention Then the runtime still treats the round as no progress", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    let calls = 0;
    const modelCalls: AgentModelCallRecord[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        calls += 1;
        const terminalList = input.tools.find((tool) => tool.name === "terminal_list");
        expect(terminalList).toBeDefined();
        if (!terminalList || typeof terminalList.execute !== "function") {
          throw new Error("terminal_list tool missing");
        }

        await terminalList.execute({}, { toolCallId: `call-terminal_list-${calls}`, emitCustomEvent: () => {} });
        return {
          thinking: "Observed terminal topology.",
          text: "I checked the terminal.",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([createAttentionMessage("contextId: ctx-main\nitemId: item-1\npending score")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(calls).toBe(2);
    expect(response.done).toBeFalse();
    expect(response.outputs?.toUser ?? []).toEqual([]);

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(2);
    expect(finalRecords.every((record) => record.outcome?.reason === "attention.no_progress")).toBeTrue();
    expect(finalRecords.every((record) => (record.response?.toolTrace?.length ?? 0) >= 1)).toBeTrue();
  });

  test("Scenario: Given an attention-only round When the first model response is a no-op Then the retry reminder can still drive a real attention mutation", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "resolve me", from: "user", score: 100 });
    let calls = 0;

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        calls += 1;
        if (calls === 1) {
          return {
            thinking: "Observation: unresolved attention still pending",
            text: "I am done.",
            finishReason: "stop",
          };
        }

        const attentionQuery = input.tools.find((tool) => tool.name === "attention_query");
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionQuery).toBeDefined();
        expect(attentionCommit).toBeDefined();
        if (
          !attentionQuery ||
          typeof attentionQuery.execute !== "function" ||
          !attentionCommit ||
          typeof attentionCommit.execute !== "function"
        ) {
          throw new Error("attention tools missing");
        }

        const matches = (await attentionQuery.execute(
          {
            contextId: chat.defaultContextId,
            minScore: 1,
            limit: 20,
          },
          {
            toolCallId: "call-attention_query",
            emitCustomEvent: () => {},
          },
        )) as { items: Array<{ commit: { commitId: string } }> };

        expect(matches.items.some((item) => item.commit.commitId === tracked.commitId)).toBeTrue();
        expect(flattenModelMessageContent(input.messages.at(-1))).toContain("attention_round_retry");

        await attentionCommit.execute(
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: {
              author: "assistant",
              source: "test",
            },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
            summary: "resolved",
            change: {
              type: "update",
              value: "patched after retry",
              format: "text/plain",
            },
            done: true,
            stage: "done",
          },
          {
            toolCallId: "call-attention_commit",
            emitCustomEvent: () => {},
          },
        );

        return {
          thinking: "Observation: patched the attention item",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createAttentionMessage("contextId: ctx-main\nitemId: item-1\npending score")]);
    expect(response).toBeDefined();
    if (!response) {
      return;
    }

    expect(calls).toBe(2);
    expect(response.done).toBeTrue();
    expect(chat.engine.list()).toHaveLength(0);
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();
  });

  test("Scenario: Given attention-first follow-up rounds When the next prompt is built Then assistant tool fences are excluded from replay history", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "ask gaubee then report back", from: "user", score: 100 });
    const seenInputs: ModelRespondInput[] = [];
    let round = 0;

    const modelClient = createModelClient(async (input) => {
      seenInputs.push(input);
      round += 1;

      if (round === 1) {
        const sendMessage = input.tools.find((tool) => tool.name === "message_send");
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        if (!sendMessage || typeof sendMessage.execute !== "function" || !attentionCommit || typeof attentionCommit.execute !== "function") {
          throw new Error("message attention tools missing");
        }

        await sendMessage.execute(
          {
            chatId: "chat-gaubee",
            content: "在吗？kzf 问你中午吃什么？",
          },
          {
            toolCallId: "call-message-send",
            emitCustomEvent: () => {},
          },
        );
        await attentionCommit.execute(
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: {
              author: "assistant",
              source: "test",
            },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 50])),
            summary: "waiting for gaubee",
            change: {
              type: "update",
              value: "relay sent",
              format: "text/plain",
            },
            stage: "act",
          },
          {
            toolCallId: "call-attention-commit",
            emitCustomEvent: () => {},
          },
        );
        return {
          thinking: "",
          text: "",
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
      messageGateway: {
        send: async () => ({ ok: true, messageId: "msg-test" }),
      },
    });

    await ai.send([createAttentionMessage("ctx-main unresolved")]);
    await ai.send([createAttentionMessage("ctx-gaubee replied")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    const userReplay = extractUserReplay(seenInputs[1]);
    expect(replay).toEqual([]);
    expect(userReplay).toHaveLength(1);
    expect(userReplay[0]).toContain("ctx-gaubee replied");
    expect(userReplay[0]).not.toContain("ctx-main unresolved");
    expect(flattenModelMessageContent(seenInputs[1].messages.at(-1))).toContain("ctx-gaubee");
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

        const attentionUpdate = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionUpdate).toBeDefined();
        if (!attentionUpdate || typeof attentionUpdate.execute !== "function") {
          throw new Error("attention_commit tool missing");
        }

        await attentionUpdate.execute(
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: {
              author: "assistant",
              source: "test",
            },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
            summary: "Terminal checked.",
            change: {
              type: "update",
              value: "handled",
              format: "text/plain",
            },
            done: true,
            stage: "done",
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
    expect(replay).toHaveLength(5);
    expect(replay[0]).toBe("Observation: terminal focused");
    expect(replay[1]).toContain("```yaml+tool_call");
    expect(replay[1]).toContain("tool: terminal_read");
    expect(replay[2]).toContain("```yaml+tool_result");
    expect(replay[2]).toContain("tool: terminal_read");
    expect(replay[3]).toContain("```yaml+tool_call");
    expect(replay[3]).toContain("tool: attention_commit");
    expect(replay[4]).toContain("```yaml+tool_result");
    expect(replay[4]).toContain("tool: attention_commit");
  });

  test("Scenario: Given /compact-like forced compact When next loop runs Then summarize includes attention_system and attention item patching still clears records", async () => {
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

        const attentionUpdate = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionUpdate).toBeDefined();
        if (!attentionUpdate || typeof attentionUpdate.execute !== "function") {
          throw new Error("attention_commit tool missing");
        }

        await attentionUpdate.execute(
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: {
              author: "assistant",
              source: "test",
            },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
            summary: "已完成压缩并继续处理。",
            change: {
              type: "update",
              value: "压缩后已处理",
              format: "text/plain",
            },
            done: true,
            stage: "done",
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
    expect((response.outputs?.toUser ?? []).some((item) => item.channel === "to_user")).toBeFalse();
  });

  test("Scenario: Given a stalled model call When timeout elapses Then AgenterAI persists running then error lifecycle records", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const lifecycle: Array<{
      status: "running" | "done" | "error" | "cancelled";
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
    if (!response || !response.outputs?.toUser) {
      throw new Error("Expected a loop bus response payload.");
    }
    expect(response.outputs.toUser.some((item) => item.content.includes("timed out after 10ms"))).toBeTrue();
  });

  test("Scenario: Given async model-call observers When a round finishes Then AgenterAI waits for the terminal lifecycle record before resolving", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const lifecycle: Array<{
      status: "running" | "done" | "error" | "cancelled";
      completedAt?: number;
    }> = [];

    const modelClient = createModelClient(async () => ({
      thinking: "",
      text: "done",
      finishReason: "stop",
    }));

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal.gateway,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        lifecycle.push({
          status: record.status,
          completedAt: record.completedAt,
        });
      },
    });

    const response = await ai.send([createUserMessage("hello")]);

    expect(lifecycle).toHaveLength(2);
    expect(lifecycle[0]).toMatchObject({ status: "running", completedAt: undefined });
    expect(lifecycle[1]?.status).toBe("done");
    expect(lifecycle[1]?.completedAt).toBeNumber();
    expect(response?.outputs?.toUser?.some((item) => item.content === "done")).toBeTrue();
  });

  test("Scenario: Given an external stop during server-tool execution When the shared signal aborts Then AgenterAI cancels the round instead of accepting the late tool result", async () => {
    const lifecycle: Array<{
      status: "running" | "done" | "error" | "cancelled";
      completedAt?: number;
      outcome?: AgentModelCallRecord["outcome"];
      error?: { message: string; details?: unknown };
    }> = [];
    const writeCalls: Array<{ terminalId: string; text: string }> = [];
    const terminal = {
      list: () => [],
      create: async () => ({ ok: true, message: "created" }),
      kill: async () => ({ ok: true, message: "stopped" }),
      focus: async () => ({ ok: true, message: "focused", focusedTerminalIds: ["iflow"] }),
      write: async (input: { terminalId: string; text: string }) => {
        writeCalls.push(input);
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true, message: "written" };
      },
      read: async () => ({ ok: true }),
      snapshot: async () => ({ ok: true }),
      getConfig: async () => ({ transport: { port: 4100 } }),
      setConfig: async () => ({ transport: { port: 4100 } }),
    };
    const chat = createAttentionGateway();
    const externalAbort = new AbortController();

    const modelClient = createModelClient(async (input) => {
      const tool = input.tools.find((entry) => entry.name === "terminal_write");
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("terminal_write tool missing");
      }
      setTimeout(() => {
        externalAbort.abort("session.stop");
      }, 5);
      await tool.execute(
        {
          terminalId: "iflow",
          text: "echo still-running",
          submit: true,
        },
        {
          toolCallId: "call-terminal-write",
          emitCustomEvent: () => {},
        },
      );
      return {
        thinking: "",
        text: "should never resolve after abort",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      terminalGateway: terminal,
      taskGateway: createTaskGateway(),
      attentionGateway: chat.gateway,
      onModelCall: (record) => {
        lifecycle.push({
          status: record.status,
          completedAt: record.completedAt,
          outcome: record.outcome,
          error: record.error,
        });
      },
    });

    await expect(ai.send([createUserMessage("run a terminal tool")], { signal: externalAbort.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(writeCalls).toEqual([
      {
        terminalId: "iflow",
        text: "echo still-running",
        submit: true,
      },
    ]);
    expect(lifecycle).toHaveLength(2);
    expect(lifecycle[0]?.status).toBe("running");
    expect(lifecycle[1]?.status).toBe("cancelled");
    expect(lifecycle[1]?.outcome?.code).toBe("stopped");
    expect(lifecycle[1]?.error?.details).toEqual({ canceled: true });
  });
});
