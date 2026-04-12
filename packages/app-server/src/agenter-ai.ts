import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
} from "@agenter/attention-system";
import type { SessionTerminalOutcome } from "@agenter/session-system";
import { toolDefinition, type ContentPart, type Tool } from "@tanstack/ai";
import { z } from "zod";

import type { AttentionSearchRequest } from "./attention-search";
import { projectAttentionCommitMatchForModel } from "./attention-model-view";
import type { ChatCycleCompactTrigger } from "./chat-cycles";
import type { LoopBusInput, LoopBusMessage } from "./loop-bus";
import type { AssistantStreamUpdate, ModelClient, TextOnlyModelMessage } from "./model-client";
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
  traceTool: <TInput, TOutput>(toolName: string, input: TInput, handler: () => Promise<TOutput>) => Promise<TOutput>;
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
  promptWindowStore?: AgentPromptWindowStore;
  initialPromptWindowState?: AgentPromptWindowStateRecord;
  avatarName?: string;
  locale?: string;
  skillsList?: string;
  attentionGateway: AttentionGateway;
  builtinToolMode?: "attention" | "none";
  toolProviders?: AgentToolProvider[];
  resolveImageAttachment?: (
    attachment: ChatSessionAsset,
  ) => Promise<ResolvedImageAttachmentSource | null> | ResolvedImageAttachmentSource | null;
  collectInterleavedInputs?: () => Promise<LoopBusInput[] | undefined> | LoopBusInput[] | undefined;
  onAssistantStream?: (update: AssistantStreamUpdate) => Promise<void> | void;
  onModelCall?: (record: AgentModelCallRecord) => Promise<void> | void;
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

const parseLoopMetaList = (value: unknown): string[] => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
};

const buildChatSocialContext = (message: LoopBusMessage): Record<string, unknown> | null => {
  const meta = message.meta ?? {};
  if (typeof meta.chatId !== "string" && typeof meta.chatTitle !== "string") {
    return null;
  }
  const participantLabels = parseLoopMetaList(meta.chatParticipantLabels);
  const otherParticipantLabels = parseLoopMetaList(meta.chatOtherParticipantLabels);
  const onlineLabels = parseLoopMetaList(meta.chatOnlineParticipantLabels);
  const offlineLabels = parseLoopMetaList(meta.chatOfflineParticipantLabels);
  const focusedLabels = parseLoopMetaList(meta.chatFocusedParticipantLabels);
  return {
    channel: {
      chatId: typeof meta.chatId === "string" ? meta.chatId : null,
      title: typeof meta.chatTitle === "string" ? meta.chatTitle : null,
      kind: typeof meta.chatKind === "string" ? meta.chatKind : null,
      audience: typeof meta.chatAudience === "string" ? meta.chatAudience : null,
      participantCount: typeof meta.chatParticipantCount === "number" ? meta.chatParticipantCount : participantLabels.length,
      participants: participantLabels,
      otherParticipants: otherParticipantLabels,
    },
    perspective: {
      latestMessage: typeof meta.chatMessagePerspective === "string" ? meta.chatMessagePerspective : null,
      senderActorId: typeof meta.chatSenderActorId === "string" ? meta.chatSenderActorId : null,
      senderLabel:
        typeof meta.chatSenderLabel === "string" && meta.chatSenderLabel.trim().length > 0 ? meta.chatSenderLabel : message.name,
      selfActorId: typeof meta.chatSelfActorId === "string" ? meta.chatSelfActorId : null,
      selfLabel: typeof meta.chatSelfLabel === "string" ? meta.chatSelfLabel : null,
      turnState: typeof meta.chatTurnState === "string" ? meta.chatTurnState : null,
    },
    obligation: {
      kind: typeof meta.chatObligationKind === "string" ? meta.chatObligationKind : null,
      settlesWhen:
        meta.chatObligationKind === "room_reply_pending" ? "required_room_reply_sent" : "no_external_reply_needed",
    },
    presence: {
      online: onlineLabels,
      offline: offlineLabels,
      focused: focusedLabels,
    },
  };
};

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

