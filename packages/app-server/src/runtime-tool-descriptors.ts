import type {
  AttentionCommit,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import type { MessageQueryRequest } from "@agenter/message-system";
import type { TerminalProcessProfile } from "@agenter/terminal-system";
import { toJSONSchema, z, type ZodTypeAny } from "zod";

import type {
  RuntimeAttentionActiveView,
  RuntimeMessageChannelView,
  RuntimeMessageQueryResult,
  RuntimeMessageSendResult,
  RuntimeSkillConfigInfoView,
  RuntimeSkillInfoView,
  RuntimeSkillMutationView,
  RuntimeMessageSnapshotView,
  RuntimeSkillView,
  RuntimeTerminalConfigMutationView,
  RuntimeTerminalConfigView,
  RuntimeTerminalView,
  RuntimeWorkspaceSurface,
} from "./runtime-tool-views";
import {
  buildRuntimeToolCompactSurface,
  decodeRuntimeToolCompactPayload,
  pickRuntimeToolCompactExamplePayload,
  renderRuntimeToolCompactFieldGuide,
  type RuntimeToolCompactSurface,
} from "./runtime-tool-compact";

export interface RuntimeLocalApiHandlers {
  attentionList: () => AttentionContextDescriptor[];
  attentionActive: () => RuntimeAttentionActiveView[];
  attentionDeliveryState: () => Promise<unknown> | unknown;
  attentionDeliveryTimeline: (input: {
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    limit?: number;
  }) => Promise<unknown> | unknown;
  attentionQuery: (input: { query: string; offset?: number; limit?: number }) => Promise<unknown>;
  attentionCommit: (input: AttentionCommitToolInput & { done?: boolean }) => Promise<AttentionCommit>;
  messageList: (input: { includeArchived?: boolean }) => RuntimeMessageChannelView[];
  messageRead: (input: { chatId: string; limit?: number }) => RuntimeMessageSnapshotView;
  messageQuery: (input: MessageQueryRequest) => Promise<RuntimeMessageQueryResult>;
  messageSend: (input: {
    chatId: string;
    content: string;
    ref?: number;
    from?: string;
    originAckFallback?: string;
    followUpAfterMs?: number;
  }) => Promise<RuntimeMessageSendResult>;
  messageEdit: (input: {
    chatId: string;
    messageId: number;
    content: string;
  }) => Promise<{ ok: boolean; messageId: number; updatedAt: number }>;
  messageRecall: (input: {
    chatId: string;
    messageId: number;
  }) => Promise<{ ok: boolean; messageId: number; updatedAt: number; recalledAt: number }>;
  workspaceList: () => Array<RuntimeWorkspaceSurface>;
  workspaceSetAlias: (input: { workspaceId: number; alias: string }) => Promise<{
    workspace: RuntimeWorkspaceSurface;
  }>;
  terminalList: () => RuntimeTerminalView[];
  terminalCreate: (input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
  }) => Promise<{ ok: boolean; message: string; terminal?: RuntimeTerminalView }>;
  terminalGetConfig: (input: { terminalId: string }) => Promise<RuntimeTerminalConfigView> | RuntimeTerminalConfigView;
  terminalSetConfig: (input: {
    terminalId: string;
    processKind?: string;
    command?: string[];
    launchCwd?: string;
    env?: Record<string, string>;
    cols?: number;
    rows?: number;
    gitLog?: false | "normal" | "verbose";
    logStyle?: "rich" | "plain";
    title?: string;
    icon?: string;
    shortcuts?: Record<string, string>;
    rendererEngine?: "xterm";
    metadata?: Record<string, unknown>;
  }) => Promise<RuntimeTerminalConfigMutationView> | RuntimeTerminalConfigMutationView;
  terminalRead: (input: {
    terminalId: string;
    mode?: "auto" | "diff" | "snapshot";
    recordActivity?: boolean;
    remark?: boolean;
  }) => Promise<unknown>;
  terminalAwait: (
    input: {
      terminalId: string;
      wait?: {
        until?: "changed" | "idle" | "match" | "absent";
        fromHash?: string | null;
        timeoutMs?: number;
        idleMs?: number;
      };
      match?: {
        pattern: string;
        regex?: boolean;
        caseInsensitive?: boolean;
        contextLines?: number;
      };
      view?: {
        type?: "tail";
        lines?: number;
      };
      recordActivity?: boolean;
    },
    context?: RuntimeToolHandlerContext,
  ) => Promise<unknown>;
  terminalWrite: (input: {
    terminalId: string;
    text: string;
  }) => Promise<{ ok: boolean; message: string }>;
  terminalInput: (input: {
    terminalId: string;
    text: string;
  }) => Promise<{ ok: boolean; message: string }>;
  terminalFocus: (input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  terminalBootstrap: (input: { terminalId: string }) => Promise<{
    ok: boolean;
    message: string;
    terminal?: RuntimeTerminalView;
  }>;
  terminalStop: (input: { terminalId: string }) => Promise<{
    ok: boolean;
    message: string;
    terminal?: RuntimeTerminalView;
  }>;
  skillList: () => RuntimeSkillView[];
  skillSearch: (input: { query?: string }) => RuntimeSkillView[];
  skillInfo: (input: { name: string; rootKind?: "builtin" | "shared" | "global" | "avatar" }) => Promise<RuntimeSkillInfoView> | RuntimeSkillInfoView;
  skillGetConfig: (input: {
    name: string;
    rootKind?: "builtin" | "shared" | "global" | "avatar";
  }) => Promise<RuntimeSkillConfigInfoView> | RuntimeSkillConfigInfoView;
  skillUpsert: (input: {
    name: string;
    content: string;
    rootKind?: "shared" | "global" | "avatar";
  }) => Promise<RuntimeSkillMutationView> | RuntimeSkillMutationView;
  skillSetConfig: (input: {
    name: string;
    config: {
      files?: string[];
    };
    rootKind?: "builtin" | "shared" | "global" | "avatar";
  }) => Promise<RuntimeSkillMutationView> | RuntimeSkillMutationView;
  skillRemove: (input: {
    name: string;
    rootKind?: "shared" | "global" | "avatar";
  }) => Promise<RuntimeSkillMutationView> | RuntimeSkillMutationView;
  skillRefresh: () => Promise<RuntimeSkillMutationView> | RuntimeSkillMutationView;
}

export type RuntimeToolNamespace = "attention" | "message" | "workspace" | "terminal" | "skill";

type RuntimeToolResult = Record<string, unknown>;

export interface RuntimeToolHandlerContext {
  signal?: AbortSignal;
}

type RuntimeToolExample =
  | {
      kind: "none";
      description?: string;
    }
  | {
      kind: "argv";
      payload: Record<string, unknown>;
      description?: string;
    }
  | {
      kind: "stdin";
      payload: Record<string, unknown>;
      description?: string;
    };

const runtimeToolExampleRank: Record<RuntimeToolExample["kind"], number> = {
  none: 0,
  stdin: 1,
  argv: 2,
};

export interface RuntimeToolDescriptor<TInput extends ZodTypeAny = ZodTypeAny> {
  namespace: RuntimeToolNamespace;
  name: string;
  route: `/${string}`;
  description: string;
  helpNotes?: readonly string[];
  inputSchema: TInput;
  examples: readonly RuntimeToolExample[];
  handler: (
    input: z.output<TInput>,
    handlers: RuntimeLocalApiHandlers,
    context?: RuntimeToolHandlerContext,
  ) => Promise<RuntimeToolResult> | RuntimeToolResult;
}

export type RuntimeToolCliInputMode = "object" | "compact";

const emptyObjectSchema = z.object({}).strict();
const runtimeMessageIdSchema = z.number().int().positive();

const attentionQuerySchema = z.object({
  query: z.string(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const attentionDeliveryTimelineSchema = z.object({
  contextId: z.string().trim().min(1).optional(),
  commitId: z.string().trim().min(1).optional(),
  cycleId: z.number().int().positive().optional(),
  sessionModelCallId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const attentionCommitChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update"),
    value: z.string(),
    format: z.string().optional(),
  }),
  z.object({
    type: z.literal("diff"),
    value: z.string(),
    format: z.string().optional(),
  }),
  z.object({
    type: z.literal("clean"),
  }),
]);

const attentionCommitSchema = z
  .object({
    contextId: z.string(),
    parentCommitIds: z.array(z.string()).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    scores: z.record(z.string(), z.number()).optional(),
    summary: z.string(),
    change: attentionCommitChangeSchema.optional(),
    done: z.boolean().optional(),
  })
  .refine((value) => value.change !== undefined || value.done === true, {
    message: "change is required unless done is true",
    path: ["change"],
  });

const messageListSchema = z.object({
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const messageReadSchema = z.object({
  chatId: z.string(),
  limit: z.number().int().min(1).max(200).optional(),
});

const messageQuerySchema = z.object({
  chatId: z.union([z.string().min(1), z.array(z.string().min(1)).min(1), z.literal("*")]),
  mode: z.enum(["match", "query", "sql"]),
  query: z.string().trim().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const messageSendSchema = z.object({
  chatId: z.string(),
  content: z.string(),
  ref: z.number().int().positive().optional(),
  from: z.string().optional(),
  originAckFallback: z.string().optional(),
  followUpAfterMs: z
    .number()
    .int()
    .positive()
    .describe(
      "Optional one-shot follow-up reminder in milliseconds. If this sent message is still the latest visible room message when the delay expires, the runtime creates attention instead of auto-sending a room reply.",
    )
    .optional(),
});

const messageEditSchema = z.object({
  chatId: z.string(),
  messageId: runtimeMessageIdSchema,
  content: z.string(),
});

const messageRecallSchema = z.object({
  chatId: z.string(),
  messageId: runtimeMessageIdSchema,
});

const terminalCreateSchema = z.object({
  terminalId: z.string().optional(),
  processKind: z.string().optional(),
  command: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  focus: z.boolean().optional(),
});

const terminalGetConfigSchema = z.object({
  terminalId: z.string(),
});

const terminalSetConfigSchema = z.object({
  terminalId: z.string(),
  processKind: z.string().optional(),
  command: z.array(z.string()).optional(),
  launchCwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  gitLog: z.union([z.literal(false), z.enum(["normal", "verbose"])]).optional(),
  logStyle: z.enum(["rich", "plain"]).optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
  shortcuts: z.record(z.string(), z.string()).optional(),
  rendererEngine: z.literal("xterm").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const terminalReadSchema = z.object({
  terminalId: z.string(),
  mode: z.enum(["auto", "diff", "snapshot"]).optional(),
  recordActivity: z.boolean().optional(),
  remark: z.boolean().optional(),
});

const terminalAwaitSchema = z.object({
  terminalId: z.string(),
  wait: z
    .object({
      until: z.enum(["changed", "idle", "match", "absent"]).optional(),
      fromHash: z.string().nullable().optional(),
      timeoutMs: z.number().int().min(0).max(600_000).optional(),
      idleMs: z.number().int().min(0).max(30_000).optional(),
    })
    .optional(),
  match: z
    .object({
      pattern: z.string().min(1),
      regex: z.boolean().optional(),
      caseInsensitive: z.boolean().optional(),
      contextLines: z.number().int().min(0).max(10).optional(),
    })
    .optional(),
  view: z
    .object({
      type: z.literal("tail").optional(),
      lines: z.number().int().min(1).max(500).optional(),
    })
    .optional(),
  recordActivity: z.boolean().optional(),
});

const terminalWriteSchema = z.object({
  terminalId: z.string(),
  text: z.string(),
});

const terminalInputSchema = z.object({
  terminalId: z.string(),
  text: z.string(),
});

const terminalFocusSchema = z.object({
  op: z.enum(["add", "remove", "replace", "clear"]),
  terminalIds: z.array(z.string()),
});

const terminalLifecycleMutationSchema = z.object({
  terminalId: z.string(),
});

const workspaceSetAliasSchema = z.object({
  workspaceId: z.number().int().positive(),
  alias: z.string().trim().min(1),
});

const skillSearchSchema = z.object({
  query: z.string().optional(),
});

const skillVisibleRootKindSchema = z.enum(["builtin", "shared", "global", "avatar"]);

const skillInfoSchema = z.object({
  name: z.string().trim().min(1),
  rootKind: skillVisibleRootKindSchema.optional(),
});

const skillRootKindSchema = z.enum(["shared", "global", "avatar"]);
const skillConfigSchema = z
  .object({
    files: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

const skillGetConfigSchema = z.object({
  name: z.string().trim().min(1),
  rootKind: skillVisibleRootKindSchema.optional(),
});

const skillUpsertSchema = z.object({
  name: z.string().trim().min(1),
  content: z.string().min(1),
  rootKind: skillRootKindSchema.optional(),
});

const skillSetConfigSchema = z.object({
  name: z.string().trim().min(1),
  config: skillConfigSchema,
  rootKind: skillVisibleRootKindSchema.optional(),
});

const skillRemoveSchema = z.object({
  name: z.string().trim().min(1),
  rootKind: skillRootKindSchema.optional(),
});

const defineRuntimeToolDescriptor = <TInput extends ZodTypeAny>(
  descriptor: RuntimeToolDescriptor<TInput>,
): RuntimeToolDescriptor<TInput> => descriptor;

export const runtimeToolDescriptors = [
  defineRuntimeToolDescriptor({
    namespace: "attention",
    name: "list",
    route: "/v1/attention/list",
    description: "List current attention contexts and active matches owned by this runtime.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      contexts: handlers.attentionList(),
      active: handlers.attentionActive(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "attention",
    name: "query",
    route: "/v1/attention/query",
    description: "Query attention items and commits using the runtime attention index.",
    inputSchema: attentionQuerySchema,
    examples: [
      { kind: "stdin", payload: { query: "homepage status", limit: 10 } },
      { kind: "argv", payload: { query: "homepage status", limit: 10 } },
    ],
    handler: async (input, handlers) => ({
      items: await handlers.attentionQuery(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "attention",
    name: "delivery-state",
    route: "/v1/attention/delivery-state",
    description: "Inspect delivery projections, attempts, and receipts without inferring acceptance from ai_call or read state.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      delivery: await handlers.attentionDeliveryState(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "attention",
    name: "delivery-timeline",
    route: "/v1/attention/delivery-timeline",
    description: "Query delivery attempts and receipts for one attention commit, cycle, or model call.",
    inputSchema: attentionDeliveryTimelineSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          contextId: "ctx-chat-main",
          commitId: "commit-123",
        },
      },
      {
        kind: "argv",
        payload: {
          cycleId: 42,
          limit: 20,
        },
      },
    ],
    handler: async (input, handlers) => ({
      delivery: await handlers.attentionDeliveryTimeline(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "attention",
    name: "commit",
    route: "/v1/attention/commit",
    description: "Persist an attention commit and optionally resolve the current context with done=true.",
    inputSchema: attentionCommitSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          contextId: "ctx-chat-main",
          summary: "Verified exact APP-URL and already replied in the room.",
          change: {
            type: "update",
            value: "APP-URL: http://127.0.0.1:4173/",
            format: "text/plain",
          },
          done: true,
        },
      },
      {
        kind: "argv",
        payload: {
          contextId: "ctx-chat-main",
          summary: "Work finished and user already notified.",
          done: true,
        },
      },
    ],
    handler: async (input, handlers) => ({
      commit: await handlers.attentionCommit({
        ...input,
        change: input.change ?? { type: "clean" },
      }),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "list",
    route: "/v1/message/list",
    description: "List message channels visible to this runtime.",
    inputSchema: messageListSchema,
    examples: [{ kind: "none" }, { kind: "argv", payload: { limit: 5 } }],
    handler: async (input, handlers) => ({
      channels: handlers.messageList({ includeArchived: input.includeArchived }).slice(
        0,
        input.limit ?? Number.POSITIVE_INFINITY,
      ),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "read",
    route: "/v1/message/read",
    description: "Read a room snapshot with optional limit, plus one-hop referencedItems for any visible reply refs.",
    inputSchema: messageReadSchema,
    examples: [
      { kind: "stdin", payload: { chatId: "room-1", limit: 10 } },
      { kind: "argv", payload: { chatId: "room-1", limit: 10 } },
    ],
    handler: async (input, handlers) => ({
      snapshot: handlers.messageRead(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "query",
    route: "/v1/message/query",
    description:
      "Search authorized room history with match, structured query, or guarded read-only SQL over the pre-authorized room scope.",
    inputSchema: messageQuerySchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          chatId: "*",
          mode: "query",
          query: "budget incident",
          limit: 10,
        },
      },
      {
        kind: "argv",
        payload: {
          chatId: "room-1",
          mode: "sql",
          query: "select chatId, count(*) as total from messages group by chatId order by total desc limit 5",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.messageQuery(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "send",
    route: "/v1/message/send",
    description:
      "Send a durable room message through the runtime message system. Use ref to reply to an earlier room message, optionally use followUpAfterMs for one-shot attention-only re-evaluation, then inspect recentMessages and follow up with message read/edit/recall when the visible outcome needs revision.",
    inputSchema: messageSendSchema,
    helpNotes: [
      "followUpAfterMs is optional etiquette support for long-running acknowledgements or unanswered follow-up questions.",
      "When followUpAfterMs expires, the runtime creates attention only if this message is still the latest visible room message.",
      "followUpAfterMs never auto-sends a room reply and does not become durable room metadata.",
    ],
    examples: [
      {
        kind: "stdin",
        payload: {
          chatId: "room-1",
          ref: 41,
          content: "我已经完成初版了。\n请直接打开我刚发给你的链接看看。",
          followUpAfterMs: 30000,
        },
        description:
          "If recentMessages suggest an accidental duplicate, use `message read` before `message edit` or `message recall` so the revision follows the actual conversation context. `followUpAfterMs` creates later attention only; it does not auto-send another room message.",
      },
      {
        kind: "argv",
        payload: {
          chatId: "room-1",
          content: "APP-ACK: 我先处理一下，稍后给你结果。",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.messageSend(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "edit",
    route: "/v1/message/edit",
    description: "Edit an existing durable room message by messageId when you need to correct your own prior reply.",
    inputSchema: messageEditSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          chatId: "room-1",
          messageId: 1,
          content: "更正：新的交付 URL 是 /preview/42。",
        },
      },
      {
        kind: "argv",
        payload: {
          chatId: "room-1",
          messageId: 1,
          content: "Correction: use /preview/42 instead.",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.messageEdit(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "message",
    name: "recall",
    route: "/v1/message/recall",
    description: "Recall an existing durable room message by messageId when the prior reply should no longer remain visible.",
    inputSchema: messageRecallSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          chatId: "room-1",
          messageId: 1,
        },
      },
      {
        kind: "argv",
        payload: {
          chatId: "room-1",
          messageId: 1,
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.messageRecall(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "workspace",
    name: "list",
    route: "/v1/workspace/list",
    description: "List mounted project workspaces currently available to this runtime.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      workspaces: handlers.workspaceList(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "workspace",
    name: "set-alias",
    route: "/v1/workspace/set-alias",
    description: "Rename one mounted project workspace by its runtime-local workspaceId.",
    inputSchema: workspaceSetAliasSchema,
    examples: [{ kind: "stdin", payload: { workspaceId: 1, alias: "frontend" } }],
    handler: async (input, handlers) => ({
      result: await handlers.workspaceSetAlias(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "list",
    route: "/v1/skill/list",
    description: "List runtime-visible skills from built-in and writable on-disk roots.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      skills: handlers.skillList(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "search",
    route: "/v1/skill/search",
    description: "Search runtime-visible skills by name, summary, or path.",
    inputSchema: skillSearchSchema,
    examples: [{ kind: "stdin", payload: { query: "terminal" } }, { kind: "argv", payload: { query: "message" } }],
    handler: async (input, handlers) => ({
      skills: handlers.skillSearch(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "info",
    route: "/v1/skill/info",
    description: "Read one runtime-visible skill and return its rendered content plus real filesystem path.",
    inputSchema: skillInfoSchema,
    examples: [
      { kind: "stdin", payload: { name: "agenter-runtime" } },
      { kind: "argv", payload: { name: "agenter-terminal" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.skillInfo(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "get-config",
    route: "/v1/skill/get-config",
    description: "Read one skill's watcher config, config path, and resolved watch targets without reading arbitrary sibling files.",
    inputSchema: skillGetConfigSchema,
    examples: [{ kind: "stdin", payload: { name: "agenter-runtime", rootKind: "builtin" } }],
    handler: async (input, handlers) => ({
      result: await handlers.skillGetConfig(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "upsert",
    route: "/v1/skill/upsert",
    description: "Create or replace one writable runtime skill under the selected writable root.",
    inputSchema: skillUpsertSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          name: "workspace-debug",
          rootKind: "avatar",
          content:
            "---\\nname: workspace-debug\\ndescription: Local runtime skill\\n---\\n\\n# workspace-debug\\n\\nKeep this short.\\n",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.skillUpsert(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "set-config",
    route: "/v1/skill/set-config",
    description:
      "Replace one skill's ccski.config.json so the runtime recalculates the watched-file topology without exposing arbitrary file writes.",
    inputSchema: skillSetConfigSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          name: "agenter-runtime",
          rootKind: "builtin",
          config: {
            files: ["references/*.md"],
          },
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.skillSetConfig(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "remove",
    route: "/v1/skill/remove",
    description: "Delete one writable runtime skill. Built-in catalog entries remain read-only.",
    inputSchema: skillRemoveSchema,
    examples: [{ kind: "stdin", payload: { name: "workspace-debug", rootKind: "avatar" } }],
    handler: async (input, handlers) => ({
      result: await handlers.skillRemove(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "skill",
    name: "refresh",
    route: "/v1/skill/refresh",
    description: "Refresh the canonical runtime skill snapshot from current on-disk truths.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      result: await handlers.skillRefresh(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "list",
    route: "/v1/terminal/list",
    description:
      "List terminals visible to this runtime, including lifecycle, observed identity, and stop facts.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      terminals: handlers.terminalList(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "create",
    route: "/v1/terminal/create",
    description: "Create or recover a runtime terminal. Prefer an explicit absolute cwd when continuity matters.",
    helpNotes: [
      "Public `terminal create` auto-bootstraps new terminals by default.",
      "If a create result still shows `lifecycleTransition = bootstrapping`, wait and reread `terminal list` instead of stacking a redundant second bootstrap.",
    ],
    inputSchema: terminalCreateSchema,
    examples: [
      { kind: "stdin", payload: { cwd: "/absolute/project/path", focus: true } },
      { kind: "argv", payload: { cwd: "/absolute/project/path", focus: true } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalCreate(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "get-config",
    route: "/v1/terminal/get-config",
    description: "Read one terminal's durable launch/config truth plus minimal lifecycle summary.",
    helpNotes: [
      "Use `terminal get-config` when you need the durable launch command, launch cwd, title, geometry, or metadata.",
      "`terminal get-config` does not replace `terminal list`; `terminal list` remains the lifecycle and observed-identity inspection surface.",
    ],
    inputSchema: terminalGetConfigSchema,
    examples: [{ kind: "stdin", payload: { terminalId: "term-1" } }],
    handler: async (input, handlers) => ({
      result: await handlers.terminalGetConfig(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "set-config",
    route: "/v1/terminal/set-config",
    description: "Patch one terminal's durable launch/config truth without recreating the terminal id.",
    helpNotes: [
      "If `lifecycleTransition` is `bootstrapping` or `killing`, wait and reread `terminal list` before sending another lifecycle or config mutation.",
      "Geometry fields such as `cols` and `rows` may apply to a running PTY immediately. Launch-affecting fields such as `command`, `launchCwd`, or `env` update durable truth and take effect on the next bootstrap.",
    ],
    inputSchema: terminalSetConfigSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          terminalId: "term-1",
          title: "Ops shell",
          launchCwd: "/repo/ops",
          command: ["/bin/bash", "-lc", "npm run dev"],
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalSetConfig(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "read",
    route: "/v1/terminal/read",
    description: "Read terminal output using auto, diff, or snapshot mode.",
    helpNotes: [
      "`terminal read` consumes this session actor's read cursor. Other actors keep their own cursor.",
      "`remark:false` performs non-consuming inspection and does not advance this actor's read cursor.",
      "`recordActivity:false` suppresses activity history; it is independent from cursor consumption.",
      "It does not bootstrap stopped terminals for you.",
      "If `terminal list` shows `processPhase` as `not_started` or `stopped`, run `terminal bootstrap` before expecting read/write to work.",
    ],
    inputSchema: terminalReadSchema,
    examples: [
      { kind: "stdin", payload: { terminalId: "term-1", mode: "auto" } },
      {
        kind: "stdin",
        payload: { terminalId: "term-1", mode: "auto", remark: false, recordActivity: false },
        description: "for non-consuming inspection without activity history",
      },
      { kind: "argv", payload: { terminalId: "term-1", mode: "auto" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalRead(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "await",
    route: "/v1/terminal/await",
    description:
      "Wait for bounded terminal evidence over stable clean snapshot lines, then return structured post-mortem evidence.",
    helpNotes: [
      "`terminal await` is for long-running bounded observation. Use `terminal read` only for immediate inspection.",
      "Matching is evaluated against stable clean snapshot lines from the terminal canvas, not raw ANSI or PTY bytes.",
      "Use command-level `wait.timeoutMs` so timeout returns post-mortem evidence. Shell-level timeout may cancel the command before JSON can be delivered.",
      "Set `recordActivity:false` for pure probes that should not append terminal activity.",
    ],
    inputSchema: terminalAwaitSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          terminalId: "term-1",
          wait: {
            until: "match",
            timeoutMs: 60_000,
            idleMs: 1_000,
          },
          match: {
            pattern: "ready|error|permission",
            regex: true,
            caseInsensitive: true,
            contextLines: 2,
          },
          view: {
            type: "tail",
            lines: 80,
          },
        },
      },
    ],
    handler: async (input, handlers, context) => ({
      result: await handlers.terminalAwait(input, context),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "write",
    route: "/v1/terminal/write",
    description:
      "Write literal raw input bytes into a terminal. Include your own newline or control characters explicitly, and use `terminal input` when you need mixed DSL actions.",
    helpNotes: [
      "A successful `terminal write` only confirms input delivery. Read the terminal again or inspect the resulting file/process state before assuming the command succeeded.",
      "`terminal write` is raw mode. If you need `<key .../>`, `<wait .../>`, or `<raw>...</raw>`, switch to `terminal input` instead of guessing.",
      "If the JSON fields or positional compact layout are still unclear after this help, run `skill info agenter-terminal` and expand only the reference file you need.",
      "For raw vs mixed strategy, open `references/input-modes.md` from that skill directory before sending a risky payload.",
    ],
    inputSchema: terminalWriteSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          terminalId: "term-1",
          text: "python3 -m http.server 4173 --bind 127.0.0.1\\r",
        },
      },
      {
        kind: "argv",
        payload: {
          terminalId: "term-1",
          text: "npm run dev\\r",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalWrite(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "input",
    route: "/v1/terminal/input",
    description:
      "Write mixed terminal input through the pending queue. Mixed mode supports `<key .../>`, `<wait .../>`, and `<raw>...</raw>` blocks.",
    helpNotes: [
      "A successful `terminal input` only confirms that the mixed payload was accepted and applied. Read the terminal or inspect resulting files before assuming the process state.",
      "`terminal input` is mixed mode. Use it when you need semantic key presses, waits, or literal `<...>` text wrapped in `<raw>...</raw>`.",
      "If you need a literal line such as `<key data=\"enter\"/>`, keep that line inside one `<raw>...</raw>` block. Ctrl combos use `ctrl=\"true\"`, for example `<key data=\"d\" ctrl=\"true\"/>` for EOF.",
      "If mixed syntax is unclear, run `skill info agenter-terminal` and read `references/input-modes.md` before guessing.",
    ],
    inputSchema: terminalInputSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          terminalId: "term-1",
          text: "<raw>npm run dev</raw><key data=\"enter\"/>",
        },
      },
      {
        kind: "argv",
        payload: {
          terminalId: "term-1",
          text: "<raw><key data=\"enter\"/>\ndone\n</raw><key data=\"d\" ctrl=\"true\"/>",
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalInput(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "focus",
    route: "/v1/terminal/focus",
    description: "Change the focused terminal set for this runtime.",
    inputSchema: terminalFocusSchema,
    examples: [
      { kind: "stdin", payload: { op: "replace", terminalIds: ["term-1"] } },
      { kind: "argv", payload: { op: "replace", terminalIds: ["term-1"] } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalFocus(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "bootstrap",
    route: "/v1/terminal/bootstrap",
    description: "Bootstrap a provisioned or stopped runtime terminal by id.",
    helpNotes: [
      "Use `terminal list` first when you need to inspect `processPhase`, `currentPath`, `currentTitle`, or prior stop facts.",
      "`terminal bootstrap` starts the PTY from durable launch truth. It is the explicit lifecycle edge for `not_started` and `stopped` terminals.",
      "If `lifecycleTransition` is already `bootstrapping` or `killing`, wait and reread `terminal list` instead of stacking another lifecycle mutation.",
    ],
    inputSchema: terminalLifecycleMutationSchema,
    examples: [
      { kind: "stdin", payload: { terminalId: "term-1" } },
      { kind: "argv", payload: { terminalId: "term-1" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalBootstrap(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "stop",
    route: "/v1/terminal/stop",
    description: "Stop a running runtime terminal PTY by id while preserving durable terminal identity.",
    helpNotes: [
      "`terminal stop` halts the PTY but does not delete the terminal catalog entry.",
      "After stop, use `terminal list` to inspect `processPhase` and stop facts. Use `terminal bootstrap` when you want to start that same terminal again.",
      "If `lifecycleTransition` is already `bootstrapping` or `killing`, wait and reread `terminal list` instead of stacking another lifecycle mutation.",
    ],
    inputSchema: terminalLifecycleMutationSchema,
    examples: [
      { kind: "stdin", payload: { terminalId: "term-1" } },
      { kind: "argv", payload: { terminalId: "term-1" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalStop(input),
    }),
  }),
] as const satisfies readonly RuntimeToolDescriptor[];

const runtimeDescriptorByKey = new Map<string, RuntimeToolDescriptor>(
  runtimeToolDescriptors.map((descriptor) => [`${descriptor.namespace}:${descriptor.name}`, descriptor]),
);

const runtimeDescriptorByRoute = new Map<string, RuntimeToolDescriptor>(
  runtimeToolDescriptors.map((descriptor) => [descriptor.route, descriptor]),
);

const runtimeCompactSurfaceByDescriptor = new WeakMap<RuntimeToolDescriptor, RuntimeToolCompactSurface>();

export const listRuntimeToolDescriptors = (namespace?: RuntimeToolNamespace): RuntimeToolDescriptor[] =>
  runtimeToolDescriptors.filter((descriptor) => namespace === undefined || descriptor.namespace === namespace);

export const getRuntimeToolDescriptor = (
  namespace: RuntimeToolNamespace,
  name: string,
): RuntimeToolDescriptor | null => runtimeDescriptorByKey.get(`${namespace}:${name}`) ?? null;

export const getRuntimeToolDescriptorByRoute = (route: string): RuntimeToolDescriptor | null =>
  runtimeDescriptorByRoute.get(route) ?? null;

const getRuntimeToolCompactSurface = (descriptor: RuntimeToolDescriptor): RuntimeToolCompactSurface => {
  const cached = runtimeCompactSurfaceByDescriptor.get(descriptor);
  if (cached) {
    return cached;
  }
  const surface = buildRuntimeToolCompactSurface(toJSONSchema(descriptor.inputSchema, { unrepresentable: "any" }));
  runtimeCompactSurfaceByDescriptor.set(descriptor, surface);
  return surface;
};

const isJsonText = (value: string, expectedStart: "{" | "["): boolean => value.trim().startsWith(expectedStart);

const containsNonLatin1CodePoint = (value: string): boolean => {
  for (const char of value) {
    if ((char.codePointAt(0) ?? 0) > 0xff) {
      return true;
    }
  }
  return false;
};

const jsonValueContainsNonLatin1Text = (value: unknown): boolean => {
  if (typeof value === "string") {
    return containsNonLatin1CodePoint(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => jsonValueContainsNonLatin1Text(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => jsonValueContainsNonLatin1Text(item));
  }
  return false;
};

const repairLikelyJustBashUtf8Mojibake = (value: string): string => {
  if (!/[^\u0000-\u007f]/u.test(value) || containsNonLatin1CodePoint(value)) {
    return value;
  }
  const repaired = Buffer.from(value, "latin1").toString("utf8");
  if (repaired === value || repaired.includes("\uFFFD")) {
    return value;
  }

  try {
    const parsedOriginal = JSON.parse(value) as unknown;
    const parsedRepaired = JSON.parse(repaired) as unknown;
    if (!jsonValueContainsNonLatin1Text(parsedOriginal) && jsonValueContainsNonLatin1Text(parsedRepaired)) {
      return repaired;
    }
  } catch {
    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return value;
    }
  }
  return value;
};

const parseJsonText = (value: string, commandLabel: string, inputMode: RuntimeToolCliInputMode): unknown => {
  const normalizedValue = repairLikelyJustBashUtf8Mojibake(value);
  const expectedStart = inputMode === "compact" ? "[" : "{";
  const expectedLabel = inputMode === "compact" ? "compact JSON array" : "JSON object";
  if (!isJsonText(normalizedValue, expectedStart)) {
    throw new Error(`${commandLabel} requires one ${expectedLabel} payload. Use \`${commandLabel} --help\` for details.`);
  }
  try {
    return JSON.parse(normalizedValue) as unknown;
  } catch (error) {
    throw new Error(
      `${commandLabel} received invalid JSON: ${error instanceof Error ? error.message : String(error)}. Use \`${commandLabel} --help\` for details.`,
    );
  }
};

export const parseRuntimeToolCliInput = <TInput extends ZodTypeAny>(
  descriptor: RuntimeToolDescriptor<TInput>,
  args: readonly string[],
  stdin: string,
  inputMode: RuntimeToolCliInputMode = "object",
): z.output<TInput> => {
  const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
  const trimmedStdin = stdin.trim();
  const payloadLabel = inputMode === "compact" ? "compact JSON array" : "JSON object payload";
  if (args.length > 1) {
    throw new Error(
      `${commandLabel} requires exactly one ${payloadLabel} source: either one argv JSON or JSON stdin. Use \`${commandLabel} --help\` for details.`,
    );
  }
  if (args.length === 1 && trimmedStdin.length > 0) {
    throw new Error(
      `${commandLabel} received both argv JSON and stdin JSON. Provide exactly one ${payloadLabel} source. Use \`${commandLabel} --help\` for details.`,
    );
  }
  if (args.length === 1) {
    const parsed = parseJsonText(args[0]!, commandLabel, inputMode);
    return descriptor.inputSchema.parse(
      inputMode === "compact" ? decodeRuntimeToolCompactPayload(getRuntimeToolCompactSurface(descriptor), parsed) : parsed,
    );
  }
  if (trimmedStdin.length > 0) {
    const parsed = parseJsonText(trimmedStdin, commandLabel, inputMode);
    return descriptor.inputSchema.parse(
      inputMode === "compact" ? decodeRuntimeToolCompactPayload(getRuntimeToolCompactSurface(descriptor), parsed) : parsed,
    );
  }
  return descriptor.inputSchema.parse(inputMode === "compact" ? decodeRuntimeToolCompactPayload(getRuntimeToolCompactSurface(descriptor), []) : {});
};

const renderExampleCommand = (descriptor: RuntimeToolDescriptor, example: RuntimeToolExample): string[] => {
  const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
  if (example.kind === "none") {
    return [`- \`${commandLabel}\`${example.description ? ` ${example.description}` : ""}`];
  }
  if (example.kind === "argv") {
    return [
      `- Single argv JSON fallback for trivial payloads: \`${commandLabel} '${JSON.stringify(example.payload)}'\`${example.description ? ` ${example.description}` : ""}`,
    ];
  }
  const payloadLines = JSON.stringify(example.payload, null, 2).split("\n").map((line) => `    ${line}`);
  return [
    `- Preferred default through \`root_bash\`${example.description ? ` ${example.description}` : ""}`,
    `  command: \`${commandLabel}\``,
    "  stdin:",
    ...payloadLines,
  ];
};

const renderCompactExampleCommand = (
  descriptor: RuntimeToolDescriptor,
  surface: RuntimeToolCompactSurface,
  examples: readonly RuntimeToolExample[],
): string[] => {
  const commandLabel = `${descriptor.namespace} ${descriptor.name}`;
  const compactExample = pickRuntimeToolCompactExamplePayload(
    surface,
    examples.flatMap((example) => (example.kind === "none" ? [] : [example.payload])),
  );
  if (compactExample === null) {
    return [];
  }
  return [
    `- Optional positional compact mode (${surface.availability}): \`${commandLabel} --compact '${JSON.stringify(compactExample)}'\``,
  ];
};

export const renderRuntimeToolHelp = (descriptor: RuntimeToolDescriptor): string => {
  const schema = toJSONSchema(descriptor.inputSchema, { unrepresentable: "any" });
  const compactSurface = getRuntimeToolCompactSurface(descriptor);
  const orderedExamples = [...descriptor.examples].sort(
    (left, right) => runtimeToolExampleRank[left.kind] - runtimeToolExampleRank[right.kind],
  );
  const lines = [
    `${descriptor.namespace} ${descriptor.name}`,
    "",
    `Description: ${descriptor.description}`,
    "",
    "Input JSON schema:",
    JSON.stringify(schema, null, 2),
    "",
    "Canonical forms:",
    ...orderedExamples.flatMap((example) => renderExampleCommand(descriptor, example)),
    ...renderCompactExampleCommand(descriptor, compactSurface, orderedExamples),
    "",
    "Compact positional mode:",
    `- Availability: ${compactSurface.availability}`,
    "- Use `--compact` to switch the payload from object JSON to a schema-derived positional JSON array.",
    "- Optional trailing fields may be omitted; skipped interior optional fields use `null`.",
    "- Field indexes:",
    ...renderRuntimeToolCompactFieldGuide(compactSurface).map((line) => `  ${line}`),
    ...(descriptor.helpNotes && descriptor.helpNotes.length > 0
      ? [
          "",
          "Operator notes:",
          ...descriptor.helpNotes.map((note) => `- ${note}`),
        ]
      : []),
    "",
    "Only canonical JSON input is accepted. Default to JSON stdin; use one JSON argv payload only when it is trivially short, and use `--compact` only when you intentionally want positional encoding.",
  ];
  return `${lines.join("\n")}\n`;
};

export const renderRuntimeNamespaceHelp = (namespace: RuntimeToolNamespace): string => {
  const descriptors = listRuntimeToolDescriptors(namespace);
  const lines = [
    `${namespace}`,
    "",
    "Available subcommands:",
    ...descriptors.map((descriptor) => `- ${descriptor.name}: ${descriptor.description}`),
    "",
    `Use \`${namespace} <subcommand> --help\` to inspect the JSON schema, compact layout, and canonical examples.`,
  ];
  return `${lines.join("\n")}\n`;
};

export const renderRuntimeToolExamples = (
  namespace: RuntimeToolNamespace,
  name: string,
): string[] => {
  const descriptor = getRuntimeToolDescriptor(namespace, name);
  if (!descriptor) {
    return [];
  }
  const orderedExamples = [...descriptor.examples].sort(
    (left, right) => runtimeToolExampleRank[left.kind] - runtimeToolExampleRank[right.kind],
  );
  return [
    ...orderedExamples.flatMap((example) => renderExampleCommand(descriptor, example)),
    ...renderCompactExampleCommand(descriptor, getRuntimeToolCompactSurface(descriptor), orderedExamples),
  ];
};
