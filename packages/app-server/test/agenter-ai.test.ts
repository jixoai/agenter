import type {
  AttentionActiveContextMatch,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import { AttentionSystem } from "@agenter/attention-system";
import { DEFAULT_LOOP_COMPACT_POLICY } from "@agenter/settings";
import type { MessageActorId } from "@agenter/message-system";
import type { TerminalProcessProfile } from "@agenter/terminal-system";
import { describe, expect, test } from "bun:test";

import {
  AgenterAI,
  type AgentModelCallRecord,
  type AgentPromptWindowCompactSummary,
  type AgentPromptWindowStateRecord,
  type AgentToolProvider,
} from "../src/agenter-ai";
import { projectAttentionCommitMatchForModel } from "../src/attention-model-view";
import { buildAttentionSearchDocument } from "../src/attention-search/documents";
import { compileAttentionSearch } from "../src/attention-search/query";
import type { AttentionSearchRequest } from "../src/attention-search/types";
import { type LoopBusMessage } from "../src/loop-bus";
import type { ModelClient } from "../src/model-client";
import type { PromptDocRecord } from "../src/prompt-docs";
import { FilePromptStore } from "../src/prompt-store";
import {
  createInProcessWorkspaceToolProvider,
} from "../src/workspace-tool-provider";
import type { RuntimeLocalApiHandlers } from "../src/runtime-tool-descriptors";
import { projectRuntimeAttentionActiveMatch } from "../src/runtime-tool-views";
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
    getContextBudgetTokens() {
      return null;
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
  const writeCalls: Array<{ terminalId: string; text: string }> = [];
  return {
    writeCalls,
    gateway: {
      list: () => [],
      create: async (_input: {
        terminalId?: string;
        processKind?: string;
        command?: string[];
        cwd?: string;
        profile?: TerminalProcessProfile;
        focus?: boolean;
      }) => ({ ok: true, message: "created" }),
      kill: async (_input: { terminalId: string }) => ({ ok: true, message: "stopped" }),
      focus: async (_input: { op?: "add" | "remove" | "replace" | "clear"; terminalIds?: string[] }) => ({
        ok: true,
        message: "focused",
        focusedTerminalIds: ["iflow"],
      }),
      write: async (input: { terminalId: string; text: string }) => {
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
type AttentionGatewayLike = ReturnType<typeof createAttentionGateway>["gateway"];
type MessageGatewayLike = ReturnType<typeof createMessageGateway>["gateway"];

const ROOT_WORKSPACE_PATH = "/runtime/test-root";
type WorkspaceListPayload = Array<{
  id: number;
  cwd: string;
  alias: string;
}>;

const createToolContext = (toolCallId: string) => ({
  toolCallId,
  emitCustomEvent: () => {
    // no-op
  },
});

const findExecutableTool = (
  tools: readonly { name: string; execute?: ((input: unknown, context: ReturnType<typeof createToolContext>) => unknown) | undefined }[],
  toolName: string,
) => {
  const tool = tools.find((entry) => entry.name === toolName);
  expect(tool).toBeDefined();
  if (!tool || typeof tool.execute !== "function") {
    throw new Error(`tool not executable: ${toolName}`);
  }
  return tool;
};

const findWorkspaceListTool = (input: Pick<ModelRespondInput, "tools">) =>
  findExecutableTool(input.tools, "workspace_list");

const findRootBashTool = (input: Pick<ModelRespondInput, "tools">) =>
  findExecutableTool(input.tools, "root_bash");

const buildRootBashInput = (command: string, payload?: unknown, cwd?: string) =>
  ({
    command,
    ...(cwd ? { cwd } : {}),
    ...(payload === undefined ? {} : { stdin: JSON.stringify(payload) }),
  }) satisfies {
    command: string;
    cwd?: string;
    stdin?: string;
  };

const stringifyRootBashArgs = (command: string, payload?: unknown, cwd?: string): string =>
  JSON.stringify(buildRootBashInput(command, payload, cwd));

const parseRootBashStdout = <T>(output: { stdout: string; stderr: string; exitCode: number }): T => {
  expect(output.exitCode).toBe(0);
  expect(output.stderr).toBe("");
  return JSON.parse(output.stdout) as T;
};

const buildRootBashSuccessResult = (payload: unknown, cwd = ROOT_WORKSPACE_PATH) => ({
  stdout: `${JSON.stringify(payload)}\n`,
  stderr: "",
  exitCode: 0,
  cwd,
});

const callWorkspaceList = async (
  input: Pick<ModelRespondInput, "tools">,
  toolCallId = "call-workspace_list",
): Promise<WorkspaceListPayload> =>
  (await findWorkspaceListTool(input).execute!({}, createToolContext(toolCallId))) as WorkspaceListPayload;

const callRootBashJson = async <T>(
  input: Pick<ModelRespondInput, "tools">,
  args: {
    command: string;
    payload?: unknown;
    toolCallId: string;
    cwd?: string;
  },
): Promise<T> => {
  const output = (await findRootBashTool(input).execute!(
    buildRootBashInput(args.command, args.payload, args.cwd),
    createToolContext(args.toolCallId),
  )) as {
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  };
  expect(output.cwd).toBe(args.cwd ?? ROOT_WORKSPACE_PATH);
  return parseRootBashStdout<T>(output);
};

const callAttentionQueryViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: { query: string; offset?: number; limit?: number },
  toolCallId = "call-attention-query",
) =>
  await callRootBashJson<{
    ok: true;
    items: Array<ReturnType<typeof projectAttentionCommitMatchForModel>>;
  }>(input, {
    command: "attention query",
    payload,
    toolCallId,
  });

const callAttentionCommitViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: Record<string, unknown>,
  toolCallId = "call-attention-commit",
) =>
  await callRootBashJson<{
    ok: true;
    commit: {
      commitId: string;
      contextId: string;
      meta: {
        author: string;
        source: string;
      };
      scores: Record<string, number>;
      summary: string;
      change: {
        type: string;
        value?: string;
        format?: string;
      };
    };
  }>(input, {
    command: "attention commit",
    payload,
    toolCallId,
  });

const callMessageListViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload?: { includeArchived?: boolean; limit?: number },
  toolCallId = "call-message-list",
) =>
  await callRootBashJson<{
    ok: true;
    channels: Array<{
      chatId: string;
      title: string;
      focused: boolean;
    }>;
  }>(input, {
    command: "message list",
    payload,
    toolCallId,
  });

const callMessageReadViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: { chatId: string; limit?: number },
  toolCallId = "call-message-read",
) =>
  await callRootBashJson<{
    ok: true;
    snapshot: {
      channel: {
        chatId: string;
        title: string;
      };
      items: Array<{
        messageId: number;
        content: string;
      }>;
    };
  }>(input, {
    command: "message read",
    payload,
    toolCallId,
  });

const callMessageQueryViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: {
    chatId: string | string[] | "*";
    mode: "match" | "query" | "sql";
    query: string;
    offset?: number;
    limit?: number;
  },
  toolCallId = "call-message-query",
) =>
  await callRootBashJson<{
    ok: true;
    result:
      | {
          resultKind: "messages";
          mode: "match" | "query" | "sql";
          chatIds: string[];
          items: Array<{
            chatId: string;
            chatTitle?: string;
            contextId?: string;
            score?: number;
            message: {
              messageId: number;
              content: string;
            };
          }>;
        }
      | {
          resultKind: "sql";
          mode: "match" | "query" | "sql";
          chatIds: string[];
          columns: string[];
          rows: Array<Record<string, string | number | null>>;
        };
  }>(input, {
    command: "message query",
    payload,
    toolCallId,
  });

const callMessageSendViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: { chatId: string; content: string; ref?: number; from?: string },
  toolCallId = "call-message-send",
) =>
  await callRootBashJson<{
    ok: true;
    result: {
      ok: true;
      messageId: number;
      recentMessages: Array<{
        messageId: number;
        from: string;
        contentPreview: string;
        sendTime: string;
        editedTime?: string;
        recalledTime?: string;
      }>;
    };
  }>(input, {
    command: "message send",
    payload,
    toolCallId,
  });

const callTerminalListViaCli = async (input: Pick<ModelRespondInput, "tools">, toolCallId = "call-terminal-list") =>
  await callRootBashJson<{ ok: true; terminals: unknown[] }>(input, {
    command: "terminal list",
    toolCallId,
  });

const callTerminalCreateViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: Record<string, unknown>,
  toolCallId = "call-terminal-create",
) =>
  await callRootBashJson<{
    ok: true;
    result: {
      ok: boolean;
      message: string;
    };
  }>(input, {
    command: "terminal create",
    payload,
    toolCallId,
  });

const callTerminalReadViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: { terminalId: string; mode?: "auto" | "diff" | "snapshot" },
  toolCallId = "call-terminal-read",
) =>
  await callRootBashJson<{
    ok: true;
    result: Record<string, unknown>;
  }>(input, {
    command: "terminal read",
    payload,
    toolCallId,
  });

const callTerminalWriteViaCli = async (
  input: Pick<ModelRespondInput, "tools">,
  payload: { terminalId: string; text: string },
  toolCallId = "call-terminal-write",
) =>
  await callRootBashJson<{
    ok: true;
    result: {
      ok: boolean;
      message: string;
    };
  }>(input, {
    command: "terminal write",
    payload,
    toolCallId,
  });