const extractSettledAnswerFromToolTrace = (content: string): string | null => {
  if (!isPromptWindowToolTraceEntry(content) || extractYamlTopLevelScalar(content, "tool") !== "message_send") {
    return null;
  }
  if (extractYamlTopLevelScalar(content, "status") !== "success") {
    return null;
  }
  const deliveredContent = extractYamlNestedScalar(content, "input", "content");
  if (!deliveredContent) {
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

  constructor(private readonly deps: AgentDeps) {
    this.runtimeText = createRuntimeText(this.deps.locale);
    const initialPromptWindowState = this.deps.initialPromptWindowState;
    if (initialPromptWindowState) {
      this.promptWindow = structuredClone(initialPromptWindowState.messages);
      this.promptWindowStateId = initialPromptWindowState.id;
      this.promptWindowRoundIndex = initialPromptWindowState.roundIndex;
      const ephemeralMatch = initialPromptWindowState.id.match(/^ephemeral-(\d+)$/);
      this.nextEphemeralPromptWindowStateId = ephemeralMatch ? Number(ephemeralMatch[1]) + 1 : 1;
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

    await this.persistModelCall({
      id: requestId,
      timestamp: requestTimestamp,
      status: "running",
      provider: this.deps.modelClient.getMeta().provider,
      model: this.deps.modelClient.getMeta().model,
      request: requestRecord,
    });

    try {
      const response = await this.withModelCallTimeout({
        signal: input.signal,
        run: (abortController) =>
          this.deps.modelClient.respondWithMeta({
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
        provider: this.deps.modelClient.getMeta().provider,
        model: this.deps.modelClient.getMeta().model,
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
        provider: this.deps.modelClient.getMeta().provider,
        model: this.deps.modelClient.getMeta().model,
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
        this.queueCompactRequest("error");
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
  }): boolean {
    if (input.interleavedMessages.length > 0) {
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
      ? this.buildTools(
          toolTrace,
          {
            onAttentionUpdate: (update) => {
              attentionUpdates.push(update);
            },
          },
          context?.signal,
        )
      : [];
    const promptSnapshot = this.deps.promptStore.getSnapshot();
    const promptDocs = promptSnapshot.docs;
    const avatarName =
      typeof this.deps.avatarName === "string" && this.deps.avatarName.trim().length > 0
        ? this.deps.avatarName.trim()
        : DEFAULT_AVATAR_PROMPT_NAME;
    const sharedPromptSlots = {
      AVATAR_NAME: avatarName,
    };
    const agenterSystem = await this.deps.promptStore.buildMd(promptDocs.AGENTER_SYSTEM, {
      slots: sharedPromptSlots,
    });
    const agenterSystemWithSkills = [agenterSystem.trim(), this.deps.skillsList?.trim() ?? ""]
      .filter((part) => part.length > 0)
      .join("\n\n");
    const agenter = await this.deps.promptStore.buildMd(promptDocs.AGENTER, {
      slots: sharedPromptSlots,
    });
    const contract = await this.deps.promptStore.buildMd(promptDocs.RESPONSE_CONTRACT);
    const systemPrompt = await this.deps.promptStore.buildMd(promptDocs.SYSTEM_TEMPLATE, {
      slots: {
        AGENTER_SYSTEM: agenterSystemWithSkills,
        SYSTEMS_GUIDE: "",
        AGENTER: agenter,
        RESPONSE_CONTRACT: contract,
      },
    });
    const promptWindowSnapshot = [...this.promptWindow];
    const promptWindowStateId = await this.ensureCurrentPromptWindowStateId();
    const contextChars = systemPrompt.length + JSON.stringify(promptWindowSnapshot).length;
    this.stats.lastContextChars = contextChars;
    this.stats.totalContextChars += contextChars;
    this.emitStats();

    const callId = createId();
    const requestRecord = {
      systemPrompt,
      promptWindowStateId,
      roundIndex: this.promptWindowRoundIndex,
      messages: structuredClone(promptWindowSnapshot),
      tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
      meta: {
        loopCount: this.stats.loops,
        promptWindowSize: promptWindowSnapshot.length,
        attentionRound,
      },
    } satisfies AgentModelCallRecord["request"];
    const callRecordBase = {
      id: callId,
      timestamp: Date.now(),
      provider: this.deps.modelClient.getMeta().provider,
      model: this.deps.modelClient.getMeta().model,
      request: requestRecord,
    } as const;
    await this.persistModelCall({
      ...callRecordBase,
      status: "running",
    });

    const interleavedMessages: LoopBusMessage[] = [];
    const seenInterleavedIds = new Set<string>();
    let shouldYieldAfterToolPhase = false;
    const collectInterleavedMessages = async (): Promise<void> => {
      const nextInputs = await this.deps.collectInterleavedInputs?.();
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
      }
      shouldYieldAfterToolPhase = interleavedMessages.length > 0;
    };

    try {
      const response = await this.withModelCallTimeout({
        signal: context?.signal,
        run: (abortController) =>
          this.deps.modelClient.respondWithMeta({
            systemPrompt,
            messages: promptWindowSnapshot,
            tools,
            abortController,
            shouldYieldAfterToolPhase: () => shouldYieldAfterToolPhase,
            onUpdate: async (update) => {
              await this.deps.onAssistantStream?.(update);
              if (update.kind === "tool_result") {
                await collectInterleavedMessages();
              }
            },
          }),
      });

      this.stats.apiCalls += 1;
      if (response.usage?.promptTokens !== undefined) {
        this.stats.lastPromptTokens = response.usage.promptTokens;
        this.stats.totalPromptTokens = (this.stats.totalPromptTokens ?? 0) + response.usage.promptTokens;
        const compactConfig = this.deps.modelClient.getCompactConfig();
        if (
          compactConfig.maxToken &&
          compactConfig.compactThreshold &&
          response.usage.promptTokens >= Math.floor(compactConfig.maxToken * compactConfig.compactThreshold)
        ) {
          this.queueCompactRequest("threshold");
        }
      }
      this.emitStats();

      const normalizedResponseText = response.text.trim();
      const attentionMutation = attentionUpdates.length > 0;
      const explicitToolProgress = toolTrace.length > 0;
      const invalidAttentionNoProgress = attentionRound && !attentionMutation && !explicitToolProgress;
      const completedAt = Date.now();

      if (invalidAttentionNoProgress) {
        const message = "attention round made no progress";
        await this.persistModelCall({
          ...callRecordBase,
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
        this.queueCompactRequest("attention_retry");
        return { continueModelRound: false, interleavedMessages: [] };
      }

      const nextPromptWindowStateId = await this.pushAssistantTurnToPromptWindow({
        text: normalizedResponseText.length > 0 && toolTrace.length === 0 && !attentionRound ? normalizedResponseText : "",
        toolTrace,
        attentionUpdates,
      });
      await this.persistModelCall({
        ...callRecordBase,
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
          attentionUpdates,
          finishReason: response.finishReason ?? null,
          roundMessages,
          interleavedMessages,
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
          ? { retried: true }
          : timeout
            ? { timeout: true }
            : contextOverflow
              ? { contextOverflow: true }
              : undefined;
      await this.persistModelCall({
        ...callRecordBase,
        status: aborted ? "cancelled" : "error",
        completedAt: Date.now(),
        outcome,
        response: {
          toolTrace,
        },
        error: { message, name, stack, details },
      });
      if (!aborted && (contextOverflow || timeout)) {
        this.queueCompactRequest("error");
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
    const nextPromptWindow = [...this.promptWindow];
    for (const message of messages) {
      nextPromptWindow.push({
        role: "user",
        content: await this.formatUserMessage(message),
      });
    }
    await this.commitCurrentPromptWindow(nextPromptWindow);
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
              scoreMap: match.context.scoreMap,
              content: match.context.content,
            },
            recentCommits: match.recentCommits.map((commit) => ({
              commitId: commit.commitId,
              author: commit.meta.author,
              source: commit.meta.source,
              systemId: commit.meta.systemId,
              subjectId: commit.meta.subjectId,
              channelId: commit.meta.channelId,
              tags: commit.meta.tags,
              scores: commit.scores,
              summary: commit.summary,
              egress: commit.egress ?? null,
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
                scoreMap: match.context.scoreMap,
                recentCommits: match.recentCommits.map((commit) => ({
                  commitId: commit.commitId,
                  author: commit.meta.author,
                  source: commit.meta.source,
                  systemId: commit.meta.systemId,
                  subjectId: commit.meta.subjectId,
                  channelId: commit.meta.channelId,
                  tags: commit.meta.tags,
                  summary: commit.summary,
                  egress: commit.egress ?? null,
                  scores: commit.scores,
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
      const socialContext = buildChatSocialContext(message);
      const textSections = [
        header,
        ...(socialContext ? [mdFence("yaml", toYaml(socialContext))] : []),
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

  private buildTools(
    trace: AgentToolTraceEntry[],
    hooks: {
      onAttentionUpdate: (update: AttentionUpdateCall) => void;
    },
    signal?: AbortSignal,
  ): Tool[] {
    const throwIfAborted = (): void => {
      if (signal?.aborted) {
        throw createAbortError(signal.reason);
      }
    };

    const traceTool = async <TInput extends unknown, TOutput extends unknown>(
      toolName: string,
      input: TInput,
      handler: () => Promise<TOutput>,
    ): Promise<TOutput> => {
      const invocationId = `${toolName}:${createId()}`;
      const startedAt = Date.now();
      try {
        throwIfAborted();
        const output = await handler();
        throwIfAborted();
        const finishedAt = Date.now();
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

    const attentionCommitMetaSchema = z
      .object({
        author: z.string().min(1),
        source: z.string().min(1),
        systemId: z.string().optional(),
        subjectId: z.string().optional(),
        channelId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        createdAt: z.string().optional(),
      });

    const attentionCommitToolMetaSchema = z
      .object({
        author: z.string().min(1).optional(),
        source: z.string().min(1).optional(),
        systemId: z.string().optional(),
        subjectId: z.string().optional(),
        channelId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        createdAt: z.string().optional(),
      });

    const attentionCommitEgressSchema = z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("message_reply"),
        chatId: z.string().min(1),
        rootId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    ]);

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

    const attentionCommitToolInputSchema = z
      .object({
        contextId: z.string().min(1),
        parentCommitIds: z.array(z.string()).optional(),
        meta: attentionCommitToolMetaSchema.optional(),
        egress: attentionCommitEgressSchema.optional(),
        scores: z.record(z.string(), z.number()).optional(),
        summary: z.string().min(1),
        change: attentionCommitChangeSchema.optional(),
        done: z.boolean().optional(),
      })
      .refine((value) => value.change !== undefined || value.done === true, {
        message: "change is required unless done is true",
        path: ["change"],
      });

    const attentionMatchSchema = z.object({
      contextId: z.string(),
      context: z.object({
        contextId: z.string(),
        owner: z.string(),
        content: z.string(),
        contentFormat: z.string().optional(),
        scoreMap: z.record(z.string(), z.number()),
        headCommitId: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
        commit: z.object({
          commitId: z.string(),
          contextId: z.string(),
          parentCommitIds: z.array(z.string()),
          meta: attentionCommitMetaSchema,
          egress: attentionCommitEgressSchema.optional(),
          scores: z.record(z.string(), z.number()),
          summary: z.string(),
          change: attentionCommitChangeSchema,
        createdAt: z.string(),
      }),
    });

    const externalTools = (this.deps.toolProviders ?? []).flatMap((provider) =>
      provider.createTools({
        runtimeText: this.runtimeText,
        signal,
        traceTool,
      }),
    );

    if (this.deps.builtinToolMode === "none") {
      return externalTools;
    }

    const attentionContextListTool = toolDefinition({
      name: "attention_context_list",
      description: this.runtimeText.t("tool.attention_context_list.description"),
      outputSchema: z.object({
        contexts: z.array(
          z.object({
            contextId: z.string(),
            owner: z.string(),
            headCommitId: z.string().nullable(),
            unresolvedScoreCount: z.number(),
            updatedAt: z.string(),
          }),
        ),
      }),
    }).server(async () =>
      traceTool("attention_context_list", {}, async () => ({
        contexts: this.deps.attentionGateway.listContexts(),
      })),
    );

    const attentionQueryTool = toolDefinition({
      name: "attention_query",
      description: this.runtimeText.t("tool.attention_query.description"),
      inputSchema: z.object({
        query: z.string(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
      outputSchema: z.object({
        items: z.array(attentionMatchSchema),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          query: z.string(),
          offset: z.number().int().min(0).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .parse(rawInput);
      return traceTool("attention_query", input, async () => ({
        items: (await this.deps.attentionGateway.query(input)).map(projectAttentionCommitMatchForModel),
      }));
    });

    const attentionCommitTool = toolDefinition({
      name: "attention_commit",
      description: this.runtimeText.t("tool.attention_commit.description"),
      inputSchema: attentionCommitToolInputSchema,
      outputSchema: z.object({
        ok: z.boolean(),
        commitId: z.string(),
      }),
    }).server(async (rawInput) => {
      const input = attentionCommitToolInputSchema.parse(rawInput);
      const resolvedScores = input.done
        ? (() => {
            const activeContext = this.deps.attentionGateway.listActive().find((item) => item.contextId === input.contextId);
            if (!activeContext) {
              return undefined;
            }
            const activeScores = Object.entries(activeContext.context.scoreMap).filter(([, value]) => value > 0);
            if (activeScores.length === 0) {
              return {};
            }
            return Object.fromEntries(activeScores.map(([hash]) => [hash, 0]));
          })()
        : undefined;
      const effectiveScores =
        input.scores === undefined
          ? resolvedScores
          : resolvedScores
            ? {
                ...resolvedScores,
                ...input.scores,
              }
            : input.scores;
      const effectiveInput = {
        contextId: input.contextId,
        parentCommitIds: input.parentCommitIds,
        meta: input.meta,
        egress: input.egress,
        scores: effectiveScores,
        summary: input.summary,
        change: input.change ?? { type: "clean" },
      } satisfies AttentionCommitToolInput;
      return traceTool("attention_commit", effectiveInput, async () => {
        const commit = await this.deps.attentionGateway.commit(effectiveInput);
        hooks.onAttentionUpdate({
          contextId: input.contextId,
          commitId: commit.commitId,
          text: commit.summary,
          scores: commit.scores,
          done: input.done ?? false,
        });
        return { ok: true, commitId: commit.commitId };
      });
    });

    const tools: Tool[] = [attentionContextListTool, attentionQueryTool, attentionCommitTool, ...externalTools];

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
