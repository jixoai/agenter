import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import { DEFAULT_LOOP_COMPACT_POLICY, type ResolvedLoopCompactPolicy } from "@agenter/settings";
import type { SessionTerminalOutcome } from "@agenter/session-system";
import type { ContentPart, Tool } from "@tanstack/ai";
import { z } from "zod";

import type { AttentionSearchRequest } from "./attention-search";
import type { ChatCycleCompactTrigger } from "./chat-cycles";
import type { LoopBusInput, LoopBusMessage } from "./loop-bus";
import type {
  AssistantDeliveryEvent,
  AssistantStreamUpdate,
  ConsumeCommittedAttentionMessagesInput,
  ModelClient,
  TextOnlyModelMessage,
} from "./model-client";
import { ModelDecisionError } from "./model-client";
import type { PromptStore } from "./prompt-store";
import { createRuntimeText } from "./runtime-text";
import { mapAbortReasonToOutcome, toTerminalOutcomeFromError } from "./runtime-trace";
import type { AppServerLogger, ChatSessionAsset } from "./types";

interface AttentionGateway {
  listContexts: () => AttentionContextDescriptor[];
  listActive: () => AttentionActiveContextMatch[];
  query: (input: AttentionSearchRequest) => Promise<AttentionCommitMatch[]> | AttentionCommitMatch[];
  commit: (input: AttentionCommitToolInput) => Promise<AttentionCommit> | AttentionCommit;
}

export interface AgentToolTraceEntry {
  invocationId: string;
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

export interface AgentToolProviderContext {
  readonly runtimeText: ReturnType<typeof createRuntimeText>;
  readonly signal?: AbortSignal;
  traceTool: <TInput, TOutput>(
    toolName: string,
    input: TInput,
    handler: () => Promise<TOutput>,
    options?: {
      invocationId?: string;
    },
  ) => Promise<TOutput>;
}

export interface AgentToolProvider {
  readonly name: string;
  createTools: (context: AgentToolProviderContext) => Tool[];
}

interface ResolvedImageAttachmentSource {
  mimeType: string;
  dataBase64: string;
}

export interface AgentPromptWindowStateRecord {
  id: string;
  createdAt: number;
  roundIndex: number;
  messages: TextOnlyModelMessage[];
}

export interface AgentPromptWindowStore {
  append: (input: {
    createdAt?: number;
    messages: TextOnlyModelMessage[];
    setCurrent?: boolean;
  }) => Promise<AgentPromptWindowStateRecord> | AgentPromptWindowStateRecord;
}

interface AgentDeps {
  modelClient: ModelClient;
  modelCallTimeoutMs?: number;
  logger: AppServerLogger;
  promptStore: PromptStore;
  compactPolicy?: ResolvedLoopCompactPolicy;
  promptWindowStore?: AgentPromptWindowStore;
  initialPromptWindowState?: AgentPromptWindowStateRecord;
  avatarName?: string;
  locale?: string;
  attentionGateway: AttentionGateway;
  toolProviders?: AgentToolProvider[];
  resolveImageAttachment?: (
    attachment: ChatSessionAsset,
  ) => Promise<ResolvedImageAttachmentSource | null> | ResolvedImageAttachmentSource | null;
  onCanCommitAttentionItems?: (context: CanCommitAttentionItemsContext) => Promise<void> | void;
  commitAttentionItems?: () => Promise<LoopBusInput[] | undefined> | LoopBusInput[] | undefined;
  onAssistantStream?: (update: AssistantStreamUpdate) => Promise<void> | void;
  onAssistantDelivery?: (event: AssistantDeliveryEvent) => Promise<void> | void;
  onModelCall?: (record: AgentModelCallRecord) => Promise<void> | void;
}

export interface CanCommitAttentionItemsContext {
  reason: "tool-result-boundary";
  commitAttentionItems: () => Promise<LoopBusInput[] | undefined>;
}

export interface AgentModelCallRecord {
  id: string;
  timestamp: number;
  status: "running" | "done" | "error" | "cancelled";
  completedAt?: number;
  provider: string;
  model: string;
  request: {
    systemPrompt: string;
    promptWindowStateId: string;
    roundIndex: number;
    messages: TextOnlyModelMessage[];
    tools: Array<{ name: string; description?: string }>;
    meta?: Record<string, unknown>;
  };
  response?: {
    decision?: unknown;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    assistant?: {
      thinking?: string;
      text?: string;
      finishReason?: string | null;
    };
    toolTrace?: Array<{
      invocationId: string;
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      startedAt: number;
      finishedAt: number;
    }>;
  };
  error?: {
    message: string;
    name?: string;
    stack?: string;
    details?: unknown;
  };
  outcome?: SessionTerminalOutcome;
}

interface AttentionUpdateCall {
  contextId: string;
  commitId: string;
  text: string;
  scores: Record<string, number>;
  done: boolean;
}

export interface AgentPromptWindowCompactSummary {
  overview: string;
  decisions: string[];
  keyFiles: string[];
  keyFacts: string[];
  unresolvedWork: string[];
  nextSteps: string[];
  raw: string;
}

export interface AgentPromptWindowSnapshot {
  promptWindow: TextOnlyModelMessage[];
  stats: AgentRuntimeStats;
}

export interface AgentRuntimeStats {
  loops: number;
  apiCalls: number;
  lastContextChars: number;
  totalContextChars: number;
  lastPromptTokens?: number;
  totalPromptTokens?: number;
}

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MAX_HISTORY_MESSAGES = 80;
const ENABLE_AGENT_TOOLS = true;
const DEFAULT_MODEL_CALL_TIMEOUT_MS = 240_000;
const MAX_EXTERNAL_MODEL_ROUNDS = 12;
const DEFAULT_AVATAR_PROMPT_NAME = "agenter-ai";
const EMERGENCY_COMPACT_RECENT_SNIPPET_LIMIT = 6;
const EMERGENCY_COMPACT_SNIPPET_CHARS = 240;
const COMPACT_KEY_FILE_PATTERN = /\b[a-zA-Z0-9_./-]+\.(?:[a-zA-Z0-9]{1,8})\b/gu;
const COMPACT_ACK_PATTERNS = [
  /^understood\b/i,
  /^got it\b/i,
  /^收到\b/u,
  /^明白\b/u,
  /^我会处理/u,
  /^我来处理/u,
] as const;
const CONTEXT_OVERFLOW_MARKERS = [
  "context length",
  "context window",
  "context_limit",
  "context-length",
  "context_length",
  "prompt too long",
  "prompt is too long",
  "maximum context",
  "too many tokens",
  "token limit",
  "context_length_exceeded",
];
const TRANSIENT_ATTENTION_PROTOCOL_KINDS = new Set(["context", "items"]);

// Attention protocol messages are per-call cognitive inputs. They must be
// recorded in ai_call.request.messages, but they are not bounded prompt memory.
const isTransientAttentionProtocolMessage = (message: LoopBusMessage): boolean =>
  message.source === "attention" &&
  typeof message.meta?.attentionProtocolKind === "string" &&
  TRANSIENT_ATTENTION_PROTOCOL_KINDS.has(message.meta.attentionProtocolKind);

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" || error.message === "This operation was aborted"
      : false;

const createAbortError = (reason?: unknown): DOMException =>
  new DOMException(
    typeof reason === "string" && reason.length > 0 ? reason : "This operation was aborted",
    "AbortError",
  );

const isLikelyContextOverflowError = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return CONTEXT_OVERFLOW_MARKERS.some((marker) => normalized.includes(marker));
};

const formatTimestamp = (value: number): string => new Date(value).toISOString();

const toTextPart = (content: string): ContentPart => ({
  type: "text",
  content,
});

