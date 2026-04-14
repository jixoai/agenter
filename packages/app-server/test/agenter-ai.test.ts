import type {
  AttentionActiveContextMatch,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import { AttentionSystem } from "@agenter/attention-system";
import { toolDefinition } from "@tanstack/ai";
import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  AgenterAI,
  type AgentModelCallRecord,
  type AgentPromptWindowCompactSummary,
  type AgentPromptWindowStateRecord,
  type AgentToolProvider,
} from "../src/agenter-ai";
import { buildAttentionSearchDocument } from "../src/attention-search/documents";
import { compileAttentionSearch } from "../src/attention-search/query";
import type { AttentionSearchRequest } from "../src/attention-search/types";
import { type LoopBusMessage } from "../src/loop-bus";
import type { ModelClient } from "../src/model-client";
import type { PromptDocRecord } from "../src/prompt-docs";
import { FilePromptStore } from "../src/prompt-store";
import type { AppServerLogger } from "../src/types";

const createPromptDocs = (input: { legacySystemTemplate?: boolean } = {}): PromptDocRecord => ({
  AGENTER: { syntax: "mdx", content: "" },
  AGENTER_SYSTEM: { syntax: "mdx", content: 'You are <Slot name="AVATAR_NAME" />.' },
  SYSTEM_TEMPLATE: {
    syntax: "mdx",
    content: input.legacySystemTemplate
      ? `<Slot name="AGENTER_SYSTEM" />\n\n<Slot name="AGENTER" />\n\n<Slot name="RESPONSE_CONTRACT" />`
      : `<Slot name="AGENTER_SYSTEM" />\n\n<Slot name="SYSTEMS_GUIDE" />\n\n<Slot name="AGENTER" />\n\n<Slot name="RESPONSE_CONTRACT" />`,
  },
  RESPONSE_CONTRACT: { syntax: "mdx", content: "Use tools when needed." },
});

const createLogger = (): AppServerLogger => ({
  log: () => {
    // no-op in tests
  },
});

const createPromptWindowStoreSpy = (
  initialMessages: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"] = [],
): {
  appendCalls: Array<{
    createdAt?: number;
    messages: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"];
    setCurrent?: boolean;
  }>;
  initialState: AgentPromptWindowStateRecord;
  states: AgentPromptWindowStateRecord[];
  store: {
    append: (input: {
      createdAt?: number;
      messages: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"];
      setCurrent?: boolean;
    }) => AgentPromptWindowStateRecord;
  };
} => {
  let nextId = 1;
  const appendCalls: Array<{
    createdAt?: number;
    messages: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"];
    setCurrent?: boolean;
  }> = [];
  const initialState: AgentPromptWindowStateRecord = {
    id: String(nextId),
    createdAt: 0,
    roundIndex: 0,
    messages: structuredClone(initialMessages),
  };
  const states: AgentPromptWindowStateRecord[] = [initialState];
  return {
    appendCalls,
    initialState,
    states,
    store: {
      append: (input) => {
        appendCalls.push({
          createdAt: input.createdAt,
          messages: structuredClone(input.messages),
          setCurrent: input.setCurrent,
        });
        const record: AgentPromptWindowStateRecord = {
          id: String(++nextId),
          createdAt: input.createdAt ?? nextId,
          roundIndex: states.at(-1)?.roundIndex ?? 0,
          messages: structuredClone(input.messages),
        };
        states.push(record);
        return record;
      },
    },
  };
};

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
    .filter(
      (message): message is { role: "user" } =>
        typeof message === "object" && message !== null && "role" in message && message.role === "user",
    )
    .map((message) => flattenModelMessageContent(message));
};

const extractReplayRoles = (input: ModelRespondInput | readonly unknown[] | undefined): Array<"user" | "assistant"> => {
  const messages = toReplayMessages(input);
  return messages
    .map((message) => (typeof message === "object" && message !== null && "role" in message ? message.role : null))
    .filter((role): role is "user" | "assistant" => role === "user" || role === "assistant");
};

const countOccurrences = (value: string, needle: string): number =>
  value.length === 0 || needle.length === 0 ? 0 : value.split(needle).length - 1;

const isCompactDecision = (
  value: unknown,
): value is {
  kind: "compact";
  summary: AgentPromptWindowCompactSummary;
} =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "compact" &&
  "summary" in value;

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

const createTerminalGateway = () => {
  const writeCalls: Array<{ terminalId: string; text: string; submit?: boolean; submitKey?: "enter" | "linefeed" }> =
    [];
  return {
    writeCalls,
    gateway: {
      list: () => [],
      create: async (_input: {
        terminalId?: string;
        processKind?: string;
        command?: string[];
        cwd?: string;
        profile?: {
          command?: string[];
          cwd?: string;
          cols?: number;
          rows?: number;
          gitLog?: false | "normal" | "verbose";
          logStyle?: "rich" | "plain";
          icon?: string;
          title?: string;
          shortcuts?: Record<string, string>;
        };
      }) => ({ ok: true, message: "created" }),
      kill: async (_input: { terminalId: string }) => ({ ok: true, message: "stopped" }),
      focus: async (_input: { op?: "add" | "remove" | "replace" | "clear"; terminalIds?: string[] }) => ({
        ok: true,
        message: "focused",
        focusedTerminalIds: ["iflow"],
      }),
      write: async (input: {
        terminalId: string;
        text: string;
        submit?: boolean;
        submitKey?: "enter" | "linefeed";
      }) => {
        writeCalls.push(input);
        return { ok: true, message: "written" };
      },
      read: async (_input: { terminalId: string; mode?: "auto" | "diff" | "snapshot" }) => ({ ok: true }),
      snapshot: async (_input: { terminalId: string }) => ({ ok: true }),
      getConfig: async () => ({ transport: { port: 4100 } }),
      setConfig: async (_input: {
        patch: {
          defaults?: unknown;
          processProfiles?: Record<string, unknown>;
          terminalProfiles?: Record<string, unknown>;
          transport?: { host?: string; port?: number | null; pathPrefix?: string };
        };
      }) => ({ transport: { port: 4100 } }),
    },
  };
};

type TerminalGatewayLike = ReturnType<typeof createTerminalGateway>["gateway"];
type MessageGatewayLike = ReturnType<typeof createMessageGateway>["gateway"];