const createRuntimeLocalHandlers = (input: {
  attentionGateway?: AttentionGatewayLike;
  terminalGateway?: TerminalGatewayLike;
  messageGateway?: MessageGatewayLike;
}): RuntimeLocalApiHandlers => ({
  attentionList: () => input.attentionGateway?.listContexts() ?? [],
  attentionActive: () => (input.attentionGateway?.listActive() ?? []).map(projectRuntimeAttentionActiveMatch),
  attentionQuery: async (request) =>
    input.attentionGateway ? (await input.attentionGateway.query(request)).map(projectAttentionCommitMatchForModel) : [],
  attentionCommit: async (request) => {
    if (!input.attentionGateway) {
      throw new Error("attention gateway not configured");
    }
    const resolvedScores = request.done
      ? (() => {
          const activeContext = input.attentionGateway?.listActive().find((item) => item.contextId === request.contextId);
          if (!activeContext) {
            return undefined;
          }
          const activeScores = Object.entries(activeContext.context.scoreMap).filter(([, value]) => value > 0);
          return Object.fromEntries(activeScores.map(([hash]) => [hash, 0]));
        })()
      : undefined;
    const effectiveScores =
      request.scores === undefined
        ? resolvedScores
        : resolvedScores
          ? {
              ...resolvedScores,
              ...request.scores,
            }
          : request.scores;
    return await input.attentionGateway.commit({
      contextId: request.contextId,
      parentCommitIds: request.parentCommitIds,
      meta: request.meta,
      scores: effectiveScores,
      summary: request.summary,
      change: request.change ?? { type: "clean" },
    });
  },
  messageList: (request) => (input.messageGateway ? input.messageGateway.listChannels(request) : []),
  messageRead: (request) => {
    if (!input.messageGateway) {
      throw new Error("message gateway not configured");
    }
    return input.messageGateway.read(request);
  },
  messageQuery: async (request) => {
    if (!input.messageGateway) {
      throw new Error("message gateway not configured");
    }
    return await input.messageGateway.query(request);
  },
  messageSend: async (request) => {
    if (!input.messageGateway) {
      throw new Error("message gateway not configured");
    }
    return await input.messageGateway.send(request);
  },
  messageEdit: async (request) => {
    if (!input.messageGateway) {
      throw new Error("message gateway not configured");
    }
    return await input.messageGateway.edit(request);
  },
  messageRecall: async (request) => {
    if (!input.messageGateway) {
      throw new Error("message gateway not configured");
    }
    return await input.messageGateway.recall(request);
  },
  workspaceList: () => [],
  workspaceSetAlias: async ({ workspaceId, alias }) => ({
    workspace: {
      workspaceId,
      alias,
      cwd: `/workspace/${workspaceId}`,
      mount: {
        workspacePath: `/workspace/${workspaceId}`,
        kind: "project",
      },
      grants: [],
    },
  }),
  terminalList: () => input.terminalGateway?.list() ?? [],
  terminalCreate: async (request) => {
    if (!input.terminalGateway) {
      throw new Error("terminal gateway not configured");
    }
    return await input.terminalGateway.create(request);
  },
  terminalRead: async (request) => {
    if (!input.terminalGateway) {
      throw new Error("terminal gateway not configured");
    }
    return await input.terminalGateway.read(request);
  },
  terminalWrite: async (request) => {
    if (!input.terminalGateway) {
      throw new Error("terminal gateway not configured");
    }
    return await input.terminalGateway.write(request);
  },
  terminalFocus: async (request) => {
    if (!input.terminalGateway) {
      throw new Error("terminal gateway not configured");
    }
    return await input.terminalGateway.focus(request);
  },
  terminalKill: async (request) => {
    if (!input.terminalGateway) {
      throw new Error("terminal gateway not configured");
    }
    return await input.terminalGateway.kill(request);
  },
});