const contentPartToText = (part: ContentPart): string => {
  if (part.type === "text") {
    return part.content;
  }
  if (part.type === "image") {
    return "[image]";
  }
  if (part.type === "audio") {
    return "[audio]";
  }
  if (part.type === "video") {
    return "[video]";
  }
  return "[document]";
};

const historyContentToText = (content: TextOnlyModelMessage["content"]): string => {
  if (content === null || content === undefined) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content.map((part) => contentPartToText(part)).join("\n");
};

const detectTextFenceLanguage = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return "text";
  }
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    return "text";
  }
};

const yamlScalar = (input: unknown): string => {
  if (input === null || input === undefined) {
    return "null";
  }
  if (typeof input === "boolean" || typeof input === "number") {
    return String(input);
  }
  const text = String(input);
  if (/^[a-zA-Z0-9._/-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
};

const toYaml = (value: unknown, indent = 0): string => {
  const padding = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${padding}[]`;
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          return `${padding}-\n${toYaml(item, indent + 2)}`;
        }
        return `${padding}- ${yamlScalar(item)}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return `${padding}{}`;
    }
    return entries
      .map(([key, child]) => {
        if (child !== null && typeof child === "object") {
          return `${padding}${key}:\n${toYaml(child, indent + 2)}`;
        }
        return `${padding}${key}: ${yamlScalar(child)}`;
      })
      .join("\n");
  }
  return `${padding}${yamlScalar(value)}`;
};

const mdFence = (lang: string, content: string): string => {
  const normalized = content.replace(/\u0000/g, "");
  return `\`\`\`${lang}\n${normalized}\n\`\`\``;
};

const buildToolInvocationContent = (trace: AgentToolTraceEntry): string =>
  mdFence(
    "yaml",
    toYaml({
      invocationId: trace.invocationId,
      tool: trace.tool,
      status: trace.error ? "failed" : "success",
      startedAt: new Date(trace.startedAt).toISOString(),
      finishedAt: new Date(trace.finishedAt).toISOString(),
      input: trace.input,
      output: trace.output ?? null,
      error: trace.error ?? null,
    }),
  );

const roundHasAttentionInput = (messages: readonly LoopBusMessage[]): boolean =>
  messages.some((message) => message.source === "attention");

const extractAttentionContextIds = (messages: readonly LoopBusMessage[]): string[] => {
  const contextIds = new Set<string>();
  for (const message of messages) {
    if (message.source !== "attention") {
      continue;
    }
    const contextId = message.meta?.attentionContextId;
    if (typeof contextId !== "string") {
      continue;
    }
    const normalized = contextId.trim();
    if (normalized.length === 0) {
      continue;
    }
    contextIds.add(normalized);
  }
  return [...contextIds];
};

const normalizeLoopInputs = (inputs: readonly LoopBusInput[] | undefined): LoopBusMessage[] =>
  (inputs ?? []).map((input) => ({
    id: input.id ?? createId(),
    timestamp: input.timestamp ?? Date.now(),
    name: input.name,
    role: input.role,
    type: input.type,
    source: input.source,
    text: input.text,
    meta: input.meta,
    attachments: input.attachments?.map((attachment) => ({ ...attachment })),
  }));

const COMPACT_SUMMARY_SCHEMA = z.object({
  overview: z.string().default(""),
  decisions: z.array(z.string()).default([]),
  keyFiles: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  unresolvedWork: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});

const isPromptWindowToolTraceEntry = (content: string): boolean =>
  content.includes("invocationId:") && content.includes("tool:") && content.includes("status:");

const parseYamlScalarText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "null") {
    return "";
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : trimmed;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const stripMarkdownFence = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  const firstNewlineIndex = trimmed.indexOf("\n");
  if (firstNewlineIndex === -1) {
    return trimmed;
  }
  const withoutStartFence = trimmed.slice(firstNewlineIndex + 1);
  return withoutStartFence.endsWith("\n```") ? withoutStartFence.slice(0, -4) : withoutStartFence;
};

const extractYamlTopLevelScalar = (content: string, key: string): string | null => {
  const body = stripMarkdownFence(content);
  for (const line of body.split("\n")) {
    if (line.startsWith(" ") || !line.startsWith(`${key}:`)) {
      continue;
    }
    return parseYamlScalarText(line.slice(key.length + 1));
  }
  return null;
};

const extractYamlNestedScalar = (content: string, section: string, key: string): string | null => {
  const body = stripMarkdownFence(content);
  let inSection = false;
  for (const line of body.split("\n")) {
    if (!inSection) {
      if (line === `${section}:`) {
        inSection = true;
      }
      continue;
    }
    if (!line.startsWith("  ")) {
      break;
    }
    const nested = line.slice(2);
    if (!nested.startsWith(`${key}:`)) {
      continue;
    }
    return parseYamlScalarText(nested.slice(key.length + 1));
  }
  return null;
};

const normalizeCompactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const isPromptWindowCommandText = (value: string): boolean => value.startsWith("/");

const isLikelyQuestionText = (value: string): boolean => /[?？]\s*$/u.test(value.trim());

const joinPromptSections = (sections: readonly string[]): string =>
  sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n---\n\n");

