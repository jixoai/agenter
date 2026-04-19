import type {
  AttentionCommit,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import type { TerminalProcessProfile } from "@agenter/terminal-system";
import { toJSONSchema, z, type ZodTypeAny } from "zod";

import type {
  RuntimeAttentionActiveView,
  RuntimeMessageChannelView,
  RuntimeMessageSendResult,
  RuntimeMessageSnapshotView,
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
  attentionQuery: (input: { query: string; offset?: number; limit?: number }) => Promise<unknown>;
  attentionCommit: (input: AttentionCommitToolInput & { done?: boolean }) => Promise<AttentionCommit>;
  messageList: (input: { includeArchived?: boolean }) => RuntimeMessageChannelView[];
  messageRead: (input: { chatId: string; limit?: number }) => RuntimeMessageSnapshotView;
  messageSend: (input: {
    chatId: string;
    content: string;
    rootId?: string;
    from?: string;
    originAckFallback?: string;
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
  terminalList: () => RuntimeTerminalView[];
  terminalCreate: (input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
  }) => Promise<{ ok: boolean; message: string; terminal?: RuntimeTerminalView }>;
  terminalRead: (input: {
    terminalId: string;
    mode?: "auto" | "diff" | "snapshot";
  }) => Promise<unknown>;
  terminalWrite: (input: {
    terminalId: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
  }) => Promise<{ ok: boolean; message: string }>;
  terminalFocus: (input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  terminalKill: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
}

export type RuntimeToolNamespace = "attention" | "message" | "workspace" | "terminal";

type RuntimeToolResult = Record<string, unknown>;

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
  inputSchema: TInput;
  examples: readonly RuntimeToolExample[];
  handler: (input: z.output<TInput>, handlers: RuntimeLocalApiHandlers) => Promise<RuntimeToolResult> | RuntimeToolResult;
}

export type RuntimeToolCliInputMode = "object" | "compact";

const emptyObjectSchema = z.object({}).strict();
const runtimeMessageIdSchema = z.number().int().positive();

const attentionQuerySchema = z.object({
  query: z.string(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(200).optional(),
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

const attentionCommitEgressSchema = z.object({
  kind: z.literal("message_reply"),
  chatId: z.string(),
  rootId: z.string().optional(),
  from: z.string().optional(),
});

const attentionCommitSchema = z
  .object({
    contextId: z.string(),
    parentCommitIds: z.array(z.string()).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    egress: attentionCommitEgressSchema.optional(),
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

const messageSendSchema = z.object({
  chatId: z.string(),
  content: z.string(),
  rootId: z.string().optional(),
  from: z.string().optional(),
  originAckFallback: z.string().optional(),
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

const terminalReadSchema = z.object({
  terminalId: z.string(),
  mode: z.enum(["auto", "diff", "snapshot"]).optional(),
});

const terminalWriteSchema = z.object({
  terminalId: z.string(),
  text: z.string(),
  submit: z.boolean().optional(),
  submitKey: z.enum(["enter", "linefeed"]).optional(),
});

const terminalFocusSchema = z.object({
  op: z.enum(["add", "remove", "replace", "clear"]),
  terminalIds: z.array(z.string()),
});

const terminalKillSchema = z.object({
  terminalId: z.string(),
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
    description: "Read a room snapshot with optional limit.",
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
    name: "send",
    route: "/v1/message/send",
    description: "Send a durable room message through the runtime message system.",
    inputSchema: messageSendSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          chatId: "room-1",
          content: "我已经完成初版了。\n请直接打开我刚发给你的链接看看。",
        },
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
    description: "List the real mounted workspaces and grants available to this runtime.",
    inputSchema: emptyObjectSchema,
    examples: [{ kind: "none" }],
    handler: async (_input, handlers) => ({
      workspaces: handlers.workspaceList(),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "list",
    route: "/v1/terminal/list",
    description: "List terminals currently visible to this runtime.",
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
    name: "read",
    route: "/v1/terminal/read",
    description: "Read terminal output using auto, diff, or snapshot mode.",
    inputSchema: terminalReadSchema,
    examples: [
      { kind: "stdin", payload: { terminalId: "term-1", mode: "auto" } },
      { kind: "argv", payload: { terminalId: "term-1", mode: "auto" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalRead(input),
    }),
  }),
  defineRuntimeToolDescriptor({
    namespace: "terminal",
    name: "write",
    route: "/v1/terminal/write",
    description: "Write text into a terminal and optionally submit it.",
    inputSchema: terminalWriteSchema,
    examples: [
      {
        kind: "stdin",
        payload: {
          terminalId: "term-1",
          text: "python3 -m http.server 4173 --bind 127.0.0.1",
          submit: true,
        },
      },
      {
        kind: "argv",
        payload: {
          terminalId: "term-1",
          text: "npm run dev",
          submit: true,
        },
      },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalWrite(input),
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
    name: "kill",
    route: "/v1/terminal/kill",
    description: "Kill a runtime terminal by id.",
    inputSchema: terminalKillSchema,
    examples: [
      { kind: "stdin", payload: { terminalId: "term-1" } },
      { kind: "argv", payload: { terminalId: "term-1" } },
    ],
    handler: async (input, handlers) => ({
      result: await handlers.terminalKill(input),
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
    `- Preferred default through \`root_workspace_bash\`${example.description ? ` ${example.description}` : ""}`,
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