const createToolProviders = (
  input: {
    attentionGateway?: AttentionGatewayLike;
    terminalGateway?: TerminalGatewayLike;
    messageGateway?: MessageGatewayLike;
  } = {},
): AgentToolProvider[] => {
  if (!input.attentionGateway && !input.terminalGateway && !input.messageGateway) {
    return [];
  }
  return [
    createInProcessWorkspaceToolProvider({
      handlers: createRuntimeLocalHandlers(input),
      workspaceList: () => [],
      rootWorkspacePath: ROOT_WORKSPACE_PATH,
    }),
  ];
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
    ref?: number;
    from?: string;
    createdAt: number;
    updatedAt: number;
    recalledAt?: number;
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
  const history = new Map<
    string,
    Array<{
      rowId: number;
      messageId: number;
      chatId: string;
      ref?: number;
      from: string;
      kind: "text";
      content: string;
      createdAt: number;
      updatedAt: number;
      visibleAt: number;
      recalledAt?: number;
      readActorIds: MessageActorId[];
      unreadActorIds: MessageActorId[];
    }>
  >([
    ["chat-main", []],
    [
      "room-qa",
      [
        {
          rowId: 1,
          messageId: 1,
          chatId: "room-qa",
          from: "kzf",
          kind: "text",
          content: "budget incident alpha",
          createdAt: Date.now() - 2_000,
          updatedAt: Date.now() - 2_000,
          visibleAt: Date.now() - 2_000,
          readActorIds: [],
          unreadActorIds: [],
        },
      ],
    ],
  ]);
  const listRoomHistory = (chatId: string) => [...(history.get(chatId) ?? [])];
  const findChannel = (chatId: string) => channels.find((entry) => entry.chatId === chatId);
  const resolveQueryChatIds = (chatId: string | string[] | "*"): string[] =>
    chatId === "*" ? channels.map((channel) => channel.chatId) : Array.isArray(chatId) ? [...chatId] : [chatId];
  return {
    sent,
    gateway: {
      listChannels: (input?: { includeArchived?: boolean }) => {
        if (input?.includeArchived) {
          return [...channels];
        }
        return channels.filter((channel) => !("archivedAt" in channel && typeof channel.archivedAt === "number"));
      },
      getChannel: (input: { chatId: string; includeArchived?: boolean }) => {
        const channel = channels.find((entry) => entry.chatId === input.chatId);
        if (!channel) {
          return null;
        }
        if (!input.includeArchived && "archivedAt" in channel && typeof channel.archivedAt === "number") {
          return null;
        }
        return channel;
      },
      read: (input: { chatId: string; limit?: number }) => {
        const channel = findChannel(input.chatId);
        if (!channel) {
          throw new Error(`chat not found: ${input.chatId}`);
        }
        const items = listRoomHistory(input.chatId).slice(-(input.limit ?? Number.POSITIVE_INFINITY));
        return {
          channel,
          items,
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "head-1",
        };
      },
      query: async (input: {
        chatId: string | string[] | "*";
        mode: "match" | "query" | "sql";
        query: string;
        offset?: number;
        limit?: number;
      }) => {
        const chatIds = resolveQueryChatIds(input.chatId);
        const offset = input.offset ?? 0;
        const limit = input.limit ?? 100;
        const matchingItems = chatIds
          .flatMap((chatId) => {
            const channel = findChannel(chatId);
            return listRoomHistory(chatId).map((message) => ({
              chatId,
              chatTitle: channel?.title,
              contextId: channel?.contextId,
              score: 1,
              message,
            }));
          })
          .filter((entry) => entry.message.content.toLowerCase().includes(input.query.toLowerCase()));
        if (input.mode === "sql") {
          const rows = chatIds.map((chatId) => ({
            chatId,
            total: listRoomHistory(chatId).length,
          }));
          return {
            resultKind: "sql" as const,
            mode: input.mode,
            chatIds,
            offset,
            limit,
            nextOffset: null,
            hasMore: false,
            columns: ["chatId", "total"],
            rows,
          };
        }
        const items = matchingItems.slice(offset, offset + limit);
        return {
          resultKind: "messages" as const,
          mode: input.mode,
          chatIds,
          offset,
          limit,
          nextOffset: null,
          hasMore: false,
          items,
        };
      },
      send: async (input: { chatId: string; content: string; ref?: number; from?: string }) => {
        const roomHistory = history.get(input.chatId) ?? [];
        const nextMessageId = (roomHistory.at(-1)?.messageId ?? 0) + 1;
        const timestamp = Date.now();
        const record = {
          rowId: nextMessageId,
          messageId: nextMessageId,
          chatId: input.chatId,
          ref: input.ref,
          from: input.from ?? "default",
          kind: "text" as const,
          content: input.content,
          createdAt: timestamp,
          updatedAt: timestamp,
          visibleAt: timestamp,
          readActorIds: [],
          unreadActorIds: [],
        };
        history.set(input.chatId, [...roomHistory, record]);
        sent.push({
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return {
          ok: true as const,
          messageId: nextMessageId,
          recentMessages: listRoomHistory(input.chatId).slice(-5).map((item) => ({
            messageId: item.messageId,
            from: item.from,
            contentPreview: item.content,
            sendTime: `20260418000000${String(item.messageId).padStart(3, "0")}`,
          })),
        };
      },
      edit: async (input: { chatId: string; messageId: number; content: string }) => {
        const roomHistory = history.get(input.chatId) ?? [];
        const record = roomHistory.find((entry) => entry.messageId === input.messageId);
        if (!record) {
          throw new Error(`message not found: ${input.chatId}/${input.messageId}`);
        }
        record.content = input.content;
        record.updatedAt = Date.now();
        return { ok: true, messageId: input.messageId, updatedAt: record.updatedAt };
      },
      recall: async (input: { chatId: string; messageId: number }) => {
        const roomHistory = history.get(input.chatId) ?? [];
        const record = roomHistory.find((entry) => entry.messageId === input.messageId);
        if (!record) {
          throw new Error(`message not found: ${input.chatId}/${input.messageId}`);
        }
        record.recalledAt = Date.now();
        record.updatedAt = record.recalledAt;
        return {
          ok: true,
          messageId: input.messageId,
          updatedAt: record.updatedAt,
          recalledAt: record.recalledAt,
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
  test("Scenario: Given runtime root tools When terminal CLI is needed Then AgenterAI exposes workspace_list plus root_bash/workspace_bash and terminal subcommands execute through root_bash", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    let toolNames: string[] = [];

    const modelClient = createModelClient(async (input) => {
      toolNames = input.tools.map((tool) => tool.name);
      expect(await callWorkspaceList(input)).toEqual([]);

      const createResult = await callTerminalCreateViaCli(
        input,
        {
          terminalId: "iflow",
          cwd: "/tmp/workspace",
          focus: true,
        },
        "call-terminal-create",
      );
      expect(createResult.result.ok).toBeTrue();

      const readResult = await callTerminalReadViaCli(
        input,
        {
          terminalId: "iflow",
          mode: "snapshot",
        },
        "call-terminal-read",
      );
      expect(readResult.ok).toBeTrue();

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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("inspect the terminal surface")]);

    expect(toolNames).toEqual(["workspace_list", "root_bash", "workspace_bash"]);
  });

  test("Scenario: Given a message gateway When tools are exposed Then message list/read/query/send run through root_bash", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    let toolNames: string[] = [];

    const modelClient = createModelClient(async (input) => {
      toolNames = input.tools.map((tool) => tool.name);
      const listResult = await callMessageListViaCli(
        input,
        {
          includeArchived: false,
        },
        "call-message-list",
      );
      expect(listResult.channels.some((channel) => channel.chatId === "chat-main")).toBeTrue();

      const readResult = await callMessageReadViaCli(
        input,
        {
          chatId: "room-qa",
        },
        "call-message-read",
      );
      expect(readResult.snapshot.channel.chatId).toBe("room-qa");
      expect(readResult.snapshot.channel.title).toBe("QA Room");

      const queryResult = await callMessageQueryViaCli(
        input,
        {
          chatId: "*",
          mode: "query",
          query: "budget incident",
          limit: 5,
        },
        "call-message-query",
      );
      expect(queryResult.result.resultKind).toBe("messages");
      if (queryResult.result.resultKind !== "messages") {
        throw new Error("expected message query result");
      }
      expect(queryResult.result.chatIds).toEqual(["chat-main", "room-qa"]);
      expect(queryResult.result.items.map((item) => item.chatId)).toEqual(["room-qa"]);
      expect(queryResult.result.items[0]?.message.content).toBe("budget incident alpha");

      const sqlResult = await callMessageQueryViaCli(
        input,
        {
          chatId: ["room-qa"],
          mode: "sql",
          query: "select chatId, count(*) as total from messages group by chatId",
          limit: 5,
        },
        "call-message-query-sql",
      );
      expect(sqlResult.result.resultKind).toBe("sql");
      if (sqlResult.result.resultKind !== "sql") {
        throw new Error("expected sql query result");
      }
      expect(sqlResult.result.chatIds).toEqual(["room-qa"]);
      expect(sqlResult.result.columns).toEqual(["chatId", "total"]);
      expect(sqlResult.result.rows).toEqual([{ chatId: "room-qa", total: 1 }]);

      const sendResult = await callMessageSendViaCli(
        input,
        {
          chatId: "chat-main",
          content: "hello from tool",
        },
        "call-message-send",
      );

      expect(sendResult.result.ok).toBeTrue();
      expect(sendResult.result.messageId).toBe(1);
      expect(sendResult.result.recentMessages.at(-1)).toMatchObject({
        messageId: 1,
        from: "default",
        contentPreview: "hello from tool",
      });
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
        attentionGateway: chat.gateway,
        terminalGateway: terminal.gateway,
        messageGateway: message.gateway,
      }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("dispatch a message")]);

    expect(toolNames).toEqual(["workspace_list", "root_bash", "workspace_bash"]);
    expect(message.sent).toHaveLength(1);
    expect(message.sent[0]).toMatchObject({
      chatId: "chat-main",
      content: "hello from tool",
    });
  });

  test("Scenario: Given no external tool providers When a round is assembled Then AgenterAI keeps attention, message, and terminal SDK tools hidden", async () => {
    const chat = createAttentionGateway();
    let toolNames: string[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        toolNames = input.tools.map((tool) => tool.name);
        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({}),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("hello")]);

    expect(toolNames).not.toContain("attention_context_list");
    expect(toolNames).not.toContain("attention_query");
    expect(toolNames).not.toContain("attention_commit");
    expect(toolNames).not.toContain("message_send");
    expect(toolNames).not.toContain("terminal_create");
    expect(toolNames).not.toContain("terminal_read");
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
        attentionGateway: chat.gateway,
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway }),
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      const list = await callAttentionQueryViaCli(input, {
        query: `context:${chat.defaultContextId} minscore:1`,
        limit: 20,
      });
      expect(list.items.some((item) => item.commit.commitId === userItem.commitId)).toBeTrue();

      await callAttentionCommitViaCli(input, {
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      const result = await callAttentionCommitViaCli(input, {
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
      });
      expect(result.ok).toBeTrue();
      expect(result.commit.commitId.length).toBeGreaterThan(0);

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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("continue")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
    expect(chat.engine.query({ query: "minscore:0 startup ping" })).toHaveLength(1);
  });

  test("Scenario: Given attention commit CLI omits author and source When the tool executes Then the stored commit uses context defaults", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const modelClient = createModelClient(async (input) => {
      const result = await callAttentionCommitViaCli(
        input,
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
        "call-attention-commit-default-meta",
      );
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("记录默认 meta 行为")]);
    expect(response).toBeUndefined();

    const commit = chat.system.getContext(chat.defaultContextId)?.listCommits().at(-1);
    expect(commit).toBeDefined();
    expect(commit?.meta.author).toBe("tester");
    expect(commit?.meta.source).toBe("attention");
  });

  test("Scenario: Given attention commit CLI only provides done on a resolved context When the tool executes Then runtime cleans the context and clears the active scores", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "需要闭环", from: "user", score: 100 });
    const modelClient = createModelClient(async (input) => {
      const result = await callAttentionCommitViaCli(
        input,
        {
          contextId: chat.defaultContextId,
          parentCommitIds: [tracked.commitId],
          summary: "已完成闭环",
          done: true,
          stage: "done",
        },
        "call-attention-commit-done-no-scores",
      );
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    const response = await ai.send([createUserMessage("继续处理")]);
    expect(response).toBeUndefined();

    expect(chat.engine.list()).toHaveLength(0);
    const commit = chat.system.getContext(chat.defaultContextId)?.listCommits().at(-1);
    expect(commit?.scores).toEqual(Object.fromEntries(Object.keys(tracked.scores).map((hash) => [hash, 0])));
    expect(commit?.change).toEqual({ type: "clean" });
  });

  test("Scenario: Given attention commit CLI provides done with its own score map When the tool executes Then the tool clears existing debt and preserves the caller scores", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "需要闭环", from: "user", score: 100 });
    const modelClient = createModelClient(async (input) => {
      const result = await callAttentionCommitViaCli(
        input,
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
        "call-attention-commit-done-with-scores",
      );
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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

  test("Scenario: Given chat-backed attention When the model clears scores without dispatching a visible reply Then AgenterAI accepts the attention mutation and leaves visible chat to runtime message actions", async () => {
    const terminal = createTerminalGateway();
    const chat = createAttentionGateway();
    const message = createMessageGateway();
    const tracked = chat.engine.add({ content: "Reply with exactly PLAYWRIGHT-MOCK-REPLY", from: "user", score: 100 });
    let calls = 0;
    const modelCalls: AgentModelCallRecord[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        calls += 1;
        await callAttentionCommitViaCli(
          input,
          {
            contextId: chat.defaultContextId,
            parentCommitIds: [tracked.commitId],
            meta: {
              author: "assistant",
              source: "test",
              src: "msg:chat-main/1",
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
          "call-attention-commit-1",
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
        attentionGateway: chat.gateway,
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
        await callMessageSendViaCli(
          input,
          {
            chatId: "chat-main",
            content: "gaubee 说中午吃蛋炒饭",
          },
          "call-message-send-main",
        );
        await callAttentionCommitViaCli(
          input,
          {
            contextId: "ctx-chat-main",
            meta: {
              author: "assistant",
              source: "test",
              src: "msg:chat-main/1",
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
          "call-attention-commit-main",
        );
        await callAttentionCommitViaCli(
          input,
          {
            contextId: "ctx-chat-gaubee",
            meta: {
              author: "assistant",
              source: "test",
              src: "msg:chat-gaubee/1",
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
          "call-attention-commit-gaubee",
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
        attentionGateway: chat.gateway,
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
    expect(message.sent).toHaveLength(1);
    expect(message.sent[0]).toMatchObject({
      chatId: "chat-main",
      content: "gaubee 说中午吃蛋炒饭",
    });
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
        await callTerminalListViaCli(input, `call-terminal-list-${calls}`);
        return {
          thinking: "Observed terminal topology.",
          text: "I checked the terminal.",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      ok?: boolean;
      result?: unknown;
      error?: string | null;
    }> = [];
    const modelCalls: AgentModelCallRecord[] = [];

    const ai = new AgenterAI({
      modelClient: createModelClient(async (input) => {
        await input.onUpdate?.({
          kind: "tool_call",
          toolCallId: "call-attention-commit-stable",
          toolName: "root_bash",
          argsText: "",
          timestamp: Date.now(),
        });

        await callAttentionCommitViaCli(
          input,
          {
            contextId: chat.defaultContextId,
            summary: "mark handled",
            parentCommitIds: [],
            done: true,
          },
          "call-attention-commit-stable",
        );

        return {
          thinking: "",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ attentionGateway: chat.gateway }),
      attentionGateway: chat.gateway,
      onAssistantStream: async (update) => {
        streamedUpdates.push({
          kind: update.kind,
          toolCallId: "toolCallId" in update ? update.toolCallId : undefined,
          toolName: "toolName" in update ? update.toolName : undefined,
          argsText: "argsText" in update ? update.argsText : undefined,
          input: "input" in update ? update.input : undefined,
          ok: "ok" in update ? update.ok : undefined,
          result: "result" in update ? update.result : undefined,
          error: "error" in update ? update.error : undefined,
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
    expect(hydratedCallUpdate?.toolName).toBe("root_bash");
    expect(hydratedCallUpdate?.input).toMatchObject({
      command: "attention commit",
    });
    const hydratedInputRecord =
      hydratedCallUpdate?.input && typeof hydratedCallUpdate.input === "object"
        ? (hydratedCallUpdate.input as { stdin?: string })
        : null;
    expect(hydratedInputRecord?.stdin).toBeString();
    expect(JSON.parse(hydratedInputRecord?.stdin ?? "{}")).toMatchObject({
      contextId: chat.defaultContextId,
      summary: "mark handled",
      done: true,
    });
    const completedCallUpdate = streamedUpdates.find(
      (update) => update.kind === "tool_result" && update.toolCallId === "call-attention-commit-stable",
    );
    expect(completedCallUpdate).toMatchObject({
      ok: true,
    });

    const finalRecord = modelCalls.find((record) => record.status === "done");
    expect(finalRecord?.response?.toolTrace).toHaveLength(1);
    expect(finalRecord?.response?.toolTrace?.[0]?.invocationId).toBe("call-attention-commit-stable");
    expect(finalRecord?.response?.toolTrace?.[0]?.input).toMatchObject({
      command: "attention commit",
    });
    const toolTraceInput = finalRecord?.response?.toolTrace?.[0]?.input as { stdin?: string } | undefined;
    expect(JSON.parse(toolTraceInput?.stdin ?? "{}")).toMatchObject({
      contextId: chat.defaultContextId,
      summary: "mark handled",
      done: true,
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

        const matches = await callAttentionQueryViaCli(
          input,
          {
            query: `context:${chat.defaultContextId} minscore:1`,
            limit: 20,
          },
          "call-root-workspace-bash-attention-query",
        );

        expect(matches.items.some((item) => item.commit.commitId === tracked.commitId)).toBeTrue();
        expect(flattenModelMessageContent(input.messages.at(-1))).toContain("yaml+attention_items");
        expect(flattenModelMessageContent(input.messages.at(-1))).not.toContain("attention_round_retry");

        await callAttentionCommitViaCli(
          input,
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
          "call-root-workspace-bash-attention-commit",
        );

        return {
          thinking: "Observation: patched the attention item",
          text: "",
          finishReason: "stop",
        };
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
        await callMessageSendViaCli(
          input,
          {
            chatId: "chat-gaubee",
            content: "在吗？kzf 问你中午吃什么？",
          },
          "call-message-send",
        );
        await callAttentionCommitViaCli(
          input,
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
          "call-attention-commit",
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
        attentionGateway: chat.gateway,
        terminalGateway: terminal.gateway,
        messageGateway: {
          listChannels: () => [],
          getChannel: () => null,
          read: () => ({
            channel: {
              chatId: "chat-main",
              kind: "room" as const,
              title: "Main Room",
              owner: "agenter",
              contextId: "ctx-chat-main",
              participants: [],
              metadata: { builtIn: true },
              focused: true,
            },
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "head-1",
          }),
          query: async () => ({
            resultKind: "messages" as const,
            mode: "query" as const,
            chatIds: ["chat-main"],
            offset: 0,
            limit: 20,
            nextOffset: null,
            hasMore: false,
            items: [],
          }),
          send: async () => ({ ok: true as const, messageId: 1, recentMessages: [] }),
          edit: async () => ({ ok: true, messageId: 1, updatedAt: Date.now() }),
          recall: async () => ({ ok: true, messageId: 1, updatedAt: Date.now(), recalledAt: Date.now() }),
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
    expect(replay.some((item) => item.includes("tool: root_bash"))).toBeTrue();
    expect(replay.some((item) => item.includes('command: "message send"'))).toBeTrue();
    expect(replay.some((item) => item.includes('command: "attention commit"'))).toBeTrue();
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
        await callTerminalReadViaCli(
          input,
          {
            terminalId: "iflow",
          },
          "call-terminal-read",
        );

        await callAttentionCommitViaCli(
          input,
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
          "call-attention-reply",
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
      attentionGateway: chat.gateway,
    });

    await ai.send([createUserMessage("first turn")]);
    await ai.send([createUserMessage("second turn")]);

    const replay = extractAssistantReplay(seenInputs[1]);
    expect(replay.some((item) => item.includes("Decision: report result"))).toBeFalse();
    expect(replay.some((item) => item.includes("tool: root_bash"))).toBeTrue();
    expect(replay.some((item) => item.includes('command: "terminal read"'))).toBeTrue();
    expect(replay.some((item) => item.includes('command: "attention commit"'))).toBeTrue();
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
      getContextBudgetTokens() {
        return null;
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

        await callAttentionCommitViaCli(
          input,
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
          "call-chat-reply",
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
      getContextBudgetTokens() {
        return null;
      },
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        round += 1;

        if (round === 1) {
          const cliPayload = { chatId: "chat-main", content: "正在处理中" };
          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-interleaved",
            toolName: "root_bash",
            argsText: stringifyRootBashArgs("message send", cliPayload),
            input: buildRootBashInput("message send", cliPayload),
            timestamp: Date.now(),
          });
          await callMessageSendViaCli(input, cliPayload, "call-message-send-interleaved");
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-interleaved",
            toolName: "root_bash",
            ok: true,
            result: buildRootBashSuccessResult({
              ok: true,
              result: { ok: true, messageId: 1, recentMessages: [] },
            }),
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
    expect(assistantReplay.some((item) => item.includes("tool: root_bash"))).toBeTrue();
    expect(assistantReplay.some((item) => item.includes('command: "message send"'))).toBeTrue();
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
      getContextBudgetTokens() {
        return null;
      },
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        round += 1;

        if (round === 1) {
          const cliPayload = { chatId: "chat-main", content: "处理中-1" };
          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-1",
            toolName: "root_bash",
            argsText: stringifyRootBashArgs("message send", cliPayload),
            input: buildRootBashInput("message send", cliPayload),
            timestamp: Date.now(),
          });
          await callMessageSendViaCli(input, cliPayload, "call-message-send-1");
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-1",
            toolName: "root_bash",
            ok: true,
            result: buildRootBashSuccessResult({
              ok: true,
              result: { ok: true, messageId: 1, recentMessages: [] },
            }),
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
          const cliPayload = { chatId: "chat-main", content: "处理中-2" };
          await input.onUpdate?.({
            kind: "tool_call",
            toolCallId: "call-message-send-2",
            toolName: "root_bash",
            argsText: stringifyRootBashArgs("message send", cliPayload),
            input: buildRootBashInput("message send", cliPayload),
            timestamp: Date.now(),
          });
          await callMessageSendViaCli(input, cliPayload, "call-message-send-2");
          await input.onUpdate?.({
            kind: "tool_result",
            toolCallId: "call-message-send-2",
            toolName: "root_bash",
            ok: true,
            result: buildRootBashSuccessResult({
              ok: true,
              result: { ok: true, messageId: 2, recentMessages: [] },
            }),
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
    expect(thirdRoundAssistantReplay.some((item) => item.includes("tool: root_bash"))).toBeTrue();
    expect(thirdRoundAssistantReplay.some((item) => item.includes('command: "message send"'))).toBeTrue();
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
      getContextBudgetTokens() {
        return null;
      },
      async respondWithMeta(input: ModelRespondInput) {
        seenInputs.push(input);
        await callAttentionCommitViaCli(
          input,
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
          "call-attention-settle-without-followup",
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway }),
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
      getContextBudgetTokens() {
        return null;
      },
      async respondWithMeta(input: ModelRespondInput) {
        if (input.messages.length === 1) {
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
    const replay = extractAssistantReplay(ai.inspectDebugState().promptWindow);
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
      getContextBudgetTokens() {
        return null;
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
      getContextBudgetTokens() {
        return null;
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
        await callAttentionCommitViaCli(
          input,
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
          "call-attention-after-compact",
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
    expect(compactTrigger).toBe("context_overflow");
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

  test("Scenario: Given compact policy disables context-overflow recovery When the model overflows Then AgenterAI records the failure without enqueuing compact", async () => {
    const chat = createAttentionGateway();
    const tracked = chat.engine.add({ content: "overflow but no compact", from: "user", score: 100 });

    const ai = new AgenterAI({
      modelClient: createModelClient(async () => {
        throw new Error("maximum context length exceeded");
      }),
      logger: createLogger(),
      promptStore: new FilePromptStore({ defaultDocs: createPromptDocs() }),
      toolProviders: createToolProviders({ attentionGateway: chat.gateway }),
      attentionGateway: chat.gateway,
      compactPolicy: {
        threshold: { ...DEFAULT_LOOP_COMPACT_POLICY.threshold },
        recovery: {
          ...DEFAULT_LOOP_COMPACT_POLICY.recovery,
          contextOverflow: false,
        },
      },
    });

    const response = await ai.send([
      createAttentionItemsMessage("ctx-main unresolved score", {
        headCommitId: tracked.commitId,
        commitIds: [tracked.commitId],
      }),
    ]);

    expect(response).toBeUndefined();
    expect(ai.consumePendingCompactRequest()).toBeNull();
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
      toolProviders: createToolProviders({ attentionGateway: chat.gateway, terminalGateway: terminal.gateway }),
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
    expect(ai.consumePendingCompactRequest()).toBeNull();
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
    }> = [];
    const terminal: TerminalGatewayLike = {
      list: () => [],
      create: async () => ({ ok: true, message: "created" }),
      kill: async () => ({ ok: true, message: "stopped" }),
      focus: async () => ({ ok: true, message: "focused", focusedTerminalIds: ["iflow"] }),
      write: async (input: { terminalId: string; text: string }) => {
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
      setTimeout(() => {
        externalAbort.abort("session.stop");
      }, 5);
      await callTerminalWriteViaCli(
        input,
        {
          terminalId: "iflow",
          text: "echo still-running\r",
        },
        "call-terminal-write",
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
        text: "echo still-running\r",
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

  test("Scenario: Given the settled answer only exists in root_bash message-send trace When compact runs Then AgenterAI still preserves the delivered origin-room answer", async () => {
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
              "invocationId: root_bash:relay",
              "tool: root_bash",
              "status: success",
              "startedAt: 2026-04-12T00:00:00.000Z",
              "finishedAt: 2026-04-12T00:00:01.000Z",
              "input:",
              '  command: "message send --compact [\\"chat-gaubee\\",\\"gaubee，有人问你中午吃什么？\\"]"',
              "output:",
              '  stdout: "{\\"ok\\":true,\\"messageId\\":1}"',
              '  stderr: ""',
              "  exitCode: 0",
              '  cwd: "/workspace"',
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
              "invocationId: root_bash:origin",
              "tool: root_bash",
              "status: success",
              "startedAt: 2026-04-12T00:00:02.000Z",
              "finishedAt: 2026-04-12T00:00:03.000Z",
              "input:",
              '  command: "message send --compact [\\"chat-main\\",\\"gaubee说中午吃蛋炒饭。\\"]"',
              "output:",
              '  stdout: "{\\"ok\\":true,\\"messageId\\":2}"',
              '  stderr: ""',
              "  exitCode: 0",
              '  cwd: "/workspace"',
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