const pushUniqueCompactText = (target: string[], value: string): void => {
  const normalized = normalizeCompactText(value);
  if (normalized.length === 0 || isPromptWindowCommandText(normalized) || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
};

const COMPACT_SETTLED_ANSWER_PREFIX = "Settled user-visible answer:";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const tryParseJsonEnvelope = <T>(value: string, open: "[" | "{", close: "]" | "}"): T | null => {
  const start = value.indexOf(open);
  const end = value.lastIndexOf(close);
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(value.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
};

const parseMessageSendContentFromCommand = (command: string): string | null => {
  const normalized = normalizeCompactText(command);
  if (!normalized.startsWith("message send") || normalized.includes("--help")) {
    return null;
  }
  if (normalized.includes("--compact")) {
    const compactPayload = tryParseJsonEnvelope<unknown[]>(command, "[", "]");
    return Array.isArray(compactPayload) && typeof compactPayload[1] === "string" ? compactPayload[1] : null;
  }
  const objectPayload = tryParseJsonEnvelope<Record<string, unknown>>(command, "{", "}");
  return objectPayload && typeof objectPayload.content === "string" ? objectPayload.content : null;
};

const extractMessageSendContentFromToolTrace = (content: string): string | null => {
  if (!isPromptWindowToolTraceEntry(content)) {
    return null;
  }
  const toolName = extractYamlTopLevelScalar(content, "tool");
  if (toolName !== "root_bash") {
    return null;
  }
  const command = extractYamlNestedScalar(content, "input", "command");
  if (!command) {
    return null;
  }
  const stdin = extractYamlNestedScalar(content, "input", "stdin");
  if (stdin) {
    try {
      const parsed = JSON.parse(stdin) as Record<string, unknown>;
      if (typeof parsed.content === "string") {
        return parsed.content;
      }
    } catch {
      // Fall back to parsing argv/compact payload from the shell command text.
    }
  }
  return parseMessageSendContentFromCommand(command);
};

const extractSettledAnswerFromToolTrace = (content: string): string | null => {
  const deliveredContent = extractMessageSendContentFromToolTrace(content);
  if (!deliveredContent) {
    return null;
  }
  if (extractYamlTopLevelScalar(content, "status") !== "success") {
    return null;
  }
  const normalized = normalizeCompactText(deliveredContent);
  if (normalized.length === 0 || isLikelyQuestionText(normalized)) {
    return null;
  }
  return normalized;
};

const extractSettledAnswersFromCompactSummary = (summary: AgentPromptWindowCompactSummary | null): string[] => {
  if (!summary) {
    return [];
  }
  const answers: string[] = [];
  for (const fact of summary.keyFacts) {
    if (!fact.startsWith(COMPACT_SETTLED_ANSWER_PREFIX)) {
      continue;
    }
    const answer = fact.slice(COMPACT_SETTLED_ANSWER_PREFIX.length).trim();
    pushUniqueCompactText(answers, answer);
  }
  return answers;
};

const parseAttentionCommitInputFromCommand = (command: string): Record<string, unknown> | null => {
  const normalized = normalizeCompactText(command);
  if (!normalized.startsWith("attention commit") || normalized.includes("--help")) {
    return null;
  }
  const payload = tryParseJsonEnvelope<unknown>(command, "{", "}");
  return isRecord(payload) ? payload : null;
};

const extractAttentionCommitInputFromToolTrace = (trace: AgentToolTraceEntry): Record<string, unknown> | null => {
  if (trace.tool !== "root_bash" || !isRecord(trace.input)) {
    return null;
  }
  const stdin = trace.input.stdin;
  if (typeof stdin === "string" && stdin.trim().length > 0) {
    try {
      const parsed = JSON.parse(stdin) as unknown;
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      // Fall back to argv JSON parsing when stdin is not valid JSON.
    }
  }
  const command = trace.input.command;
  return typeof command === "string" ? parseAttentionCommitInputFromCommand(command) : null;
};

const extractAttentionCommitOutput = (trace: AgentToolTraceEntry): Record<string, unknown> | null => {
  if (trace.tool !== "root_bash" || !isRecord(trace.output)) {
    return null;
  }
  const stdout = trace.output.stdout;
  if (typeof stdout !== "string" || stdout.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(stdout) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractAttentionUpdateFromToolTrace = (trace: AgentToolTraceEntry): AttentionUpdateCall | null => {
  if (trace.error) {
    return null;
  }
  const input = extractAttentionCommitInputFromToolTrace(trace);
  const output = extractAttentionCommitOutput(trace);
  if (!input) {
    return null;
  }
  const contextId = input.contextId;
  const outputCommit = output && isRecord(output.commit) ? output.commit : null;
  const commitId =
    typeof outputCommit?.commitId === "string"
      ? outputCommit.commitId
      : typeof output?.commitId === "string"
        ? output.commitId
        : null;
  if (typeof contextId !== "string" || contextId.trim().length === 0) {
    return null;
  }
  if (typeof commitId !== "string" || commitId.trim().length === 0) {
    return null;
  }
  const summary =
    typeof input.summary === "string" ? input.summary : typeof outputCommit?.summary === "string" ? outputCommit.summary : "";
  const scores =
    isRecord(input.scores) ? input.scores : isRecord(outputCommit?.scores) ? outputCommit.scores : undefined;
  return {
    contextId,
    commitId,
    text: summary,
    scores: isRecord(scores)
      ? Object.fromEntries(Object.entries(scores).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
      : {},
    done: input.done === true,
  };
};

const pushUniqueCompactFile = (target: string[], value: string): void => {
  const normalized = value.trim();
  if (normalized.length === 0 || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
};

type ExecutableTool = Tool & {
  execute?: (
    input: unknown,
    context?: { toolCallId: string; emitCustomEvent: (event: unknown) => void },
  ) => Promise<unknown>;
};

const hasMeaningfulToolInput = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
};

const stringifyToolArgs = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const extractJsonObjectText = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return trimmed.slice(first, last + 1);
};

const parseCompactSummary = (value: string): AgentPromptWindowCompactSummary => {
  const jsonText = extractJsonObjectText(value);
  if (jsonText) {
    try {
      const parsed = COMPACT_SUMMARY_SCHEMA.parse(JSON.parse(jsonText));
      return {
        ...parsed,
        raw: value.trim(),
      };
    } catch {
      // Fall through to a best-effort structured fallback.
    }
  }
  return {
    overview: value.trim(),
    decisions: [],
    keyFiles: [],
    keyFacts: [],
    unresolvedWork: [],
    nextSteps: [],
    raw: value.trim(),
  };
};

export class AgenterAI {
  private pendingCompactTrigger: ChatCycleCompactTrigger | null = null;
  private statsListeners: Array<(stats: AgentRuntimeStats) => void> = [];
  private promptWindow: TextOnlyModelMessage[] = [];
  private promptWindowStateId: string | null = null;
  private promptWindowRoundIndex = 0;
  private nextEphemeralPromptWindowStateId = 1;
  private lastCompactSummary: AgentPromptWindowCompactSummary | null = null;
  private stats: AgentRuntimeStats = {
    loops: 0,
    apiCalls: 0,
    lastContextChars: 0,
    totalContextChars: 0,
  };
  private readonly runtimeText: ReturnType<typeof createRuntimeText>;
  private modelClient: ModelClient;
  private promptStore: PromptStore;

  constructor(private readonly deps: AgentDeps) {
    this.runtimeText = createRuntimeText(this.deps.locale);
    this.modelClient = this.deps.modelClient;
    this.promptStore = this.deps.promptStore;
    const initialPromptWindowState = this.deps.initialPromptWindowState;
    if (initialPromptWindowState) {
      this.promptWindow = structuredClone(initialPromptWindowState.messages);
      this.promptWindowStateId = initialPromptWindowState.id;
      this.promptWindowRoundIndex = initialPromptWindowState.roundIndex;
      const ephemeralMatch = initialPromptWindowState.id.match(/^ephemeral-(\d+)$/);
      this.nextEphemeralPromptWindowStateId = ephemeralMatch ? Number(ephemeralMatch[1]) + 1 : 1;
    }
  }

  setModelClient(modelClient: ModelClient): void {
    this.modelClient = modelClient;
  }

  setPromptStore(promptStore: PromptStore): void {
    this.promptStore = promptStore;
  }

  private getCompactPolicy(): ResolvedLoopCompactPolicy {
    return this.deps.compactPolicy ?? DEFAULT_LOOP_COMPACT_POLICY;
  }

  private shouldQueueRecoveryCompact(
    trigger: Extract<
      ChatCycleCompactTrigger,
      "attention_retry" | "context_overflow" | "external_continuation_limit" | "timeout"
    >,
  ): boolean {
    const policy = this.getCompactPolicy();
    switch (trigger) {
      case "attention_retry":
        return policy.recovery.attentionRetry;
      case "context_overflow":
        return policy.recovery.contextOverflow;
      case "external_continuation_limit":
        return policy.recovery.externalContinuationLimit;
      case "timeout":
        return policy.recovery.timeout;
    }
  }

  private queueCompactRequest(trigger: ChatCycleCompactTrigger): void {
    this.pendingCompactTrigger = trigger;
  }

  consumePendingCompactRequest(): ChatCycleCompactTrigger | null {
    const trigger = this.pendingCompactTrigger;
    this.pendingCompactTrigger = null;
    return trigger;
  }

  private async withModelCallTimeout<T>(input: {
    signal?: AbortSignal;
    run: (abortController: AbortController) => Promise<T>;
  }): Promise<T> {
    const abortController = new AbortController();
    const timeoutMs = this.deps.modelCallTimeoutMs ?? DEFAULT_MODEL_CALL_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const externalSignal = input.signal;
    const abortFromExternal = () => {
      abortController.abort(externalSignal?.reason ?? "session.stop");
    };

    try {
      if (externalSignal) {
        if (externalSignal.aborted) {
          abortFromExternal();
        } else {
          externalSignal.addEventListener("abort", abortFromExternal, { once: true });
        }
      }
      return await new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          abortController.abort();
          reject(new Error(`model call timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        void input.run(abortController).then(resolve, reject);
      });
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }

  requestCompact(reason = "manual"): void {
    this.queueCompactRequest("manual");
    this.deps.logger.log({
      channel: "agent",
      level: "info",
      message: "prompt_window.compact.requested",
      meta: {
        reason,
      },
    });
  }

  private buildCompactSystemPrompt(): string {
    return [
      "You are rewriting a bounded model prompt window for an attention-first runtime.",
      "Do not return prose outside the required JSON object.",
      "Summarize prior prompt-window evidence without preserving tool-call transcripts.",
      "Prioritize settled user-visible outcomes and verified external facts over raw attention metadata, score snapshots, or lifecycle bookkeeping.",
      "Focus on stable decisions, key files, key facts, unresolved work, and next steps.",
      "Preserve durable outcomes as facts, not as replay-only relay text caches.",
      "For resolved external questions, preserve the settled answer and enough context so a later follow-up can answer directly without reopening finished relay or lookup work.",
      "When a follow-up should directly reuse an already settled outcome, state that explicitly in decisions and nextSteps instead of leaving it implicit.",
      'Example decision format: "When chat-main asks the same lunch follow-up again, answer directly that gaubee said egg fried rice; do not relay again."',
      'Example next step format for resolved work: "Answer the same follow-up directly from compact memory; no new relay is needed."',
      "Return strict JSON with keys:",
      "- overview: string",
      "- decisions: string[]",
      "- keyFiles: string[]",
      "- keyFacts: string[]",
      "- unresolvedWork: string[]",
      "- nextSteps: string[]",
    ].join("\n");
  }

  async runCompactCycle(input: { trigger: ChatCycleCompactTrigger; signal?: AbortSignal }): Promise<void> {
    const requestTimestamp = Date.now();
    const requestId = createId();
    await this.ensureCurrentPromptWindowStateId();
    const compactInput = this.buildCompactInput();
    const requestMessages = [
      {
        role: "user",
        content: [toTextPart(compactInput)],
      } satisfies TextOnlyModelMessage,
    ];
    const requestPromptWindowState = await this.appendPromptWindowState({
      createdAt: requestTimestamp,
      messages: requestMessages,
      setCurrent: false,
    });
    const requestRecord = {
      systemPrompt: this.buildCompactSystemPrompt(),
      promptWindowStateId: requestPromptWindowState.id,
      roundIndex: requestPromptWindowState.roundIndex,
      messages: structuredClone(requestMessages),
      tools: [],
      meta: {
        compactCycle: true,
        compactTrigger: input.trigger,
        promptWindowSize: this.promptWindow.length,
      },
    } satisfies AgentModelCallRecord["request"];
    const modelClient = this.modelClient;

    await this.persistModelCall({
      id: requestId,
      timestamp: requestTimestamp,
      status: "running",
      provider: modelClient.getMeta().provider,
      model: modelClient.getMeta().model,
      request: requestRecord,
    });

    try {
      const response = await this.withModelCallTimeout({
        signal: input.signal,
        run: (abortController) =>
          modelClient.respondWithMeta({
            systemPrompt: requestRecord.systemPrompt,
            messages: requestMessages,
            tools: [],
            abortController,
          }),
      });
      const parsedSummary = parseCompactSummary(response.text);
      const summary = this.enrichCompactSummaryWithSettledFacts({
        ...parsedSummary,
      } satisfies AgentPromptWindowCompactSummary);
      this.lastCompactSummary = summary;
      const nextPromptWindowState = await this.commitCurrentPromptWindow(
        this.buildPromptWindowFromCompact(summary),
        Date.now(),
      );
      await this.persistModelCall({
        id: requestId,
        timestamp: requestTimestamp,
        completedAt: Date.now(),
        status: "done",
        provider: modelClient.getMeta().provider,
        model: modelClient.getMeta().model,
        request: requestRecord,
        outcome: { code: "done" },
        response: {
          decision: {
            kind: "compact",
            trigger: input.trigger,
            promptWindowSize: nextPromptWindowState.messages.length,
            nextPromptWindowStateId: nextPromptWindowState.id,
            summary,
          },
          assistant: {
            thinking: response.thinking,
            text: response.text,
            finishReason: response.finishReason ?? null,
          },
          usage: response.usage,
        },
      });
      this.deps.logger.log({
        channel: "agent",
        level: summary.raw.length > 0 ? "info" : "warn",
        message: summary.raw.length > 0 ? "prompt_window.compact.done" : "prompt_window.compact.skipped",
        meta: {
          chars: summary.raw.length,
          trigger: input.trigger,
          ...(summary.raw.length === 0 ? { reason: "empty-summary" } : {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "Error";
      const stack = error instanceof Error ? error.stack : undefined;
      await this.persistModelCall({
        id: requestId,
        timestamp: requestTimestamp,
        completedAt: Date.now(),
        status: "error",
        provider: modelClient.getMeta().provider,
        model: modelClient.getMeta().model,
        request: requestRecord,
        outcome: toTerminalOutcomeFromError(error),
        error: { message, name, stack },
      });
      this.deps.logger.log({
        channel: "error",
        level: "error",
        message: `agenter-ai compact failed: ${message}`,
      });
      if (isAbortError(error)) {
        throw error;
      }
      try {
        await this.applyEmergencyCompactFallback(message);
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        this.deps.logger.log({
          channel: "error",
          level: "error",
          message: `agenter-ai emergency compact failed: ${fallbackMessage}`,
        });
      }
    }
  }

  onStats(listener: (stats: AgentRuntimeStats) => void): () => void {
    this.statsListeners.push(listener);
    listener(this.stats);
    return () => {
      this.statsListeners = this.statsListeners.filter((it) => it !== listener);
    };
  }

  inspectDebugState(): AgentPromptWindowSnapshot {
    return {
      promptWindow: structuredClone(this.promptWindow),
      stats: { ...this.stats },
    };
  }

  private async appendPromptWindowState(input: {
    createdAt?: number;
    messages: TextOnlyModelMessage[];
    setCurrent?: boolean;
  }): Promise<AgentPromptWindowStateRecord> {
    const createdAt = input.createdAt ?? Date.now();
    const messages = structuredClone(input.messages);
    if (!this.deps.promptWindowStore) {
      return {
        id: `ephemeral-${this.nextEphemeralPromptWindowStateId++}`,
        createdAt,
        roundIndex: this.promptWindowRoundIndex,
        messages,
      };
    }
    const record = await this.deps.promptWindowStore.append({
      createdAt,
      messages,
      setCurrent: input.setCurrent,
    });
    return {
      id: record.id,
      createdAt: record.createdAt,
      roundIndex: record.roundIndex,
      messages: structuredClone(record.messages),
    };
  }

  private async commitCurrentPromptWindow(
    messages: readonly TextOnlyModelMessage[],
    createdAt?: number,
  ): Promise<AgentPromptWindowStateRecord> {
    const record = await this.appendPromptWindowState({
      createdAt,
      messages: this.trimPromptWindow([...messages]),
      setCurrent: true,
    });
    this.promptWindow = structuredClone(record.messages);
    this.promptWindowStateId = record.id;
    this.promptWindowRoundIndex = record.roundIndex;
    return record;
  }

  private async ensureCurrentPromptWindowStateId(): Promise<string> {
    if (this.promptWindowStateId !== null) {
      return this.promptWindowStateId;
    }
    const record = await this.commitCurrentPromptWindow(this.promptWindow);
    return record.id;
  }

  private getExecutableTool(tools: readonly Tool[], name: string): ExecutableTool | null {
    const tool = tools.find((entry) => entry.name === name);
    if (!tool || typeof (tool as ExecutableTool).execute !== "function") {
      return null;
    }
    return tool as ExecutableTool;
  }

  async send(messages: LoopBusMessage[], context?: { signal?: AbortSignal }): Promise<void> {
    const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    if (orderedMessages.length === 0) {
      return;
    }
    this.stats.loops += 1;
    let roundMessages = orderedMessages;
    await this.pushIncomingBatchToPromptWindow(roundMessages);
    let externalRoundCount = 0;

    while (true) {
      const result = await this.runModelRound(roundMessages, context);
      if (!result.continueModelRound) {
        return;
      }
      externalRoundCount += 1;
      if (externalRoundCount >= MAX_EXTERNAL_MODEL_ROUNDS) {
        this.deps.logger.log({
          channel: "error",
          level: "error",
          message: `agenter-ai exceeded ${MAX_EXTERNAL_MODEL_ROUNDS} external continuation rounds`,
        });
        if (this.shouldQueueRecoveryCompact("external_continuation_limit")) {
          this.queueCompactRequest("external_continuation_limit");
        }
        return;
      }
      roundMessages = result.interleavedMessages;
      if (roundMessages.length > 0) {
        await this.pushIncomingBatchToPromptWindow(roundMessages);
      }
    }
  }

  private async persistModelCall(record: AgentModelCallRecord): Promise<void> {
    await this.deps.onModelCall?.(record);
  }

  private shouldContinueAfterToolPhase(input: {
    attentionUpdates: readonly AttentionUpdateCall[];
    finishReason: string | null | undefined;
    roundMessages: readonly LoopBusMessage[];
    interleavedMessages: readonly LoopBusMessage[];
    unprojectedInterleavedMessageCount?: number;
  }): boolean {
    if ((input.unprojectedInterleavedMessageCount ?? input.interleavedMessages.length) > 0) {
      return true;
    }
    if (input.finishReason !== "tool_calls") {
      return false;
    }
    if (!roundHasAttentionInput(input.roundMessages)) {
      return true;
    }
    if (input.attentionUpdates.length === 0) {
      return true;
    }

    const activeContexts = this.deps.attentionGateway.listActive();
    const scopedContextIds = extractAttentionContextIds(input.roundMessages);
    if (scopedContextIds.length > 0) {
      const updatedContextIdSet = new Set(input.attentionUpdates.map((update) => update.contextId));
      for (const contextId of scopedContextIds) {
        if (!updatedContextIdSet.has(contextId)) {
          return true;
        }
        if (activeContexts.some((match) => match.contextId === contextId)) {
          return true;
        }
      }
      return false;
    }

    const updatedContextIdSet = new Set(input.attentionUpdates.map((update) => update.contextId));
    for (const contextId of updatedContextIdSet) {
      if (activeContexts.some((match) => match.contextId === contextId)) {
        return true;
      }
    }
    return false;
  }

  private async runModelRound(
    roundMessages: readonly LoopBusMessage[],
    context?: { signal?: AbortSignal },
  ): Promise<{ continueModelRound: boolean; interleavedMessages: LoopBusMessage[] }> {
    const attentionRound = roundHasAttentionInput(roundMessages);
    const toolTrace: AgentToolTraceEntry[] = [];
    const attentionUpdates: AttentionUpdateCall[] = [];
    const tools = ENABLE_AGENT_TOOLS
      ? this.buildTools(toolTrace, context?.signal)
      : [];
    const promptStore = this.promptStore;
    const modelClient = this.modelClient;
    const promptSnapshot = promptStore.getSnapshot();
    const promptDocs = promptSnapshot.docs;
    const avatarName =
      typeof this.deps.avatarName === "string" && this.deps.avatarName.trim().length > 0
        ? this.deps.avatarName.trim()
        : DEFAULT_AVATAR_PROMPT_NAME;
    const sharedPromptSlots = {
      AVATAR_NAME: avatarName,
    };
    const agenterSystem = await promptStore.buildMd(promptDocs.AGENTER_SYSTEM, {
      slots: sharedPromptSlots,
    });
    const agenter = await promptStore.buildMd(promptDocs.AGENTER, {
      slots: sharedPromptSlots,
    });
    const contract = await promptStore.buildMd(promptDocs.RESPONSE_CONTRACT);
    const systemPrompt = await promptStore.buildMd(promptDocs.SYSTEM_TEMPLATE, {
      slots: {
        AGENTER_SYSTEM: agenterSystem,
        SYSTEMS_GUIDE: "",
        AGENTER: agenter,
        RESPONSE_CONTRACT: contract,
      },
    });
    const promptWindowSnapshot = [...this.promptWindow];
    const transientRequestMessages = await this.formatTransientAttentionProtocolMessages(roundMessages);
    const requestMessages = [...promptWindowSnapshot, ...transientRequestMessages];
    const promptWindowStateId = await this.ensureCurrentPromptWindowStateId();
    const contextChars = systemPrompt.length + JSON.stringify(requestMessages).length;
    this.stats.lastContextChars = contextChars;
    this.stats.totalContextChars += contextChars;
    this.emitStats();

    const callId = createId();
    const requestRecord = {
      systemPrompt,
      promptWindowStateId,
      roundIndex: this.promptWindowRoundIndex,
      messages: structuredClone(requestMessages),
      tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
      meta: {
        loopCount: this.stats.loops,
        promptWindowSize: promptWindowSnapshot.length,
        transientAttentionInputCount: transientRequestMessages.length,
        attentionRound,
      },
    } satisfies AgentModelCallRecord["request"];
    const callRecordBase = {
      id: callId,
      timestamp: Date.now(),
      provider: modelClient.getMeta().provider,
      model: modelClient.getMeta().model,
      request: requestRecord,
    } as const;
    await this.persistModelCall({
      ...callRecordBase,
      status: "running",
    });

    const interleavedMessages: LoopBusMessage[] = [];
    const seenInterleavedIds = new Set<string>();
    const pendingInterleavedModelMessages: TextOnlyModelMessage[] = [];
    let committedModelLoopMessages: TextOnlyModelMessage[] | null = null;
    let projectedInterleavedModelMessageCount = 0;
    let shouldYieldAfterToolPhase = false;
    const readCommittedRequestRecord = (): AgentModelCallRecord["request"] =>
      committedModelLoopMessages === null
        ? requestRecord
        : {
            ...requestRecord,
            messages: structuredClone(committedModelLoopMessages),
          };
    const stageCommittedAttentionInputs = async (nextInputs: LoopBusInput[] | undefined): Promise<void> => {
      const nextMessages = normalizeLoopInputs(nextInputs);
      if (nextMessages.length === 0) {
        return;
      }
      for (const message of nextMessages) {
        if (seenInterleavedIds.has(message.id)) {
          continue;
        }
        seenInterleavedIds.add(message.id);
        interleavedMessages.push(message);
        pendingInterleavedModelMessages.push({
          role: "user",
          content: await this.formatUserMessage(message),
        });
      }
      shouldYieldAfterToolPhase = pendingInterleavedModelMessages.length > 0;
    };
    const commitAttentionItems = async (): Promise<LoopBusInput[] | undefined> => {
      const nextInputs = await this.deps.commitAttentionItems?.();
      await stageCommittedAttentionInputs(nextInputs);
      return nextInputs;
    };
    const commitAttentionAtToolResultBoundary = async (): Promise<void> => {
      if (this.deps.onCanCommitAttentionItems) {
        await this.deps.onCanCommitAttentionItems({
          reason: "tool-result-boundary",
          commitAttentionItems,
        });
      } else {
        await commitAttentionItems();
      }
      shouldYieldAfterToolPhase = pendingInterleavedModelMessages.length > 0;
    };

    try {
      const response = await this.withModelCallTimeout({
        signal: context?.signal,
        run: (abortController) =>
          modelClient.respondWithMeta({
            systemPrompt,
            messages: requestMessages,
            tools,
            abortController,
            consumeCommittedAttentionMessages: (commitInput: ConsumeCommittedAttentionMessagesInput) => {
              if (pendingInterleavedModelMessages.length === 0) {
                return undefined;
              }
              const messages = pendingInterleavedModelMessages.splice(
                0,
                pendingInterleavedModelMessages.length,
              );
              committedModelLoopMessages = structuredClone([...commitInput.messages, ...messages]);
              projectedInterleavedModelMessageCount += messages.length;
              shouldYieldAfterToolPhase = pendingInterleavedModelMessages.length > 0;
              return messages;
            },
            shouldYieldAfterToolPhase: () => shouldYieldAfterToolPhase,
            onUpdate: async (update) => {
              await this.deps.onAssistantStream?.(update);
              if (update.kind === "tool_result") {
                await commitAttentionAtToolResultBoundary();
              }
            },
            onDeliveryEvent: async (event) => {
              await this.deps.onAssistantDelivery?.(event);
            },
          }),
      });

      this.stats.apiCalls += 1;
      if (response.usage?.promptTokens !== undefined) {
        this.stats.lastPromptTokens = response.usage.promptTokens;
        this.stats.totalPromptTokens = (this.stats.totalPromptTokens ?? 0) + response.usage.promptTokens;
        const compactPolicy = this.getCompactPolicy();
        const compactBudgetTokens = modelClient.getContextBudgetTokens();
        if (
          compactPolicy.threshold.enabled &&
          compactPolicy.threshold.promptFraction &&
          compactBudgetTokens &&
          response.usage.promptTokens >= Math.floor(compactBudgetTokens * compactPolicy.threshold.promptFraction)
        ) {
          this.queueCompactRequest("threshold");
        }
      }
      this.emitStats();

      const normalizedResponseText = response.text.trim();
      const effectiveAttentionUpdates =
        attentionUpdates.length > 0
          ? attentionUpdates
          : toolTrace
              .map((entry) => extractAttentionUpdateFromToolTrace(entry))
              .filter((entry): entry is AttentionUpdateCall => entry !== null);
      const attentionMutation = effectiveAttentionUpdates.length > 0;
      const explicitToolProgress = toolTrace.length > 0;
      const invalidAttentionNoProgress = attentionRound && !attentionMutation && !explicitToolProgress;
      const completedAt = Date.now();

      if (invalidAttentionNoProgress) {
        const message = "attention round made no progress";
        await this.persistModelCall({
          ...callRecordBase,
          request: readCommittedRequestRecord(),
          status: "error",
          completedAt,
          outcome: {
            code: "error",
            message,
            reason: "attention.no_progress",
            retryable: true,
          },
          response: {
            decision: {
              kind: "model",
              attentionRound: true,
              invalidReason: "attention.no_progress",
              attentionMutation: false,
              toolTraceCount: toolTrace.length,
            },
            usage: response.usage,
            toolTrace,
            assistant: {
              thinking: response.thinking,
              text: response.text,
              finishReason: response.finishReason ?? null,
            },
          },
          error: {
            message,
            name: "AttentionProtocolError",
            details: {
              retrying: true,
            },
          },
        });
        if (this.shouldQueueRecoveryCompact("attention_retry")) {
          this.queueCompactRequest("attention_retry");
        }
        return { continueModelRound: false, interleavedMessages: [] };
      }

      const nextPromptWindowStateId = await this.pushAssistantTurnToPromptWindow({
        text: normalizedResponseText.length > 0 && toolTrace.length === 0 && !attentionRound ? normalizedResponseText : "",
        toolTrace,
        attentionUpdates: effectiveAttentionUpdates,
      });
      await this.persistModelCall({
        ...callRecordBase,
        request: readCommittedRequestRecord(),
        status: "done",
        completedAt,
        outcome: {
          code: "done",
        },
        response: {
          decision: {
            kind: "model",
            attentionRound,
            attentionMutation,
            toolTraceCount: toolTrace.length,
            promptWindowText: normalizedResponseText.length > 0 && toolTrace.length === 0 && !attentionRound,
            yieldedAfterToolPhase: response.yieldedAfterToolPhase ?? false,
            interleavedInputCount: interleavedMessages.length,
            projectedInterleavedInputCount: projectedInterleavedModelMessageCount,
            unprojectedInterleavedInputCount: pendingInterleavedModelMessages.length,
            nextPromptWindowStateId,
          },
          usage: response.usage,
          toolTrace,
          assistant: {
            thinking: response.thinking,
            text: response.text,
            finishReason: response.finishReason ?? null,
          },
        },
      });
      return {
        continueModelRound: this.shouldContinueAfterToolPhase({
          attentionUpdates: effectiveAttentionUpdates,
          finishReason: response.finishReason ?? null,
          roundMessages,
          interleavedMessages,
          unprojectedInterleavedMessageCount: pendingInterleavedModelMessages.length,
        }),
        interleavedMessages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "Error";
      const stack = error instanceof Error ? error.stack : undefined;
      const aborted = isAbortError(error);
      const timeout = message.includes("timed out after");
      const contextOverflow = isLikelyContextOverflowError(message);
      const outcome = aborted
        ? mapAbortReasonToOutcome(context?.signal?.reason ?? error)
        : timeout
          ? {
              code: "timeout" as const,
              message,
              reason: "model.timeout",
              retryable: true,
              error: error instanceof Error ? { name, message, stack } : error,
            }
          : contextOverflow
            ? {
                code: "error" as const,
                message,
                reason: "model.context_overflow",
                retryable: true,
                error: error instanceof Error ? { name, message, stack } : error,
              }
            : toTerminalOutcomeFromError(error);
      const details = aborted
        ? { canceled: true }
        : error instanceof ModelDecisionError
          ? {
              retried: true,
              ...(error.deliveryError ? { deliveryError: { ...error.deliveryError } } : {}),
            }
          : timeout
            ? { timeout: true }
            : contextOverflow
              ? { contextOverflow: true }
              : undefined;
      await this.persistModelCall({
        ...callRecordBase,
        request: readCommittedRequestRecord(),
        status: aborted ? "cancelled" : "error",
        completedAt: Date.now(),
        outcome,
        response: {
          toolTrace,
        },
        error: { message, name, stack, details },
      });
      if (!aborted && contextOverflow && this.shouldQueueRecoveryCompact("context_overflow")) {
        this.queueCompactRequest("context_overflow");
        return { continueModelRound: false, interleavedMessages: [] };
      }
      if (!aborted && timeout && this.shouldQueueRecoveryCompact("timeout")) {
        this.queueCompactRequest("timeout");
        return { continueModelRound: false, interleavedMessages: [] };
      }
      if (aborted) {
        throw error;
      }
      this.deps.logger.log({
        channel: "error",
        level: "error",
        message: `agenter-ai failed: ${message}`,
      });
      return { continueModelRound: false, interleavedMessages: [] };
    }
  }

  private async pushIncomingBatchToPromptWindow(messages: LoopBusMessage[]): Promise<void> {
    const persistentMessages = messages.filter((message) => !isTransientAttentionProtocolMessage(message));
    if (persistentMessages.length === 0) {
      return;
    }
    const nextPromptWindow = [...this.promptWindow];
    for (const message of persistentMessages) {
      nextPromptWindow.push({
        role: "user",
        content: await this.formatUserMessage(message),
      });
    }
    await this.commitCurrentPromptWindow(nextPromptWindow);
  }

  private async formatTransientAttentionProtocolMessages(
    messages: readonly LoopBusMessage[],
  ): Promise<TextOnlyModelMessage[]> {
    const transientMessages = messages.filter(isTransientAttentionProtocolMessage);
    const formatted: TextOnlyModelMessage[] = [];
    for (const message of transientMessages) {
      formatted.push({
        role: "user",
        content: await this.formatUserMessage(message),
      });
    }
    return formatted;
  }

  private async pushAssistantTurnToPromptWindow(input: {
    attentionUpdates: readonly AttentionUpdateCall[];
    toolTrace: readonly AgentToolTraceEntry[];
    text: string;
  }): Promise<string> {
    const normalizedText = input.text.trim();
    const nextPromptWindow = [...this.promptWindow];
    if (normalizedText.length > 0) {
      nextPromptWindow.push({
        role: "assistant",
        content: [toTextPart(normalizedText)],
      });
    }
    for (const tool of input.toolTrace) {
      nextPromptWindow.push({
        role: "assistant",
        content: [toTextPart(buildToolInvocationContent(tool))],
      });
    }
    const attentionMessage = this.buildAttentionCommitPromptWindowMessage(input.attentionUpdates);
    if (attentionMessage) {
      nextPromptWindow.push(attentionMessage);
    }
    if (nextPromptWindow.length === this.promptWindow.length) {
      return await this.ensureCurrentPromptWindowStateId();
    }
    const nextPromptWindowState = await this.commitCurrentPromptWindow(nextPromptWindow);
    return nextPromptWindowState.id;
  }

  private buildAttentionCommitPromptWindowMessage(updates: readonly AttentionUpdateCall[]): TextOnlyModelMessage | null {
    if (updates.length === 0) {
      return null;
    }
    return {
      role: "assistant",
      content: [
        toTextPart(
          mdFence(
            "yaml+attention_items",
            toYaml({
            commits: updates.map((update) => ({
              contextId: update.contextId,
              commitId: update.commitId,
              done: update.done,
              summary: update.text,
              scores: update.scores,
            })),
          }),
          ),
        ),
      ],
    };
  }

  private buildCompactInput(): string {
    const attentionFacts = this.deps.attentionGateway.listActive();
    const promptWindowText = this.promptWindow
      .map((item, index) => {
        const content = historyContentToText(item.content);
        if (content.trim().length === 0 || isPromptWindowToolTraceEntry(content)) {
          return null;
        }
        return `# ${index + 1} ${item.role}\n${content}`;
      })
      .filter((item): item is string => item !== null)
      .join("\n\n");

    return attentionFacts.length === 0
      ? promptWindowText
      : `${promptWindowText}\n\n# attention_system\n${JSON.stringify(
          attentionFacts.map((match) => ({
            contextId: match.contextId,
            context: {
              owner: match.context.owner,
              headCommitId: match.context.headCommitId,
              content: match.context.content,
            },
            recentCommits: match.recentCommits.map((commit) => ({
              commitId: commit.commitId,
              author: commit.meta.author,
              source: commit.meta.source,
              src: commit.meta.src,
              tags: commit.meta.tags,
              summary: commit.summary,
              change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
            })),
          })),
        )}`;
  }

  private isLikelyCompactAcknowledgement(value: string): boolean {
    const normalized = normalizeCompactText(value);
    if (normalized.length === 0) {
      return true;
    }
    return COMPACT_ACK_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private collectSettledCompactAnswers(): string[] {
    const answers = extractSettledAnswersFromCompactSummary(this.lastCompactSummary);
    let allowSettledToolReplay = false;
    for (const item of [...this.promptWindow].reverse()) {
      if (item.role !== "assistant") {
        continue;
      }
      const content = historyContentToText(item.content);
      if (content.trim().length === 0 || isPromptWindowToolTraceEntry(content)) {
        if (!allowSettledToolReplay) {
          continue;
        }
        const traceAnswer = extractSettledAnswerFromToolTrace(content);
        if (!traceAnswer || this.isLikelyCompactAcknowledgement(traceAnswer)) {
          continue;
        }
        pushUniqueCompactText(answers, traceAnswer);
        if (answers.length >= 3) {
          break;
        }
        continue;
      }
      if (content.includes("yaml+attention_items")) {
        allowSettledToolReplay = content.includes("done: true");
        continue;
      }
      if (content.includes("yaml+prompt_window_compact")) {
        continue;
      }
      const normalized = normalizeCompactText(content);
      if (this.isLikelyCompactAcknowledgement(normalized)) {
        allowSettledToolReplay = false;
        continue;
      }
      allowSettledToolReplay = false;
      pushUniqueCompactText(answers, normalized);
      if (answers.length >= 3) {
        break;
      }
    }
    return answers;
  }

  private enrichCompactSummaryWithSettledFacts(
    summary: AgentPromptWindowCompactSummary,
  ): AgentPromptWindowCompactSummary {
    const settledAnswers = this.collectSettledCompactAnswers();
    if (settledAnswers.length === 0) {
      return summary;
    }
    const decisions = [...summary.decisions];
    const keyFacts = [...summary.keyFacts];
    const nextSteps = [...summary.nextSteps];
    for (const answer of settledAnswers) {
      pushUniqueCompactText(keyFacts, `Settled user-visible answer: ${answer}`);
    }
    pushUniqueCompactText(
      decisions,
      "If a later follow-up clearly asks for one of the settled user-visible answers recorded in compact memory, answer directly instead of reopening finished relay or lookup work.",
    );
    pushUniqueCompactText(
      nextSteps,
      `Directly reuse settled compact answers when the same follow-up repeats: ${settledAnswers[0]}`,
    );
    return {
      ...summary,
      decisions: decisions.slice(0, 8),
      keyFacts: keyFacts.slice(0, 12),
      nextSteps: nextSteps.slice(0, 8),
    };
  }

  private buildCompactSummaryPromptWindowMessage(summary: AgentPromptWindowCompactSummary): TextOnlyModelMessage {
    return {
      role: "assistant",
      content: [
        toTextPart(
          mdFence(
            "yaml+prompt_window_compact",
            toYaml({
              overview: summary.overview,
              decisions: summary.decisions,
              keyFiles: summary.keyFiles,
              keyFacts: summary.keyFacts,
              unresolvedWork: summary.unresolvedWork,
              nextSteps: summary.nextSteps,
            }),
          ),
        ),
      ],
    };
  }

  private buildActiveAttentionPromptWindowMessage(): TextOnlyModelMessage | null {
    const activeContexts = this.deps.attentionGateway.listActive();
    if (activeContexts.length === 0) {
      return null;
    }
    return {
      role: "assistant",
      content: [
        toTextPart(
          mdFence(
            "yaml+attention_items",
            toYaml({
              activeContexts: activeContexts.map((match) => ({
                contextId: match.contextId,
                owner: match.context.owner,
                content: match.context.content,
                recentCommits: match.recentCommits.map((commit) => ({
                  commitId: commit.commitId,
                  author: commit.meta.author,
                  source: commit.meta.source,
                  src: commit.meta.src,
                  tags: commit.meta.tags,
                  summary: commit.summary,
                  change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
                })),
              })),
            }),
          ),
        ),
      ],
    };
  }

  private buildPromptWindowFromCompact(summary: AgentPromptWindowCompactSummary): TextOnlyModelMessage[] {
    this.lastCompactSummary = summary;
    const nextPromptWindow: TextOnlyModelMessage[] = [this.buildCompactSummaryPromptWindowMessage(summary)];
    const activeAttention = this.buildActiveAttentionPromptWindowMessage();
    if (activeAttention) {
      nextPromptWindow.push(activeAttention);
    }
    return this.trimPromptWindow(nextPromptWindow);
  }

  private buildEmergencyCompactSummary(reason: string): AgentPromptWindowCompactSummary {
    const recentSnippets: string[] = [];
    const decisions = [...(this.lastCompactSummary?.decisions ?? [])];
    const keyFiles = [...(this.lastCompactSummary?.keyFiles ?? [])];
    const keyFacts = [...(this.lastCompactSummary?.keyFacts ?? [])];
    const unresolvedWork = [...(this.lastCompactSummary?.unresolvedWork ?? [])];
    const nextSteps = [...(this.lastCompactSummary?.nextSteps ?? [])];

    for (const item of [...this.promptWindow].reverse()) {
      const content = historyContentToText(item.content);
      if (content.trim().length === 0 || isPromptWindowToolTraceEntry(content)) {
        continue;
      }
      const snippet = normalizeCompactText(content).slice(0, EMERGENCY_COMPACT_SNIPPET_CHARS);
      pushUniqueCompactText(recentSnippets, `${item.role}: ${snippet}`);
      for (const match of content.matchAll(COMPACT_KEY_FILE_PATTERN)) {
        pushUniqueCompactFile(keyFiles, match[0]);
      }
      if (recentSnippets.length >= EMERGENCY_COMPACT_RECENT_SNIPPET_LIMIT) {
        break;
      }
    }

    const activeAttention = this.deps.attentionGateway.listActive();
    for (const match of activeAttention) {
      pushUniqueCompactText(
        unresolvedWork,
        `[${match.contextId}] ${normalizeCompactText(match.context.content).slice(0, EMERGENCY_COMPACT_SNIPPET_CHARS)}`,
      );
      const latestCommitSummary = match.recentCommits.at(-1)?.summary;
      if (latestCommitSummary) {
        pushUniqueCompactText(
          keyFacts,
          `[${match.contextId}] ${normalizeCompactText(latestCommitSummary).slice(0, EMERGENCY_COMPACT_SNIPPET_CHARS)}`,
        );
      }
    }

    pushUniqueCompactText(keyFacts, `Normal compact failed with: ${reason}`);
    if (unresolvedWork.length > 0) {
      pushUniqueCompactText(
        nextSteps,
        "Resume from the active attention contexts and finish the oldest durable room or tool obligation before starting new work.",
      );
    }
    if (decisions.length === 0) {
      pushUniqueCompactText(
        decisions,
        "Terminal or tool success is not enough by itself; send the required durable room reply before settling the work.",
      );
    }

    const overview = [
      "Emergency compact preserved the active runtime state after the normal compact step failed.",
      recentSnippets.length > 0 ? `Recent context: ${recentSnippets.join(" | ")}` : "",
    ]
      .filter((part) => part.length > 0)
      .join(" ");

    return {
      overview,
      decisions: decisions.slice(0, 8),
      keyFiles: keyFiles.slice(0, 12),
      keyFacts: keyFacts.slice(0, 12),
      unresolvedWork: unresolvedWork.slice(0, 12),
      nextSteps: nextSteps.slice(0, 8),
      raw: overview,
    };
  }

  private async applyEmergencyCompactFallback(reason: string): Promise<void> {
    const summary = this.buildEmergencyCompactSummary(reason);
    const nextPromptWindowState = await this.commitCurrentPromptWindow(
      this.buildPromptWindowFromCompact(summary),
      Date.now(),
    );
    this.deps.logger.log({
      channel: "agent",
      level: "warn",
      message: "prompt_window.compact.fallback",
      meta: {
        reason,
        nextPromptWindowStateId: nextPromptWindowState.id,
        promptWindowSize: nextPromptWindowState.messages.length,
      },
    });
  }

  private async formatUserMessage(message: LoopBusMessage): Promise<ContentPart[]> {
    const header = `### ${message.name}`;
    if (message.source === "chat") {
      const attachmentFacts: string[] = [];
      const textSections = [
        header,
        message.text,
      ].filter((item) => item.length > 0);
      const parts: ContentPart[] = [toTextPart(textSections.join("\n\n"))];
      for (const attachment of message.attachments ?? []) {
        if (attachment.kind === "image") {
          const resolved = await this.deps.resolveImageAttachment?.(attachment);
          if (resolved) {
            parts.push({
              type: "image",
              source: {
                type: "data",
                mimeType: resolved.mimeType,
                value: resolved.dataBase64,
              },
            });
            continue;
          }
        }
        attachmentFacts.push(
          `- ${attachment.kind}: ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`,
        );
      }
      if (attachmentFacts.length > 0) {
        parts[0] = toTextPart(
          [...textSections, "attachments:", ...attachmentFacts].filter((item) => item.length > 0).join("\n\n"),
        );
      }
      return parts;
    }
    if (message.source === "attention") {
      return [toTextPart(message.text)];
    }

    const metaYaml = toYaml({
      source: message.source,
      timestamp: formatTimestamp(message.timestamp),
      ...(message.meta ?? {}),
    });
    return [
      toTextPart(
        [header, mdFence("yaml", metaYaml), mdFence(detectTextFenceLanguage(message.text), message.text)].join("\n\n"),
      ),
    ];
  }

  private trimPromptWindow(messages: readonly TextOnlyModelMessage[]): TextOnlyModelMessage[] {
    if (messages.length <= MAX_HISTORY_MESSAGES) {
      return [...messages];
    }
    return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
  }

  private buildTools(trace: AgentToolTraceEntry[], signal?: AbortSignal): Tool[] {
    const throwIfAborted = (): void => {
      if (signal?.aborted) {
        throw createAbortError(signal.reason);
      }
    };

    const traceTool = async <TInput extends unknown, TOutput extends unknown>(
      toolName: string,
      input: TInput,
      handler: () => Promise<TOutput>,
      options?: {
        invocationId?: string;
      },
    ): Promise<TOutput> => {
      const invocationId = options?.invocationId?.trim() || `${toolName}:${createId()}`;
      const startedAt = Date.now();
      try {
        throwIfAborted();
        if (hasMeaningfulToolInput(input)) {
          await this.deps.onAssistantStream?.({
            kind: "tool_call",
            toolCallId: invocationId,
            toolName,
            argsText: stringifyToolArgs(input),
            input,
            timestamp: startedAt,
          });
        }
        const output = await handler();
        throwIfAborted();
        const finishedAt = Date.now();
        await this.deps.onAssistantStream?.({
          kind: "tool_result",
          toolCallId: invocationId,
          toolName,
          ok: true,
          result: output,
          timestamp: finishedAt,
        });
        trace.push({
          invocationId,
          tool: toolName,
          input,
          output,
          startedAt,
          finishedAt,
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const finishedAt = Date.now();
        await this.deps.onAssistantStream?.({
          kind: "tool_result",
          toolCallId: invocationId,
          toolName,
          ok: false,
          error: message,
          timestamp: finishedAt,
        });
        trace.push({
          invocationId,
          tool: toolName,
          input,
          error: message,
          startedAt,
          finishedAt,
        });
        throw error;
      }
    };

    const externalTools = (this.deps.toolProviders ?? []).flatMap((provider) =>
      provider.createTools({
        runtimeText: this.runtimeText,
        signal,
        traceTool,
      }),
    );

    const tools: Tool[] = externalTools;

    this.deps.logger.log({
      channel: "agent",
      level: "debug",
      message: "ai.tools.ready",
      meta: { count: tools.length },
    });

    return tools;
  }

  private emitStats(): void {
    const snapshot = { ...this.stats };
    for (const listener of this.statsListeners) {
      listener(snapshot);
    }
  }
}