const createTerminalToolProvider = (terminalGateway?: TerminalGatewayLike): AgentToolProvider | null => {
  if (!terminalGateway) {
    return null;
  }
  return {
    name: "terminal-test",
    createTools: ({ runtimeText, traceTool }) => {
      const terminalProcessProfileSchema = z.object({
        command: z.array(z.string()).optional(),
        cwd: z.string().optional(),
        cols: z.number().optional(),
        rows: z.number().optional(),
        gitLog: z.union([z.literal(false), z.enum(["normal", "verbose"])]).optional(),
        logStyle: z.enum(["rich", "plain"]).optional(),
        icon: z.string().optional(),
        title: z.string().optional(),
        shortcuts: z.record(z.string(), z.string()).optional(),
      });
      const terminalControlPlaneConfigPatchSchema = z.object({
        defaults: terminalProcessProfileSchema.optional(),
        processProfiles: z.record(z.string(), terminalProcessProfileSchema).optional(),
        terminalProfiles: z.record(z.string(), terminalProcessProfileSchema).optional(),
        transport: z
          .object({
            host: z.string().optional(),
            port: z.number().nullable().optional(),
            pathPrefix: z.string().optional(),
          })
          .optional(),
      });

      return [
        toolDefinition({
          name: "terminal_list",
          description: runtimeText.t("tool.terminal_list.description"),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(
          async () => await traceTool("terminal_list", {}, async () => ({ terminals: terminalGateway.list() })),
        ),
        toolDefinition({
          name: "terminal_create",
          description: runtimeText.t("tool.terminal_create.description"),
          inputSchema: z.object({
            terminalId: z.string().optional(),
            processKind: z.string().optional(),
            command: z.array(z.string()).optional(),
            cwd: z.string().optional(),
            profile: terminalProcessProfileSchema.optional(),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string().optional(),
              processKind: z.string().optional(),
              command: z.array(z.string()).optional(),
              cwd: z.string().optional(),
              profile: terminalProcessProfileSchema.optional(),
            })
            .parse(rawInput);
          return await traceTool("terminal_create", input, async () => await terminalGateway.create(input));
        }),
        toolDefinition({
          name: "terminal_focus",
          description: runtimeText.t("tool.terminal_focus.description"),
          inputSchema: z.object({
            op: z.enum(["add", "remove", "replace", "clear"]).optional(),
            terminalIds: z.array(z.string()).optional(),
          }),
          outputSchema: z.object({
            ok: z.boolean(),
            message: z.string(),
            focusedTerminalIds: z.array(z.string()).optional(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              op: z.enum(["add", "remove", "replace", "clear"]).optional(),
              terminalIds: z.array(z.string()).optional(),
            })
            .parse(rawInput);
          return await traceTool("terminal_focus", input, async () => await terminalGateway.focus(input));
        }),
        toolDefinition({
          name: "terminal_kill",
          description: runtimeText.t("tool.terminal_kill.description"),
          inputSchema: z.object({ terminalId: z.string() }),
          outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
        }).server(async (rawInput) => {
          const input = z.object({ terminalId: z.string() }).parse(rawInput);
          return await traceTool("terminal_kill", input, async () => await terminalGateway.kill(input));
        }),
        toolDefinition({
          name: "terminal_write",
          description: runtimeText.t("tool.terminal_write.description"),
          inputSchema: z.object({
            terminalId: z.string(),
            text: z.string(),
            submit: z.boolean().optional(),
            submitKey: z.enum(["enter", "linefeed"]).optional(),
          }),
          outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string(),
              text: z.string(),
              submit: z.boolean().optional(),
              submitKey: z.enum(["enter", "linefeed"]).optional(),
            })
            .parse(rawInput);
          return await traceTool("terminal_write", input, async () => await terminalGateway.write(input));
        }),
        toolDefinition({
          name: "terminal_read",
          description: runtimeText.t("tool.terminal_read.description"),
          inputSchema: z.object({
            terminalId: z.string(),
            mode: z.enum(["auto", "diff", "snapshot"]).optional(),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string(),
              mode: z.enum(["auto", "diff", "snapshot"]).optional(),
            })
            .parse(rawInput);
          return await traceTool("terminal_read", input, async () => await terminalGateway.read(input));
        }),
        toolDefinition({
          name: "terminal_snapshot",
          description: runtimeText.t("tool.terminal_snapshot.description"),
          inputSchema: z.object({ terminalId: z.string() }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ terminalId: z.string() }).parse(rawInput);
          return await traceTool("terminal_snapshot", input, async () => await terminalGateway.snapshot(input));
        }),
        toolDefinition({
          name: "terminal_get_config",
          description: runtimeText.t("tool.terminal_get_config.description"),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(
          async () => await traceTool("terminal_get_config", {}, async () => await terminalGateway.getConfig()),
        ),
        toolDefinition({
          name: "terminal_set_config",
          description: runtimeText.t("tool.terminal_set_config.description"),
          inputSchema: z.object({
            patch: terminalControlPlaneConfigPatchSchema,
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              patch: terminalControlPlaneConfigPatchSchema,
            })
            .parse(rawInput);
          return await traceTool(
            "terminal_set_config",
            input,
            async () => await terminalGateway.setConfig({ patch: input.patch }),
          );
        }),
      ];
    },
  };
};

const createMessageToolProvider = (messageGateway?: MessageGatewayLike): AgentToolProvider | null => {
  if (!messageGateway) {
    return null;
  }
  return {
    name: "message-test",
    createTools: ({ runtimeText, traceTool }) => {
      const messageChannelSchema = z.object({
        chatId: z.string(),
        kind: z.enum(["direct", "room"]),
        title: z.string(),
        owner: z.string(),
        contextId: z.string().optional(),
        participants: z.array(
          z.object({
            id: z.string(),
            label: z.string().optional(),
          }),
        ),
        metadata: z.record(z.string(), z.unknown()).optional(),
        focused: z.boolean(),
        archivedAt: z.number().optional(),
        archivedBy: z.string().optional(),
      });

      return [
        toolDefinition({
          name: "message_channel_list",
          description: runtimeText.t("tool.message_channel_list.description"),
          inputSchema: z.object({
            includeArchived: z.boolean().optional(),
          }),
          outputSchema: z.object({
            channels: z.array(messageChannelSchema),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              includeArchived: z.boolean().optional(),
            })
            .parse(rawInput);
          return await traceTool("message_channel_list", input, async () => ({
            channels: await messageGateway.listChannels(input),
          }));
        }),
        toolDefinition({
          name: "message_channel_get",
          description: runtimeText.t("tool.message_channel_get.description"),
          inputSchema: z.object({
            chatId: z.string().min(1),
            includeArchived: z.boolean().optional(),
          }),
          outputSchema: z.object({
            channel: messageChannelSchema.nullable(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              chatId: z.string().min(1),
              includeArchived: z.boolean().optional(),
            })
            .parse(rawInput);
          return await traceTool("message_channel_get", input, async () => ({
            channel: await messageGateway.getChannel(input),
          }));
        }),
        toolDefinition({
          name: "message_send",
          description: runtimeText.t("tool.message_send.description"),
          inputSchema: z.object({
            chatId: z.string().min(1),
            content: z.string().min(1),
            rootId: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          }),
          outputSchema: z.object({
            ok: z.boolean(),
            messageId: z.string(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              chatId: z.string().min(1),
              content: z.string().min(1),
              rootId: z.string().optional(),
              from: z.string().optional(),
              to: z.string().optional(),
            })
            .parse(rawInput);
          return await traceTool("message_send", input, async () => await messageGateway.send(input));
        }),
      ];
    },
  };
};

const createToolProviders = (
  input: {
    terminalGateway?: TerminalGatewayLike;
    messageGateway?: MessageGatewayLike;
  } = {},
): AgentToolProvider[] => {
  const providers = [
    createTerminalToolProvider(input.terminalGateway),
    createMessageToolProvider(input.messageGateway),
  ];
  return providers.filter((provider): provider is AgentToolProvider => provider !== null);
};

const createAttentionGateway = () => {
  const system = new AttentionSystem();
  const defaultContextId = "ctx-main";
  system.createContext({ contextId: defaultContextId, owner: "tester" });

  const listActive = (): AttentionActiveContextMatch[] => system.listActiveContexts();
  const queryAttention = (input: AttentionSearchRequest): AttentionCommitMatch[] => {
    const normalizedQuery = input.query?.trim() ?? "";
    const offset = Math.max(0, Math.trunc(input.offset ?? 0));
    const limit = Math.max(1, Math.trunc(input.limit ?? 200));
    if (normalizedQuery.length === 0) {
      return system.query({ minScore: 1, offset, limit });
    }

    const compiled = compileAttentionSearch(normalizedQuery);
    return system
      .query({
        contextId: compiled.controls.contextId,
        hash: compiled.controls.hash,
        depth: compiled.controls.depth,
        author: compiled.controls.author,
        source: compiled.controls.source,
        minScore: compiled.controls.minScore ?? 1,
        limit: Number.MAX_SAFE_INTEGER,
      })
      .filter((match) => compiled.evaluate(buildAttentionSearchDocument(match)))
      .slice(offset, offset + limit);
  };

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
      query: (input: AttentionSearchRequest) => queryAttention(input),
    },
    gateway: {
      listContexts: (): AttentionContextDescriptor[] => system.listContexts(),
      listActive: () => listActive(),
      query: async (input: AttentionSearchRequest): Promise<AttentionCommitMatch[]> => queryAttention(input),
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
  const channels = [
    {
      chatId: "chat-main",
      kind: "room" as const,
      title: "Main Room",
      owner: "agenter",
      contextId: "ctx-chat-main",
      participants: [
        { id: "session:agenter", label: "agenter" },
        { id: "auth:user", label: "User" },
      ],
      metadata: {
        builtIn: true,
      },
      focused: true,
    },
    {
      chatId: "room-qa",
      kind: "room" as const,
      title: "QA Room",
      owner: "agenter",
      contextId: "ctx-room-qa",
      participants: [
        { id: "session:agenter", label: "agenter" },
        { id: "auth:kzf", label: "kzf" },
      ],
      metadata: {
        topic: "dogfood",
      },
      focused: false,
    },
  ];
  return {
    sent,
    gateway: {
      listChannels: async (input?: { includeArchived?: boolean }) => {
        if (input?.includeArchived) {
          return [...channels];
        }
        return channels.filter((channel) => !("archivedAt" in channel && typeof channel.archivedAt === "number"));
      },
      getChannel: async (input: { chatId: string; includeArchived?: boolean }) => {
        const channel = channels.find((entry) => entry.chatId === input.chatId);
        if (!channel) {
          return null;
        }
        if (!input.includeArchived && "archivedAt" in channel && typeof channel.archivedAt === "number") {
          return null;
        }
        return channel;
      },
      send: async (input: { chatId: string; content: string; rootId?: string; from?: string; to?: string }) => {
        sent.push(input);
        return {
          ok: true,
          messageId: `msg-${sent.length}`,
        };
      },
    },
  };
};

const createUserMessage = (
  text: string,
  input: {
    id?: string;
    timestamp?: number;
    name?: string;
    meta?: Record<string, string | number | boolean | null>;
  } = {},
): LoopBusMessage => ({
  id: input.id ?? "m-user",
  timestamp: input.timestamp ?? Date.now(),
  name: input.name ?? "User",
  role: "user",
  type: "text",
  source: "chat",
  text,
  meta: input.meta,
});

const createAttentionContextMessage = (
  text: string,
  input: {
    id?: string;
    name?: string;
    timestamp?: number;
    contextId?: string;
    headCommitId?: string;
    meta?: Record<string, string | number | boolean | null>;
  } = {},
): LoopBusMessage => ({
  id: input.id ?? "m-attention",
  timestamp: input.timestamp ?? Date.now(),
  name: input.name ?? `AttentionContext-${input.contextId ?? "ctx-main"}`,
  role: "user",
  type: "text",
  source: "attention",
  text,
  meta: {
    attentionContextId: input.contextId ?? "ctx-main",
    attentionHeadCommitId: input.headCommitId ?? "commit-1",
    attentionProtocolKind: "context",
    ...(input.meta ?? {}),
  },
});

const createAttentionItemsMessage = (
  text: string,
  input: {
    id?: string;
    name?: string;
    timestamp?: number;
    contextId?: string;
    headCommitId?: string;
    commitIds?: string[];
    meta?: Record<string, string | number | boolean | null>;
  } = {},
): LoopBusMessage => ({
  id: input.id ?? "m-attention-items",
  timestamp: input.timestamp ?? Date.now(),
  name: input.name ?? `AttentionItems-${input.contextId ?? "ctx-main"}`,
  role: "user",
  type: "text",
  source: "attention",
  text,
  meta: {
    attentionContextId: input.contextId ?? "ctx-main",
    attentionHeadCommitId: input.headCommitId ?? "commit-1",
    attentionProtocolKind: "items",
    attentionCommitIds: JSON.stringify(input.commitIds ?? [input.headCommitId ?? "commit-1"]),
    ...(input.meta ?? {}),
  },
});

const createAttentionMessage = (
  text: string,
  input: {
    id?: string;
    name?: string;
    timestamp?: number;
    contextId?: string;
    headCommitId?: string;
    commitIds?: string[];
    meta?: Record<string, string | number | boolean | null>;
  } = {},
): LoopBusMessage => createAttentionItemsMessage(text, input);

const createAttentionBootstrapMessages = (input: {
  contextText: string;
  itemsText: string;
  contextId?: string;
  headCommitId?: string;
  commitIds?: string[];
  meta?: Record<string, string | number | boolean | null>;
}): LoopBusMessage[] => [
  createAttentionContextMessage(input.contextText, {
    contextId: input.contextId,
    headCommitId: input.headCommitId,
    meta: input.meta,
  }),
  createAttentionItemsMessage(input.itemsText, {
    contextId: input.contextId,
    headCommitId: input.headCommitId,
    commitIds: input.commitIds,
    meta: input.meta,
  }),
];

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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
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

  test("Scenario: Given a message gateway When tools are exposed Then channel metadata tools and message_send are both available", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    let toolNames: string[] = [];

    const modelClient = createModelClient(async (input) => {
      toolNames = input.tools.map((tool) => tool.name);
      const listTool = input.tools.find((entry) => entry.name === "message_channel_list");
      const getTool = input.tools.find((entry) => entry.name === "message_channel_get");
      const tool = input.tools.find((entry) => entry.name === "message_send");
      expect(listTool).toBeDefined();
      expect(getTool).toBeDefined();
      expect(tool).toBeDefined();
      if (
        !listTool ||
        typeof listTool.execute !== "function" ||
        !getTool ||
        typeof getTool.execute !== "function" ||
        !tool ||
        typeof tool.execute !== "function"
      ) {
        throw new Error("message tools missing");
      }

      const listResult = (await listTool.execute(
        {
          includeArchived: false,
        },
        {
          toolCallId: "call-message-channel-list",
          emitCustomEvent: () => {},
        },
      )) as {
        channels: Array<{ chatId: string; title: string }>;
      };
      expect(listResult.channels.some((channel) => channel.chatId === "chat-main")).toBeTrue();

      const getResult = (await getTool.execute(
        {
          chatId: "room-qa",
        },
        {
          toolCallId: "call-message-channel-get",
          emitCustomEvent: () => {},
        },
      )) as {
        channel: { chatId: string; title: string; kind: "room" } | null;
      };
      if (!getResult.channel) {
        throw new Error("message_channel_get returned null");
      }
      expect(getResult.channel.chatId).toBe("room-qa");
      expect(getResult.channel.title).toBe("QA Room");
      expect(getResult.channel.kind).toBe("room");

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
      toolProviders: createToolProviders({
        terminalGateway: terminal.gateway,
        messageGateway: message.gateway,
      }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("dispatch a message")]);

    expect(toolNames).toContain("message_channel_list");
    expect(toolNames).toContain("message_channel_get");
    expect(toolNames).toContain("message_send");
    expect(message.sent).toEqual([
      {
        chatId: "chat-main",
        content: "hello from tool",
      },
    ]);
  });

  test("Scenario: Given tool providers and a SYSTEMS_GUIDE slot When the model call is assembled Then systemPrompt stays provider-agnostic", async () => {
    const seenInputs: ModelRespondInput[] = [];
    const chat = createAttentionGateway();
    const terminal = createTerminalGateway();
    const message = createMessageGateway();
    const modelClient = createModelClient(async (input) => {
      seenInputs.push(input);
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
      toolProviders: createToolProviders({
        terminalGateway: terminal.gateway,
        messageGateway: message.gateway,
      }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("assemble the prompt")]);

    const captured = seenInputs[0];
    expect(captured).toBeDefined();
    if (!captured) {
      return;
    }
    expect(captured.systemPrompt).toContain("You are agenter-ai,");
    expect(captured.systemPrompt).not.toContain("## Terminal System");
    expect(captured.systemPrompt).not.toContain("## Message System");
    expect(captured.systemPrompt).not.toContain("SYSTEMS_GUIDE");

    const replayText = [...extractUserReplay(captured), ...extractAssistantReplay(captured)].join("\n");
    expect(replayText).not.toContain("## Terminal System");
    expect(replayText).not.toContain("## Message System");
  });

  test("Scenario: Given a runtime avatar name When the model call is assembled Then shared prompt docs render that avatar identity", async () => {
    let capturedPrompt = "";
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      capturedPrompt = input.systemPrompt;
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
      avatarName: "jane",
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("who are you")]);

    expect(capturedPrompt).toContain("You are jane,");
    expect(capturedPrompt).not.toContain("You are agenter-ai,");
    expect(capturedPrompt).not.toContain("AVATAR_NAME");
    expect(capturedPrompt).toContain("treat them as literal acceptance criteria");
  });

  test("Scenario: Given no runtime avatar override When the model call is assembled Then shared prompt docs fall back to the default identity", async () => {
    let capturedPrompt = "";
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      capturedPrompt = input.systemPrompt;
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
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("identify yourself")]);

    expect(capturedPrompt).toContain("You are agenter-ai,");
    expect(capturedPrompt).not.toContain("AVATAR_NAME");
  });

  test("Scenario: Given a legacy system template When tool providers are present Then prompt assembly still works without provider-owned guide injection", async () => {
    let capturedPrompt = "";
    const chat = createAttentionGateway();
    const terminal = createTerminalGateway();
    const modelClient = createModelClient(async (input) => {
      capturedPrompt = input.systemPrompt;
      return {
        thinking: "",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({
        defaultDocs: createPromptDocs({
          legacySystemTemplate: true,
        }),
      }),
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("legacy template fallback")]);

    expect(capturedPrompt).toContain("You are agenter-ai,");
    expect(countOccurrences(capturedPrompt, "You are agenter-ai,")).toBe(1);
    expect(capturedPrompt).not.toContain("## Legacy Guide");
    expect(capturedPrompt).not.toContain("## Terminal System");
    expect(capturedPrompt).not.toContain("SYSTEMS_GUIDE");
  });

  test("Scenario: Given terminal help payload When raw terminal context reaches AgenterAI Then the core preserves the source payload without terminal-specific rendering", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
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
    expect(joinedHistory).toContain('"kind":"terminal-help"');
    expect(joinedHistory).toContain("<CliHelp");
    expect(joinedHistory).toContain('"manuals":{"iflow":"IFLOW HELP CONTENT"}');
    expect(joinedHistory).not.toContain("```markdown\nIFLOW HELP CONTENT");
  });

  test("Scenario: Given terminal snapshot tail as one string When raw terminal context reaches AgenterAI Then the core keeps the JSON payload intact", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
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
    expect(joinedHistory).toContain('"kind":"terminal-snapshot"');
    expect(joinedHistory).toContain('"tail":"line 1\\nline 2\\nline 3"');
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
        query: `context:${chat.defaultContextId} minscore:1`,
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("continue")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
    expect(chat.engine.query({ query: "minscore:0 startup ping" })).toHaveLength(1);
  });

  test("Scenario: Given attention_commit omits author and source When the tool executes Then the stored commit uses context defaults", async () => {
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
          scores: {
            "default-meta-check": 0,
          },
          summary: "defaults applied",
          change: {
            type: "update",
            value: "defaults applied",
            format: "text/plain",
          },
          done: true,
          stage: "done",
        },
        {
          toolCallId: "call-attention-commit-default-meta",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; commitId: string };

      expect(result.ok).toBeTrue();

      return {
        thinking: "Recorded the internal fact.",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("记录默认 meta 行为")]);
    expect(response).toBeUndefined();

    const commit = chat.system.getContext(chat.defaultContextId)?.listCommits().at(-1);
    expect(commit).toBeDefined();
    expect(commit?.meta.author).toBe("tester");
    expect(commit?.meta.source).toBe("attention");
  });

  test("Scenario: Given attention_commit only provides done on a resolved context When the tool executes Then runtime cleans the context and clears the active scores", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "需要闭环", from: "user", score: 100 });
    const modelClient = createModelClient(async (input) => {
      const tool = input.tools.find((item) => item.name === "attention_commit");
      expect(tool).toBeDefined();
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("attention_commit tool missing");
      }

      const result = (await tool.execute(
        {
          contextId: chat.defaultContextId,
          parentCommitIds: [tracked.commitId],
          summary: "已完成闭环",
          done: true,
          stage: "done",
        },
        {
          toolCallId: "call-attention-commit-done-no-scores",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; commitId: string };

      expect(result.ok).toBeTrue();

      return {
        thinking: "Closed the active context.",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续处理")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
    const commit = chat.system.getContext(chat.defaultContextId)?.listCommits().at(-1);
    expect(commit?.scores).toEqual(Object.fromEntries(Object.keys(tracked.scores).map((hash) => [hash, 0])));
    expect(commit?.change).toEqual({ type: "clean" });
  });

  test("Scenario: Given attention_commit provides done with its own score map When the tool executes Then the tool clears existing debt and preserves the caller scores", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "需要闭环", from: "user", score: 100 });
    const modelClient = createModelClient(async (input) => {
      const tool = input.tools.find((item) => item.name === "attention_commit");
      expect(tool).toBeDefined();
      if (!tool || typeof tool.execute !== "function") {
        throw new Error("attention_commit tool missing");
      }

      const result = (await tool.execute(
        {
          contextId: chat.defaultContextId,
          parentCommitIds: [tracked.commitId],
          summary: "已完成闭环",
          done: true,
          scores: {
            delivery: 0,
          },
          stage: "done",
        },
        {
          toolCallId: "call-attention-commit-done-with-scores",
          emitCustomEvent: () => {},
        },
      )) as { ok: boolean; commitId: string };

      expect(result.ok).toBeTrue();

      return {
        thinking: "Closed the active context.",
        text: "",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续处理")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
    const commit = chat.system.getContext(chat.defaultContextId)?.listCommits().at(-1);
    expect(commit?.scores).toEqual({
      ...Object.fromEntries(Object.keys(tracked.scores).map((hash) => [hash, 0])),
      delivery: 0,
    });
    expect(commit?.change).toEqual({ type: "clean" });
  });

  test("Scenario: Given no attention item write When model returns plain text Then promptWindow records the assistant text without emitting a core chat payload", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("下一步")]);
    expect(response).toBeUndefined();

    const replay = extractAssistantReplay(ai.inspectDebugState().promptWindow);
    expect(replay).toEqual(["assistant internal note"]);
  });

  test("Scenario: Given an attention-only round When model returns plain text without mutation Then AgenterAI records the invalid round, queues compact retry, and keeps no false assistant history", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send(
      createAttentionBootstrapMessages({
        contextText: "contextId: ctx-main\nbody: pending attention",
        itemsText: "contextId: ctx-main\nitemId: item-1\npending score",
      }),
    );

    expect(calls).toBe(1);
    expect(response).toBeUndefined();
    expect(extractAssistantReplay(ai.inspectDebugState().promptWindow)).toEqual([]);

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(1);
    expect(finalRecords.every((record) => record.status === "error")).toBeTrue();
    expect(finalRecords[0]?.outcome?.reason).toBe("attention.no_progress");
    expect(finalRecords[0]?.outcome?.retryable).toBeTrue();
    expect(ai.consumePendingCompactRequest()).toBe("attention_retry");
  });

  test("Scenario: Given chat-backed attention When the model clears scores without dispatching a visible reply Then AgenterAI accepts the attention mutation and leaves egress to runtime adapters", async () => {
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
          { toolCallId: "call-attention-commit-1", emitCustomEvent: () => {} },
        );
        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({
        terminalGateway: terminal.gateway,
        messageGateway: message.gateway,
      }),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([
      createAttentionItemsMessage("contextId: ctx-main\nscore: 100", {
        contextId: chat.defaultContextId,
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
        meta: {
          chatId: "chat-main",
        },
      }),
    ]);

    expect(calls).toBe(1);
    expect(response).toBeUndefined();
    expect(message.sent).toEqual([]);

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(1);
    expect(finalRecords[0]?.status).toBe("done");
    expect(finalRecords[0]?.outcome?.code).toBe("done");
    expect(ai.consumePendingCompactRequest()).toBeNull();
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
      toolProviders: createToolProviders({
        terminalGateway: terminal.gateway,
        messageGateway: message.gateway,
      }),
      attentionGateway: chat.gateway,
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

    expect(response).toBeUndefined();
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

  test("Scenario: Given an attention-only round When model only calls read tools without mutating attention Then AgenterAI still treats the round as no progress", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    const response = await ai.send([createAttentionMessage("contextId: ctx-main\nitemId: item-1\npending score")]);

    expect(calls).toBe(1);
    expect(response).toBeUndefined();

    const finalRecords = modelCalls.filter((record) => record.status !== "running");
    expect(finalRecords).toHaveLength(1);
    expect(finalRecords.every((record) => record.status === "done")).toBeTrue();
    expect(finalRecords.every((record) => (record.response?.toolTrace?.length ?? 0) >= 1)).toBeTrue();
    expect(ai.consumePendingCompactRequest()).toBeNull();
  });

  test("Scenario: Given a streamed tool call starts without parsed args When the real tool begins execution Then AgenterAI reuses the same toolCallId and emits a hydrated running update", async () => {
    const chat = createAttentionGateway();
    const streamedUpdates: Array<{
      kind: string;
      toolCallId?: string;
      toolName?: string;
      argsText?: string;
      input?: unknown;
    }> = [];
    const modelCalls: AgentModelCallRecord[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionCommit).toBeDefined();
        if (!attentionCommit || typeof attentionCommit.execute !== "function") {
          throw new Error("attention_commit tool missing");
        }

        await input.onUpdate?.({
          kind: "tool_call",
          toolCallId: "call-attention-commit-stable",
          toolName: "attention_commit",
          argsText: "",
          timestamp: Date.now(),
        });

        await attentionCommit.execute(
          {
            contextId: chat.defaultContextId,
            summary: "mark handled",
            parentCommitIds: [],
            done: true,
          },
          {
            toolCallId: "call-attention-commit-stable",
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
      attentionGateway: chat.gateway,
      onAssistantStream: async (update) => {
        streamedUpdates.push({
          kind: update.kind,
          toolCallId: "toolCallId" in update ? update.toolCallId : undefined,
          toolName: "toolName" in update ? update.toolName : undefined,
          argsText: "argsText" in update ? update.argsText : undefined,
          input: "input" in update ? update.input : undefined,
        });
      },
      onModelCall: async (record) => {
        modelCalls.push(record);
      },
    });

    await ai.send([createUserMessage("处理当前 attention")]);

    const hydratedCallUpdate = streamedUpdates.find(
      (update) =>
        update.kind === "tool_call" &&
        update.toolCallId === "call-attention-commit-stable" &&
        typeof update.argsText === "string" &&
        update.argsText.length > 0,
    );
    expect(hydratedCallUpdate?.input).toMatchObject({
      contextId: chat.defaultContextId,
      summary: "mark handled",
      change: {
        type: "clean",
      },
    });

    const finalRecord = modelCalls.find((record) => record.status === "done");
    expect(finalRecord?.response?.toolTrace).toHaveLength(1);
    expect(finalRecord?.response?.toolTrace?.[0]?.invocationId).toBe("call-attention-commit-stable");
    expect(finalRecord?.response?.toolTrace?.[0]?.input).toMatchObject({
      contextId: chat.defaultContextId,
      summary: "mark handled",
      change: {
        type: "clean",
      },
    });
  });

  test("Scenario: Given an attention-only round When the first model response is a no-op Then the next runtime-managed cycle can still drive a real attention mutation", async () => {
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
            query: `context:${chat.defaultContextId} minscore:1`,
            limit: 20,
          },
          {
            toolCallId: "call-attention_query",
            emitCustomEvent: () => {},
          },
        )) as { items: Array<{ commit: { commitId: string } }> };

        expect(matches.items.some((item) => item.commit.commitId === tracked.commitId)).toBeTrue();
        expect(flattenModelMessageContent(input.messages.at(-1))).toContain("yaml+attention_items");
        expect(flattenModelMessageContent(input.messages.at(-1))).not.toContain("attention_round_retry");

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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const firstResponse = await ai.send([createAttentionMessage("contextId: ctx-main\nitemId: item-1\npending score")]);
    expect(firstResponse).toBeUndefined();
    const compactTrigger = ai.consumePendingCompactRequest();
    expect(compactTrigger).toBe("attention_retry");
    if (!compactTrigger) {
      return;
    }

    await ai.runCompactCycle({ trigger: compactTrigger });
    const response = await ai.send([
      createAttentionItemsMessage("contextId: ctx-main\nitemId: item-1\npending score", {
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);
    expect(response).toBeUndefined();

    expect(calls).toBe(3);
    expect(ai.consumePendingCompactRequest()).toBeNull();
  });

  test("Scenario: Given attention-first follow-up rounds When the next prompt is built Then prior attention and tool evidence remain in replay history", async () => {
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
        if (
          !sendMessage ||
          typeof sendMessage.execute !== "function" ||
          !attentionCommit ||
          typeof attentionCommit.execute !== "function"
        ) {
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
      toolProviders: createToolProviders({
        terminalGateway: terminal.gateway,
        messageGateway: {
          listChannels: async () => [],
          getChannel: async () => null,
          send: async () => ({ ok: true, messageId: "msg-test" }),
        },
      }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createAttentionMessage("ctx-main unresolved")]);
    await ai.send([createAttentionMessage("ctx-gaubee replied")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    const userReplay = extractUserReplay(seenInputs[1]);
    const roles = extractReplayRoles(seenInputs[1]);
    expect(replay.some((item) => item.includes("yaml+attention_items"))).toBeTrue();
    expect(replay.some((item) => item.includes("tool: message_send"))).toBeTrue();
    expect(replay.some((item) => item.includes("tool: attention_commit"))).toBeTrue();
    expect(userReplay.some((item) => item.includes("ctx-main unresolved"))).toBeTrue();
    expect(userReplay.some((item) => item.includes("ctx-gaubee replied"))).toBeTrue();
    expect(roles.at(-1)).toBe("user");
    expect(flattenModelMessageContent(seenInputs[1].messages.at(-1))).toContain("ctx-gaubee");
  });

  test("Scenario: Given assistant internal thinking and text When the next turn is built Then replayed promptWindow keeps only assistant text without synthetic headings", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("first turn")]);
    await ai.send([createUserMessage("second turn")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    expect(replay).toHaveLength(1);
    expect(replay[0]).toContain("Decision: wait for user");
    expect(replay.join("\n\n")).not.toContain("### Notes");
    expect(replay.join("\n\n")).not.toContain("### Replies");
    expect(replay.join("\n\n")).not.toContain("### Tool activity");
  });

  test("Scenario: Given a room chat carries social context When the model prompt is assembled Then the replay includes room presence and latest-message perspective", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    const seenInputs: ModelRespondInput[] = [];

    const modelClient = createModelClient(async (input) => {
      seenInputs.push(input);
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway, messageGateway: message.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([
      createUserMessage("我们先等等，看谁更适合回答。", {
        name: "Jane",
        meta: {
          chatId: "room-team",
          chatTitle: "Team room",
          chatKind: "room",
          chatAudience: "group",
          chatParticipantCount: 3,
          chatParticipantLabels: JSON.stringify(["kzf", "Jane", "JJ"]),
          chatOtherParticipantLabels: JSON.stringify(["kzf", "JJ"]),
          chatOnlineParticipantLabels: JSON.stringify(["kzf", "Jane"]),
          chatOfflineParticipantLabels: JSON.stringify(["JJ"]),
          chatFocusedParticipantLabels: JSON.stringify(["Jane"]),
          chatSenderActorId: "session:jane",
          chatSenderLabel: "Jane",
          chatSelfActorId: "session:jj",
          chatSelfLabel: "JJ",
          chatMessagePerspective: "other",
          chatTurnState: "waiting",
          chatObligationKind: "self_update",
        },
      }),
    ]);

    const userReplay = extractUserReplay(seenInputs[0]);
    expect(userReplay).toHaveLength(1);
    expect(userReplay[0]).toContain("participantCount: 3");
    expect(userReplay[0]).toContain("latestMessage: other");
    expect(userReplay[0]).toContain("senderLabel: Jane");
    expect(userReplay[0]).toContain("selfLabel: JJ");
    expect(userReplay[0]).toContain("turnState: waiting");
    expect(userReplay[0]).toContain("kind: self_update");
    expect(userReplay[0]).toContain("settlesWhen: no_external_reply_needed");
    expect(userReplay[0]).toContain("online:");
    expect(userReplay[0]).toContain("offline:");
    expect(userReplay[0]).toContain("我们先等等，看谁更适合回答。");
  });

  test("Scenario: Given assistant tool activity and reply When the next turn is built Then replayed promptWindow preserves text plus tool invocation fences", async () => {
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("first turn")]);
    await ai.send([createUserMessage("second turn")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    expect(replay.some((item) => item.includes("Decision: report result"))).toBeFalse();
    expect(replay.some((item) => item.includes("tool: terminal_read"))).toBeTrue();
    expect(replay.some((item) => item.includes("tool: attention_commit"))).toBeTrue();
  });

  test("Scenario: Given a queued compact request When the runtime runs a compact cycle Then summarize includes attention_system and the next attention round can still clear records", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "提醒我确认发布时间", from: "user", score: 100 });
    const compactInputs: string[] = [];

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
      async respondWithMeta(input: ModelRespondInput) {
        if (input.tools.length === 0) {
          compactInputs.push(flattenModelMessageContent(input.messages[0]));
          return {
            thinking: "",
            text: JSON.stringify({
              overview: "compacted",
              decisions: ["keep working"],
              keyFiles: [],
              keyFacts: ["attention_system preserved"],
              unresolvedWork: ["ctx-main pending"],
              nextSteps: ["continue the attention cycle"],
            }),
            finishReason: "stop",
          };
        }
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("第一轮")]);
    ai.requestCompact("test-/compact");
    const compactTrigger = ai.consumePendingCompactRequest();
    expect(compactTrigger).toBe("manual");
    if (!compactTrigger) {
      return;
    }
    await ai.runCompactCycle({ trigger: compactTrigger });
    const response = await ai.send([
      createAttentionItemsMessage("contextId: ctx-main\npending score", {
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);

    expect(response).toBeUndefined();
    expect(compactInputs.length).toBeGreaterThan(0);
    expect(compactInputs.join("\n")).toContain("attention_system");
    expect(chat.engine.list()).toHaveLength(0);
    const replay = extractAssistantReplay(ai.inspectDebugState().promptWindow);
    expect(replay.some((item) => item.includes("yaml+prompt_window_compact"))).toBeTrue();
    expect(replay.some((item) => item.includes("attention_system preserved"))).toBeTrue();
    expect(replay.some((item) => item.includes("ctx-main pending"))).toBeTrue();
    expect(replay.some((item) => item.includes("continue the attention cycle"))).toBeTrue();
    expect(replay.some((item) => item.includes("readyReplies"))).toBeFalse();
  });

  test("Scenario: Given a tool-result boundary When new attention input becomes loadable Then AgenterAI reissues the next model request with tool evidence plus the interleaved attention payload", async () => {
    const message = createMessageGateway();
    const seenInputs: ModelRespondInput[] = [];
    let round = 0;
    let interleavedCollected = false;

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
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        round += 1;

        if (round === 1) {
          const messageSend = input.tools.find((tool) => tool.name === "message_send");
          expect(messageSend).toBeDefined();
          if (!messageSend || typeof messageSend.execute !== "function") {
            throw new Error("message_send tool missing");
          }

          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-interleaved",
            toolName: "message_send",
            argsText: '{"chatId":"chat-main","content":"正在处理中"}',
            input: {
              chatId: "chat-main",
              content: "正在处理中",
            },
            timestamp: Date.now(),
          });
          await messageSend.execute(
            {
              chatId: "chat-main",
              content: "正在处理中",
            },
            {
              toolCallId: "call-message-send-interleaved",
              emitCustomEvent: () => {
                // no-op
              },
            },
          );
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-interleaved",
            toolName: "message_send",
            ok: true,
            result: { ok: true, messageId: "msg-1" },
            timestamp: Date.now(),
          });
          expect(input.shouldYieldAfterToolPhase?.()).toBeTrue();
          return {
            thinking: "",
            text: "",
            finishReason: "tool_calls",
            yieldedAfterToolPhase: true,
          };
        }

        return {
          thinking: "",
          text: "done",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ messageGateway: message.gateway }),
      attentionGateway: createAttentionGateway().gateway,
      collectInterleavedInputs: async () => {
        if (interleavedCollected) {
          return undefined;
        }
        interleavedCollected = true;
        return [
          createAttentionItemsMessage("contextId: ctx-main\nsummary: 新消息补充条件", {
            id: "m-attention-interleaved",
            contextId: "ctx-main",
            headCommitId: "commit-interleaved-1",
            commitIds: ["commit-interleaved-1"],
            meta: {
              chatId: "chat-main",
              chatFocused: true,
            },
          }),
        ];
      },
    });

    await ai.send([createUserMessage("先发一条确认消息")]);

    expect(seenInputs).toHaveLength(2);
    expect(message.sent).toHaveLength(1);
    expect(message.sent[0]).toMatchObject({
      chatId: "chat-main",
      content: "正在处理中",
    });
    const assistantReplay = extractAssistantReplay(seenInputs[1]);
    const userReplay = extractUserReplay(seenInputs[1]);
    expect(assistantReplay.some((item) => item.includes("tool: message_send"))).toBeTrue();
    expect(userReplay.some((item) => item.includes("summary: 新消息补充条件"))).toBeTrue();
  });

  test("Scenario: Given an interleaved continuation When a later tool phase finishes without new input Then AgenterAI still reissues the next model request until the tool result is resolved into a final answer", async () => {
    const message = createMessageGateway();
    const seenInputs: ModelRespondInput[] = [];
    let round = 0;
    let interleavedCollected = false;

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
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        round += 1;

        const messageSend = input.tools.find((tool) => tool.name === "message_send");
        expect(messageSend).toBeDefined();
        if (!messageSend || typeof messageSend.execute !== "function") {
          throw new Error("message_send tool missing");
        }

        if (round === 1) {
          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-1",
            toolName: "message_send",
            argsText: '{"chatId":"chat-main","content":"处理中-1"}',
            input: {
              chatId: "chat-main",
              content: "处理中-1",
            },
            timestamp: Date.now(),
          });
          await messageSend.execute(
            {
              chatId: "chat-main",
              content: "处理中-1",
            },
            {
              toolCallId: "call-message-send-1",
              emitCustomEvent: () => {
                // no-op
              },
            },
          );
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-1",
            toolName: "message_send",
            ok: true,
            result: { ok: true, messageId: "msg-1" },
            timestamp: Date.now(),
          });
          expect(input.shouldYieldAfterToolPhase?.()).toBeTrue();
          return {
            thinking: "",
            text: "",
            finishReason: "tool_calls",
            yieldedAfterToolPhase: true,
          };
        }

        if (round === 2) {
          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-2",
            toolName: "message_send",
            argsText: '{"chatId":"chat-main","content":"处理中-2"}',
            input: {
              chatId: "chat-main",
              content: "处理中-2",
            },
            timestamp: Date.now(),
          });
          await messageSend.execute(
            {
              chatId: "chat-main",
              content: "处理中-2",
            },
            {
              toolCallId: "call-message-send-2",
              emitCustomEvent: () => {
                // no-op
              },
            },
          );
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-2",
            toolName: "message_send",
            ok: true,
            result: { ok: true, messageId: "msg-2" },
            timestamp: Date.now(),
          });
          expect(input.shouldYieldAfterToolPhase?.()).toBeFalse();
          return {
            thinking: "",
            text: "",
            finishReason: "tool_calls",
            yieldedAfterToolPhase: false,
          };
        }

        return {
          thinking: "",
          text: "done-after-second-tool-phase",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ messageGateway: message.gateway }),
      attentionGateway: createAttentionGateway().gateway,
      collectInterleavedInputs: async () => {
        if (interleavedCollected) {
          return undefined;
        }
        interleavedCollected = true;
        return [
          createAttentionItemsMessage("contextId: ctx-main\nsummary: 第二阶段补充要求", {
            id: "m-attention-interleaved-2",
            contextId: "ctx-main",
            headCommitId: "commit-interleaved-2",
            commitIds: ["commit-interleaved-2"],
            meta: {
              chatId: "chat-main",
              chatFocused: true,
            },
          }),
        ];
      },
    });

    await ai.send([createUserMessage("继续验证 tool phase continuation")]);

    expect(seenInputs).toHaveLength(3);
    expect(message.sent).toHaveLength(2);
    expect(message.sent[0]).toMatchObject({
      chatId: "chat-main",
      content: "处理中-1",
    });
    expect(message.sent[1]).toMatchObject({
      chatId: "chat-main",
      content: "处理中-2",
    });
    const secondRoundUserReplay = extractUserReplay(seenInputs[1]);
    expect(secondRoundUserReplay.some((item) => item.includes("第二阶段补充要求"))).toBeTrue();
    const thirdRoundAssistantReplay = extractAssistantReplay(seenInputs[2]);
    expect(thirdRoundAssistantReplay.some((item) => item.includes("tool: message_send"))).toBeTrue();
    expect(thirdRoundAssistantReplay.some((item) => item.includes("处理中-2"))).toBeTrue();
  });

  test("Scenario: Given an attention round When a tool phase settles the active context Then AgenterAI stops without issuing a redundant follow-up call", async () => {
    const chat = createAttentionGateway();
    const seenInputs: ModelRespondInput[] = [];
    const tracked = chat.engine.add({ content: "ctx-main unresolved", from: "user", score: 100 });

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
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionCommit).toBeDefined();
        if (!attentionCommit || typeof attentionCommit.execute !== "function") {
          throw new Error("attention_commit tool missing");
        }

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
              value: "resolved",
              format: "text/plain",
            },
            done: true,
            stage: "done",
          },
          {
            toolCallId: "call-attention-settle-without-followup",
            emitCustomEvent: () => {},
          },
        );
        expect(input.shouldYieldAfterToolPhase?.()).toBeFalse();
        return {
          thinking: "",
          text: "",
          finishReason: "tool_calls",
          yieldedAfterToolPhase: false,
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
    });

    await ai.send([
      createAttentionItemsMessage("contextId: ctx-main\nsummary: ctx-main unresolved", {
        contextId: chat.defaultContextId,
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);

    expect(seenInputs).toHaveLength(1);
    expect(chat.engine.list()).toHaveLength(0);
  });

  test("Scenario: Given a compact summary with durable facts When follow-up attention arrives Then AgenterAI keeps the compact summary in prompt replay but still runs a fresh model round", async () => {
    const chat = createAttentionGateway();
    const seenInputs: ModelRespondInput[] = [];
    let modelRounds = 0;

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
      async respondWithMeta(input: ModelRespondInput) {
        if (input.tools.length === 0) {
          return {
            thinking: "",
            text: JSON.stringify({
              overview: "compacted relay",
              decisions: ["preserve durable facts"],
              keyFiles: ["packages/app-server/src/agenter-ai.ts"],
              keyFacts: ["gaubee说中午吃蛋炒饭。"],
              unresolvedWork: ["ctx-main follow-up pending"],
              nextSteps: ["continue with a fresh model round"],
            }),
            finishReason: "stop",
          };
        }

        modelRounds += 1;
        seenInputs.push(input);
        return {
          thinking: "",
          text: "follow-up handled",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({}),
      attentionGateway: chat.gateway,
    });

    ai.requestCompact("test-ready-reply-prefer-durable");
    const compactTrigger = ai.consumePendingCompactRequest();
    expect(compactTrigger).toBe("manual");
    if (!compactTrigger) {
      return;
    }
    await ai.runCompactCycle({ trigger: compactTrigger });

    const followUp = chat.engine.add({ content: "继续下一步", from: "user", score: 100 });
    await ai.send([
      createAttentionItemsMessage("contextId: ctx-main\nsummary: 继续下一步", {
        contextId: chat.defaultContextId,
        headCommitId: followUp.commitId,
        commitIds: [followUp.commitId],
        meta: {
          chatId: "chat-main",
          chatFocused: true,
        },
      }),
    ]);

    expect(modelRounds).toBe(1);
    expect(seenInputs).toHaveLength(1);
    const replay = extractAssistantReplay(seenInputs[0]);
    expect(replay.some((item) => item.includes("yaml+prompt_window_compact"))).toBeTrue();
    expect(replay.some((item) => item.includes("gaubee说中午吃蛋炒饭。"))).toBeTrue();
    expect(replay.some((item) => item.includes("ctx-main follow-up pending"))).toBeTrue();
  });

  test("Scenario: Given compact output is persisted When the summary is recorded Then only the durable compact fields remain without legacy ready reply caches", async () => {
    const chat = createAttentionGateway();
    const modelCalls: AgentModelCallRecord[] = [];

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
      async respondWithMeta(input: ModelRespondInput) {
        if (input.tools.length === 0) {
          return {
            thinking: "",
            text: JSON.stringify({
              overview: "compacted facts",
              decisions: ["preserve durable facts"],
              keyFiles: ["packages/app-server/src/agenter-ai.ts"],
              keyFacts: ["gaubee说中午吃蛋炒饭。", "厦门未来 15 天天气请以 terminal 查询结果为准。"],
              unresolvedWork: ["ctx-main pending"],
              nextSteps: ["continue processing active attention"],
            }),
            finishReason: "stop",
          };
        }
        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({}),
      attentionGateway: chat.gateway,
      onModelCall: (record) => {
        modelCalls.push(record);
      },
    });

    ai.requestCompact("test-ready-reply-provenance");
    const compactTrigger = ai.consumePendingCompactRequest();
    expect(compactTrigger).toBe("manual");
    if (!compactTrigger) {
      return;
    }
    await ai.runCompactCycle({ trigger: compactTrigger });

    const compactRecord = [...modelCalls]
      .reverse()
      .find((record) => record.status === "done" && isCompactDecision(record.response?.decision));
    expect(compactRecord).toBeDefined();
    if (!compactRecord || !isCompactDecision(compactRecord.response?.decision)) {
      return;
    }

    const summary = compactRecord.response.decision.summary as AgentPromptWindowCompactSummary & {
      readyReplies?: unknown;
    };
    expect(summary.decisions).toEqual(["preserve durable facts"]);
    expect(summary.keyFiles).toEqual(["packages/app-server/src/agenter-ai.ts"]);
    expect(summary.keyFacts).toEqual([
      "gaubee说中午吃蛋炒饭。",
      "厦门未来 15 天天气请以 terminal 查询结果为准。",
    ]);
    expect(summary.unresolvedWork).toEqual(["ctx-main pending"]);
    expect(summary.nextSteps).toEqual(["continue processing active attention"]);
    expect(summary.readyReplies).toBeUndefined();
  });

  test("Scenario: Given model context overflow When the runtime runs compact and retries Then AgenterAI continues with the same attention task", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "resolve after compact retry", from: "user", score: 100 });
    const compactInputs: string[] = [];
    const lifecycle: AgentModelCallRecord[] = [];
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
      async respondWithMeta(input: ModelRespondInput) {
        if (input.tools.length === 0) {
          compactInputs.push(flattenModelMessageContent(input.messages[0]));
          return {
            thinking: "",
            text: JSON.stringify({
              overview: "compacted-history",
              decisions: ["retry after compact"],
              keyFiles: [],
              keyFacts: [],
              readyReplies: [],
              unresolvedWork: ["ctx-main unresolved"],
              nextSteps: ["rerun attention round"],
            }),
            finishReason: "stop",
          };
        }
        round += 1;
        if (round === 1) {
          throw new Error("maximum context length exceeded");
        }
        const attentionCommit = input.tools.find((tool) => tool.name === "attention_commit");
        expect(attentionCommit).toBeDefined();
        if (!attentionCommit || typeof attentionCommit.execute !== "function") {
          throw new Error("attention_commit tool missing");
        }
        await attentionCommit.execute(
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: { author: "assistant", source: "test" },
            scores: Object.fromEntries(Object.keys(tracked.scores).map((key) => [key, 0])),
            summary: "resolved after compact",
            change: {
              type: "update",
              value: "resolved",
              format: "text/plain",
            },
            done: true,
            stage: "done",
          },
          {
            toolCallId: "call-attention-after-compact",
            emitCustomEvent: () => {},
          },
        );
        return {
          thinking: "retry-ok",
          text: "",
          finishReason: "stop",
        };
      },
    } as unknown as ModelClient;

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
      onModelCall: (record) => {
        lifecycle.push(record);
      },
    });

    const firstResponse = await ai.send([
      createAttentionItemsMessage("ctx-main unresolved score", {
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);
    expect(firstResponse).toBeUndefined();
    expect(compactInputs).toEqual([]);
    expect(
      lifecycle.some((record) => record.status === "error" && record.outcome?.reason === "model.context_overflow"),
    ).toBeTrue();

    const compactTrigger = ai.consumePendingCompactRequest();
    expect(compactTrigger).toBe("error");
    if (!compactTrigger) {
      return;
    }
    await ai.runCompactCycle({ trigger: compactTrigger });
    const response = await ai.send([
      createAttentionItemsMessage("ctx-main unresolved score", {
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);
    expect(response).toBeUndefined();

    expect(round).toBe(2);
    expect(compactInputs.length).toBeGreaterThan(0);
    expect(compactInputs.join("\n")).toContain("attention_system");
    expect(chat.engine.list()).toHaveLength(0);
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
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
    expect(ai.consumePendingCompactRequest()).toBe("error");
    expect(response).toBeUndefined();
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
      toolProviders: createToolProviders({ terminalGateway: terminal.gateway }),
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
    expect(response).toBeUndefined();
  });

  test("Scenario: Given an external stop during server-tool execution When the shared signal aborts Then AgenterAI cancels the round instead of accepting the late tool result", async () => {
    const lifecycle: Array<{
      status: "running" | "done" | "error" | "cancelled";
      completedAt?: number;
      outcome?: AgentModelCallRecord["outcome"];
      error?: { message: string; details?: unknown };
    }> = [];
    const writeCalls: Array<{
      terminalId: string;
      text: string;
      submit?: boolean;
      submitKey?: "enter" | "linefeed";
    }> = [];
    const terminal: TerminalGatewayLike = {
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
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true, message: "written" };
      },
      read: async (_input) => ({ ok: true }),
      snapshot: async (_input) => ({ ok: true }),
      getConfig: async () => ({ transport: { port: 4100 } }),
      setConfig: async (_input) => ({ transport: { port: 4100 } }),
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
      toolProviders: createToolProviders({ terminalGateway: terminal }),
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

    await expect(
      ai.send([createUserMessage("run a terminal tool")], { signal: externalAbort.signal }),
    ).rejects.toMatchObject({
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

  test("Scenario: Given prompt-window persistence When a normal round runs Then AgenterAI commits user and assistant replay states before referencing them in model-call facts", async () => {
    const chat = createAttentionGateway();
    const promptWindowStore = createPromptWindowStoreSpy();
    const modelCalls: AgentModelCallRecord[] = [];

    const modelClient = createModelClient(async (input) => {
      expect(extractUserReplay(input).join("\n")).toContain("persist this turn");
      return {
        thinking: "",
        text: "assistant persisted reply",
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
      promptWindowStore: promptWindowStore.store,
      initialPromptWindowState: promptWindowStore.initialState,
      onModelCall: (record) => {
        modelCalls.push(record);
      },
    });

    await ai.send([createUserMessage("persist this turn")]);

    expect(promptWindowStore.appendCalls).toHaveLength(2);
    expect(promptWindowStore.appendCalls[0]?.setCurrent).toBeTrue();
    expect(extractUserReplay(promptWindowStore.appendCalls[0]?.messages).join("\n")).toContain("persist this turn");
    expect(promptWindowStore.appendCalls[1]?.setCurrent).toBeTrue();
    expect(extractAssistantReplay(promptWindowStore.appendCalls[1]?.messages)).toContain("assistant persisted reply");

    const runningRecord = modelCalls.find((record) => record.status === "running");
    const doneRecord = modelCalls.find((record) => record.status === "done");
    expect(runningRecord?.request.promptWindowStateId).toBe(promptWindowStore.states[1]?.id);
    expect(runningRecord?.request.roundIndex).toBe(promptWindowStore.states[1]?.roundIndex);
    expect(
      doneRecord?.response &&
        typeof doneRecord.response === "object" &&
        "decision" in doneRecord.response &&
        doneRecord.response.decision &&
        typeof doneRecord.response.decision === "object" &&
        "nextPromptWindowStateId" in doneRecord.response.decision
        ? doneRecord.response.decision.nextPromptWindowStateId
        : null,
    ).toBe(promptWindowStore.states[2]?.id);
    expect(ai.inspectDebugState().promptWindow).toEqual(promptWindowStore.states[2]?.messages);
  });

  test("Scenario: Given compact succeeds When the summary replaces history Then AgenterAI only switches current prompt window after the new compact state is committed", async () => {
    const chat = createAttentionGateway();
    const promptWindowStore = createPromptWindowStoreSpy([
      {
        role: "user",
        content: "before compact",
      },
    ]);
    const modelCalls: AgentModelCallRecord[] = [];

    const modelClient = createModelClient(async (input) => {
      expect(flattenModelMessageContent(input.messages[0])).toContain("before compact");
      return {
        thinking: "",
        text: JSON.stringify({
          overview: "compacted overview",
          decisions: ["keep durable facts"],
          keyFiles: [],
          keyFacts: ["before compact"],
          unresolvedWork: [],
          nextSteps: ["continue"],
        }),
        finishReason: "stop",
      };
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
      promptWindowStore: promptWindowStore.store,
      initialPromptWindowState: promptWindowStore.initialState,
      onModelCall: (record) => {
        modelCalls.push(record);
      },
    });

    await ai.runCompactCycle({ trigger: "manual" });

    expect(promptWindowStore.appendCalls).toHaveLength(2);
    expect(promptWindowStore.appendCalls[0]?.setCurrent).not.toBeTrue();
    expect(promptWindowStore.appendCalls[1]?.setCurrent).toBeTrue();
    expect(extractAssistantReplay(promptWindowStore.states[2]?.messages).join("\n")).toContain(
      "yaml+prompt_window_compact",
    );
    const doneRecord = modelCalls.find((record) => record.status === "done");
    expect(doneRecord?.request.promptWindowStateId).toBe(promptWindowStore.states[1]?.id);
    expect(doneRecord?.request.roundIndex).toBe(promptWindowStore.states[1]?.roundIndex);
    expect(
      doneRecord?.response &&
        typeof doneRecord.response === "object" &&
        "decision" in doneRecord.response &&
        doneRecord.response.decision &&
        typeof doneRecord.response.decision === "object" &&
        "nextPromptWindowStateId" in doneRecord.response.decision
        ? doneRecord.response.decision.nextPromptWindowStateId
        : null,
    ).toBe(promptWindowStore.states[2]?.id);
    expect(ai.inspectDebugState().promptWindow).toEqual(promptWindowStore.states[2]?.messages);
  });

  test("Scenario: Given compact omits a settled visible answer When the summary is committed Then AgenterAI preserves that answer for direct follow-up reuse", async () => {
    const chat = createAttentionGateway();
    const promptWindowStore = createPromptWindowStoreSpy([
      {
        role: "user",
        content: "gaubee在吗？问他中午吃什么？",
      },
      {
        role: "assistant",
        content: "Understood. I'll handle it and report back.",
      },
      {
        role: "assistant",
        content: "gaubee说中午吃蛋炒饭。",
      },
    ]);

    const modelClient = createModelClient(async () => ({
      thinking: "",
      text: JSON.stringify({
        overview: "compacted overview",
        decisions: [],
        keyFiles: [],
        keyFacts: [],
        unresolvedWork: [],
        nextSteps: [],
      }),
      finishReason: "stop",
    }));

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
      promptWindowStore: promptWindowStore.store,
      initialPromptWindowState: promptWindowStore.initialState,
    });

    await ai.runCompactCycle({ trigger: "manual" });

    const compactReplay = extractAssistantReplay(promptWindowStore.states[2]?.messages).join("\n");
    expect(compactReplay).toContain("Settled user-visible answer: gaubee说中午吃蛋炒饭。");
    expect(compactReplay).toContain("answer directly instead of reopening finished relay or lookup work");
  });

  test("Scenario: Given the settled answer only exists in message_send tool trace When compact runs Then AgenterAI still preserves the delivered origin-room answer", async () => {
    const chat = createAttentionGateway();
    const promptWindowStore = createPromptWindowStoreSpy([
      {
        role: "user",
        content: "gaubee在吗？问他中午吃什么？",
      },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            content: [
              "```yaml",
              "invocationId: message_send:relay",
              "tool: message_send",
              "status: success",
              "startedAt: 2026-04-12T00:00:00.000Z",
              "finishedAt: 2026-04-12T00:00:01.000Z",
              "input:",
              '  chatId: "chat-gaubee"',
              '  content: "gaubee，有人问你中午吃什么？"',
              "output:",
              "  ok: true",
              '  messageId: "msg-relay"',
              "error: null",
              "```",
            ].join("\n"),
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            content: [
              "```yaml",
              "invocationId: message_send:origin",
              "tool: message_send",
              "status: success",
              "startedAt: 2026-04-12T00:00:02.000Z",
              "finishedAt: 2026-04-12T00:00:03.000Z",
              "input:",
              '  chatId: "chat-main"',
              '  content: "gaubee说中午吃蛋炒饭。"',
              "output:",
              "  ok: true",
              '  messageId: "msg-origin"',
              "error: null",
              "```",
            ].join("\n"),
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "text",
            content: [
              "```yaml+attention_items",
              "commits:",
              "-",
              "  contextId: ctx-chat-main",
              "  commitId: commit-main",
              "  done: true",
              '  summary: "Delivered lunch answer back to origin room."',
              "  scores:",
              "    lunch: 0",
              "```",
            ].join("\n"),
          },
        ],
      },
    ]);

    const modelClient = createModelClient(async () => ({
      thinking: "",
      text: JSON.stringify({
        overview: "compacted overview",
        decisions: [],
        keyFiles: [],
        keyFacts: [],
        unresolvedWork: [],
        nextSteps: [],
      }),
      finishReason: "stop",
    }));

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
      promptWindowStore: promptWindowStore.store,
      initialPromptWindowState: promptWindowStore.initialState,
    });

    await ai.runCompactCycle({ trigger: "manual" });

    const compactReplay = extractAssistantReplay(promptWindowStore.states[2]?.messages).join("\n");
    expect(compactReplay).toContain("Settled user-visible answer: gaubee说中午吃蛋炒饭。");
    expect(compactReplay).not.toContain("Settled user-visible answer: gaubee，有人问你中午吃什么？");
  });

  test("Scenario: Given compact fails When no model summary is produced Then AgenterAI falls back to an emergency compact snapshot", async () => {
    const chat = createAttentionGateway();
    const initialMessages = [
      {
        role: "user" as const,
        content: "before failed compact",
      },
    ];
    const promptWindowStore = createPromptWindowStoreSpy(initialMessages);

    const modelClient = createModelClient(async () => {
      throw new Error("compact failed");
    });

    const ai = new AgenterAI({
      modelClient,
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      attentionGateway: chat.gateway,
      promptWindowStore: promptWindowStore.store,
      initialPromptWindowState: promptWindowStore.initialState,
    });

    await ai.runCompactCycle({ trigger: "manual" });

    expect(promptWindowStore.appendCalls).toHaveLength(2);
    expect(promptWindowStore.appendCalls[0]?.setCurrent).not.toBeTrue();
    expect(promptWindowStore.appendCalls[1]?.setCurrent).toBeTrue();
    expect(extractAssistantReplay(promptWindowStore.states[2]?.messages).join("\n")).toContain(
      "yaml+prompt_window_compact",
    );
    expect(extractAssistantReplay(promptWindowStore.states[2]?.messages).join("\n")).toContain("Emergency compact");
    expect(ai.inspectDebugState().promptWindow).toEqual(promptWindowStore.states[2]?.messages);
  });
});
