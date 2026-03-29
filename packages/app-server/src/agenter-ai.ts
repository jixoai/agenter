import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitMatch,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
  AttentionQueryInput,
} from "@agenter/attention-system";
import type { SessionTerminalOutcome } from "@agenter/session-system";
import { toolDefinition, type ContentPart, type Tool } from "@tanstack/ai";
import { z } from "zod";

import { projectAttentionCommitMatchForModel } from "./attention-model-view";
import type { ChatCycleCompactTrigger } from "./chat-cycles";
import type { LoopBusMessage } from "./loop-bus";
import type { AssistantStreamUpdate, ModelClient, TextOnlyModelMessage } from "./model-client";
import { ModelDecisionError } from "./model-client";
import type { PromptStore } from "./prompt-store";
import { createRuntimeText } from "./runtime-text";
import { mapAbortReasonToOutcome, toTerminalOutcomeFromError } from "./runtime-trace";
import type { SessionStore } from "./session-store";
import type { AppServerLogger, ChatSessionAsset } from "./types";

interface AttentionGateway {
  listContexts: () => AttentionContextDescriptor[];
  listActive: () => AttentionActiveContextMatch[];
  query: (input: AttentionQueryInput) => Promise<AttentionCommitMatch[]> | AttentionCommitMatch[];
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

interface AgentDeps {
  modelClient: ModelClient;
  modelCallTimeoutMs?: number;
  logger: AppServerLogger;
  promptStore: PromptStore;
  locale?: string;
  attentionGateway: AttentionGateway;
  toolProviders?: AgentToolProvider[];
  sessionStore?: SessionStore;
  resolveImageAttachment?: (
    attachment: ChatSessionAsset,
  ) => Promise<ResolvedImageAttachmentSource | null> | ResolvedImageAttachmentSource | null;
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

export interface AgentPromptWindowReadyReply {
  channelId: string;
  topic: string;
  triggerPhrases: string[];
  reply: string;
  reuseWhen: string;
}

export interface AgentPromptWindowCompactSummary {
  overview: string;
  decisions: string[];
  keyFiles: string[];
  keyFacts: string[];
  readyReplies: AgentPromptWindowReadyReply[];
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
const DEFAULT_MODEL_CALL_TIMEOUT_MS = 120_000;
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

const COMPACT_READY_REPLY_SCHEMA = z.object({
  channelId: z.string().default(""),
  topic: z.string().default(""),
  triggerPhrases: z.array(z.string()).default([]),
  reply: z.string().default(""),
  reuseWhen: z.string().default(""),
});

const COMPACT_SUMMARY_SCHEMA = z.object({
  overview: z.string().default(""),
  decisions: z.array(z.string()).default([]),
  keyFiles: z.array(z.string()).default([]),
  keyFacts: z.array(z.string()).default([]),
  readyReplies: z.array(z.union([z.string(), COMPACT_READY_REPLY_SCHEMA])).default([]),
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

const normalizeCompactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const isPromptWindowCommandText = (value: string): boolean => value.startsWith("/");

const pushUniqueCompactText = (target: string[], value: string): void => {
  const normalized = normalizeCompactText(value);
  if (normalized.length === 0 || isPromptWindowCommandText(normalized) || target.includes(normalized)) {
    return;
  }
  target.push(normalized);
};

const normalizeReadyReply = (
  value: string | z.infer<typeof COMPACT_READY_REPLY_SCHEMA>,
): AgentPromptWindowReadyReply | null => {
  if (typeof value === "string") {
    const reply = normalizeCompactText(value);
    if (reply.length === 0) {
      return null;
    }
    return {
      channelId: "",
      topic: "",
      triggerPhrases: [],
      reply,
      reuseWhen: "",
    };
  }

  const reply = normalizeCompactText(value.reply);
  if (reply.length === 0) {
    return null;
  }
  return {
    channelId: normalizeCompactText(value.channelId),
    topic: normalizeCompactText(value.topic),
    triggerPhrases: value.triggerPhrases.map(normalizeCompactText).filter((item) => item.length > 0),
    reply,
    reuseWhen: normalizeCompactText(value.reuseWhen),
  };
};

const mergeReadyReplies = (items: readonly AgentPromptWindowReadyReply[]): AgentPromptWindowReadyReply[] => {
  const merged = new Map<string, AgentPromptWindowReadyReply>();
  for (const item of items) {
    const normalized = normalizeReadyReply(item);
    if (!normalized) {
      continue;
    }
    const key = [normalized.channelId, normalized.reply].join("::");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...normalized,
        triggerPhrases: [...normalized.triggerPhrases],
      });
      continue;
    }
    existing.topic = existing.topic.length > 0 ? existing.topic : normalized.topic;
    existing.reuseWhen = existing.reuseWhen.length > 0 ? existing.reuseWhen : normalized.reuseWhen;
    for (const phrase of normalized.triggerPhrases) {
      pushUniqueCompactText(existing.triggerPhrases, phrase);
    }
  }
  return [...merged.values()];
};

const matchesReadyReplyCandidate = (candidate: string, fact: AgentPromptWindowReadyReply): boolean => {
  const normalizedCandidate = normalizeCompactText(candidate);
  if (normalizedCandidate.length === 0) {
    return false;
  }
  const phrases = [fact.topic, ...fact.triggerPhrases].map(normalizeCompactText).filter((item) => item.length > 0);
  return phrases.some(
    (phrase) =>
      normalizedCandidate === phrase ||
      normalizedCandidate.includes(phrase) ||
      phrase.includes(normalizedCandidate),
  );
};

type ExecutableTool = Tool & {
  execute?: (
    input: unknown,
    context?: { toolCallId: string; emitCustomEvent: (event: unknown) => void },
  ) => Promise<unknown>;
};

const extractFocusedReplyChatIds = (promptWindow: readonly TextOnlyModelMessage[]): Set<string> => {
  const chatIds = new Set<string>();
  for (const message of promptWindow) {
    const content = historyContentToText(message.content);
    if (!content.includes("chatFocused: true")) {
      continue;
    }
    for (const match of content.matchAll(/channelId:\s+([^\n]+)/g)) {
      const chatId = parseYamlScalarText(match[1] ?? "");
      if (chatId.length > 0) {
        chatIds.add(chatId);
      }
    }
  }
  return chatIds;
};

const extractFocusedTriggerPhrases = (
  promptWindow: readonly TextOnlyModelMessage[],
  focusedChatIds: ReadonlySet<string>,
): Map<string, string[]> => {
  const phrasesByChatId = new Map<string, string[]>();
  for (const message of promptWindow) {
    const content = historyContentToText(message.content);
    if (!content.includes("yaml+attention_items") || !content.includes("chatFocused: true")) {
      continue;
    }
    const chatIds = [...content.matchAll(/channelId:\s+([^\n]+)/g)]
      .map((match) => parseYamlScalarText(match[1] ?? ""))
      .filter((chatId) => chatId.length > 0 && (focusedChatIds.size === 0 || focusedChatIds.has(chatId)));
    if (chatIds.length === 0) {
      continue;
    }
    const phrases = [...content.matchAll(/content:\s+([^\n]+)/g)]
      .map((match) => parseYamlScalarText(match[1] ?? ""))
      .filter((phrase) => phrase.length > 0 && !isPromptWindowCommandText(phrase));
    if (phrases.length === 0) {
      continue;
    }
    for (const chatId of chatIds) {
      const current = phrasesByChatId.get(chatId) ?? [];
      for (const phrase of phrases) {
        pushUniqueCompactText(current, phrase);
      }
      phrasesByChatId.set(chatId, current);
    }
  }
  return phrasesByChatId;
};

const extractMessageSendReadyReplies = (
  promptWindow: readonly TextOnlyModelMessage[],
  focusedChatIds: ReadonlySet<string>,
): AgentPromptWindowReadyReply[] => {
  const readyReplies: AgentPromptWindowReadyReply[] = [];
  const triggerPhrasesByChatId = extractFocusedTriggerPhrases(promptWindow, focusedChatIds);
  for (const message of promptWindow) {
    const content = historyContentToText(message.content);
    if (!isPromptWindowToolTraceEntry(content) || !content.includes("tool: message_send")) {
      continue;
    }
    const inputSection = content.match(/\ninput:\n([\s\S]*?)\n(?:output|error):/);
    const chatId = parseYamlScalarText(inputSection?.[1]?.match(/^\s+chatId:\s+([^\n]+)$/m)?.[1] ?? "");
    if (focusedChatIds.size > 0 && !focusedChatIds.has(chatId)) {
      continue;
    }
    const reply = parseYamlScalarText(inputSection?.[1]?.match(/^\s+content:\s+([^\n]+)$/m)?.[1] ?? "");
    if (reply.length > 0) {
      const triggerPhrases = [...(triggerPhrasesByChatId.get(chatId) ?? [])];
      readyReplies.push({
        channelId: chatId,
        topic: triggerPhrases.at(-1) ?? reply,
        triggerPhrases,
        reply,
        reuseWhen:
          "If the same focused chat asks the same question again after compact, send this reply directly before lookup tools.",
      });
    }
  }
  return mergeReadyReplies(readyReplies);
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
        readyReplies: mergeReadyReplies(
          parsed.readyReplies.flatMap((item) => {
            const normalized = normalizeReadyReply(item);
            return normalized ? [normalized] : [];
          }),
        ),
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
    readyReplies: [],
    unresolvedWork: [],
    nextSteps: [],
    raw: value.trim(),
  };
};

export class AgenterAI {
  private pendingCompactTrigger: ChatCycleCompactTrigger | null = null;
  private statsListeners: Array<(stats: AgentRuntimeStats) => void> = [];
  private promptWindow: TextOnlyModelMessage[] = [];
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
      "Focus on stable decisions, key files, key facts, reusable ready replies, unresolved work, and next steps.",
      "If an earlier relay or lookup already produced a final user-visible answer, preserve it as a structured readyReplies fact.",
      "When a ready reply comes from an already-dispatched visible message, preserve the exact original reply text instead of paraphrasing or translating it.",
      "Each readyReplies fact must include channelId, topic, triggerPhrases, reply, and reuseWhen.",
      "readyReplies facts must make it obvious when a later follow-up can send the saved reply without reopening a resolved relay.",
      "Return strict JSON with keys:",
      "- overview: string",
      "- decisions: string[]",
      "- keyFiles: string[]",
      "- keyFacts: string[]",
      "- readyReplies: Array<{ channelId: string; topic: string; triggerPhrases: string[]; reply: string; reuseWhen: string }>",
      "- unresolvedWork: string[]",
      "- nextSteps: string[]",
    ].join("\n");
  }

  async runCompactCycle(input: { trigger: ChatCycleCompactTrigger; signal?: AbortSignal }): Promise<void> {
    const requestTimestamp = Date.now();
    const requestId = createId();
    const compactInput = this.buildCompactInput();
    const focusedChatIds = extractFocusedReplyChatIds(this.promptWindow);
    const derivedReadyReplies = extractMessageSendReadyReplies(this.promptWindow, focusedChatIds);
    const requestRecord = {
      systemPrompt: this.buildCompactSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [toTextPart(compactInput)],
        } satisfies TextOnlyModelMessage,
      ],
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
            messages: requestRecord.messages,
            tools: [],
            abortController,
          }),
      });
      const parsedSummary = parseCompactSummary(response.text);
      const summary = {
        ...parsedSummary,
        // Tool-derived replies are durable facts because they reflect exact user-visible
        // messages that were already dispatched. Keep them ahead of model paraphrases.
        readyReplies: mergeReadyReplies([...derivedReadyReplies, ...parsedSummary.readyReplies]),
      } satisfies AgentPromptWindowCompactSummary;
      this.lastCompactSummary = summary;
      this.rebuildPromptWindowFromCompact(summary);
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
            promptWindowSize: this.promptWindow.length,
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

  private getExecutableTool(tools: readonly Tool[], name: string): ExecutableTool | null {
    const tool = tools.find((entry) => entry.name === name);
    if (!tool || typeof (tool as ExecutableTool).execute !== "function") {
      return null;
    }
    return tool as ExecutableTool;
  }

  private async collectReadyReplyCandidates(message: LoopBusMessage): Promise<{
    channelId: string | null;
    contextId: string | null;
    parentCommitId: string | null;
    texts: string[];
  }> {
    const texts: string[] = [];
    if (message.source === "chat") {
      pushUniqueCompactText(texts, message.text);
      const channelId = typeof message.meta?.chatId === "string" ? message.meta.chatId : null;
      return {
        channelId,
        contextId: null,
        parentCommitId: null,
        texts,
      };
    }

    if (message.source !== "attention") {
      return {
        channelId: null,
        contextId: null,
        parentCommitId: null,
        texts,
      };
    }

    const contextId = typeof message.meta?.attentionContextId === "string" ? message.meta.attentionContextId : null;
    const channelId = typeof message.meta?.chatId === "string" ? message.meta.chatId : null;
    const headCommitId = typeof message.meta?.attentionHeadCommitId === "string" ? message.meta.attentionHeadCommitId : null;

    if (contextId) {
      const matches = await this.deps.attentionGateway.query({
        contextId,
        minScore: 1,
        limit: 20,
      });
      const headMatch =
        (headCommitId ? matches.find((match) => match.commit.commitId === headCommitId) : null) ?? matches.at(-1) ?? null;
      if (headMatch) {
        pushUniqueCompactText(texts, headMatch.commit.summary);
        pushUniqueCompactText(texts, headMatch.context.content);
        if (headMatch.commit.change.type !== "clean") {
          pushUniqueCompactText(texts, headMatch.commit.change.value);
        }
        if (typeof headMatch.commit.meta.content === "string") {
          pushUniqueCompactText(texts, headMatch.commit.meta.content);
        }
        return {
          channelId,
          contextId,
          parentCommitId: headMatch.commit.commitId,
          texts,
        };
      }
    }

    for (const match of message.text.matchAll(/summary:\s+([^\n]+)/g)) {
      pushUniqueCompactText(texts, parseYamlScalarText(match[1] ?? ""));
    }
    for (const match of message.text.matchAll(/content:\s+([^\n]+)/g)) {
      pushUniqueCompactText(texts, parseYamlScalarText(match[1] ?? ""));
    }
    return {
      channelId,
      contextId,
      parentCommitId: headCommitId,
      texts,
    };
  }

  private async tryResolveReadyReplyFastPath(input: {
    messages: readonly LoopBusMessage[];
    tools: readonly Tool[];
    attentionUpdates: AttentionUpdateCall[];
    toolTrace: AgentToolTraceEntry[];
  }): Promise<boolean> {
    const summary = this.lastCompactSummary;
    if (!summary || summary.readyReplies.length === 0 || summary.unresolvedWork.length > 0) {
      return false;
    }

    const messageSend = this.getExecutableTool(input.tools, "message_send");
    const attentionCommit = this.getExecutableTool(input.tools, "attention_commit");
    if (!messageSend || !attentionCommit) {
      return false;
    }

    for (const message of input.messages) {
      const candidate = await this.collectReadyReplyCandidates(message);
      if (!candidate.contextId || !candidate.channelId || candidate.texts.length === 0) {
        continue;
      }
      const fact =
        summary.readyReplies.find(
          (item) =>
            item.channelId === candidate.channelId &&
            candidate.texts.some((text) => matchesReadyReplyCandidate(text, item)),
        ) ?? null;
      if (!fact) {
        continue;
      }

      await messageSend.execute?.(
        {
          chatId: fact.channelId,
          content: fact.reply,
        },
        {
          toolCallId: `fastpath-message-send:${createId()}`,
          emitCustomEvent: () => {
            // no-op
          },
        },
      );
      await attentionCommit.execute?.(
        {
          contextId: candidate.contextId,
          parentCommitIds: candidate.parentCommitId ? [candidate.parentCommitId] : undefined,
          summary: `answered from compact memory: ${fact.reply}`,
          done: true,
        },
        {
          toolCallId: `fastpath-attention-commit:${createId()}`,
          emitCustomEvent: () => {
            // no-op
          },
        },
      );
      this.deps.logger.log({
        channel: "agent",
        level: "info",
        message: "prompt_window.ready_reply.fast_path",
        meta: {
          channelId: fact.channelId,
          contextId: candidate.contextId,
        },
      });
      this.pushAssistantTurnToPromptWindow({
        text: "",
        toolTrace: input.toolTrace,
        attentionUpdates: input.attentionUpdates,
      });
      return true;
    }

    return false;
  }

  async send(messages: LoopBusMessage[], context?: { signal?: AbortSignal }): Promise<void> {
    const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    if (orderedMessages.length === 0) {
      return;
    }
    this.stats.loops += 1;
    await this.pushIncomingBatchToPromptWindow(orderedMessages);

    const attentionRound = roundHasAttentionInput(orderedMessages);
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
    if (
      await this.tryResolveReadyReplyFastPath({
        messages: orderedMessages,
        tools,
        attentionUpdates,
        toolTrace,
      })
    ) {
      return;
    }

    const promptSnapshot = this.deps.promptStore.getSnapshot();
    const promptDocs = promptSnapshot.docs;
    const agenterSystem = await this.deps.promptStore.buildMd(promptDocs.AGENTER_SYSTEM);
    const agenter = await this.deps.promptStore.buildMd(promptDocs.AGENTER);
    const contract = await this.deps.promptStore.buildMd(promptDocs.RESPONSE_CONTRACT);
    const systemPrompt = await this.deps.promptStore.buildMd(promptDocs.SYSTEM_TEMPLATE, {
      slots: {
        AGENTER_SYSTEM: agenterSystem,
        AGENTER: agenter,
        RESPONSE_CONTRACT: contract,
          },
        });
    const promptWindowSnapshot = [...this.promptWindow];
    const contextChars = systemPrompt.length + JSON.stringify(promptWindowSnapshot).length;
    this.stats.lastContextChars = contextChars;
    this.stats.totalContextChars += contextChars;
    this.emitStats();

    const callId = createId();
    const requestRecord = {
      systemPrompt,
      messages: promptWindowSnapshot,
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

    try {
      const response = await this.withModelCallTimeout({
        signal: context?.signal,
        run: (abortController) =>
          this.deps.modelClient.respondWithMeta({
            systemPrompt,
            messages: promptWindowSnapshot,
            tools,
            abortController,
            onUpdate: async (update) => {
              await this.deps.onAssistantStream?.(update);
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
        return;
      }

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

      this.pushAssistantTurnToPromptWindow({
        text: normalizedResponseText.length > 0 && toolTrace.length === 0 && !attentionRound ? normalizedResponseText : "",
        toolTrace,
        attentionUpdates,
      });
      return;
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
      if (!aborted && contextOverflow) {
        this.queueCompactRequest("error");
        return;
      }
      if (aborted) {
        throw error;
      }
      this.deps.logger.log({
        channel: "error",
        level: "error",
        message: `agenter-ai failed: ${message}`,
      });
      return;
    }
  }

  private async persistModelCall(record: AgentModelCallRecord): Promise<void> {
    this.deps.sessionStore?.appendCall({
      ...record,
      timestamp: new Date(record.timestamp).toISOString(),
      completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : undefined,
    });
    await this.deps.onModelCall?.(record);
  }

  private async pushIncomingBatchToPromptWindow(messages: LoopBusMessage[]): Promise<void> {
    for (const message of messages) {
      this.promptWindow.push({
        role: "user",
        content: await this.formatUserMessage(message),
      });
    }
    this.trimPromptWindow();
  }

  private pushAssistantTurnToPromptWindow(input: {
    attentionUpdates: readonly AttentionUpdateCall[];
    toolTrace: readonly AgentToolTraceEntry[];
    text: string;
  }): void {
    const normalizedText = input.text.trim();
    if (normalizedText.length > 0) {
      this.promptWindow.push({
        role: "assistant",
        content: [toTextPart(normalizedText)],
      });
    }
    for (const tool of input.toolTrace) {
      this.promptWindow.push({
        role: "assistant",
        content: [toTextPart(buildToolInvocationContent(tool))],
      });
    }
    const attentionMessage = this.buildAttentionCommitPromptWindowMessage(input.attentionUpdates);
    if (attentionMessage) {
      this.promptWindow.push(attentionMessage);
    }
    this.trimPromptWindow();
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
              scores: commit.scores,
              summary: commit.summary,
              change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
            })),
          })),
        )}`;
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
              readyReplies: summary.readyReplies.map((item) => ({
                channelId: item.channelId,
                topic: item.topic,
                triggerPhrases: item.triggerPhrases,
                reply: item.reply,
                reuseWhen: item.reuseWhen,
              })),
              unresolvedWork: summary.unresolvedWork,
              nextSteps: summary.nextSteps,
            }),
          ),
        ),
      ],
    };
  }

  private buildCompactReadyRepliesPromptWindowMessage(summary: AgentPromptWindowCompactSummary): TextOnlyModelMessage | null {
    if (summary.readyReplies.length === 0) {
      return null;
    }
    return {
      role: "assistant",
      content: [
        toTextPart(
          mdFence(
            "yaml+ready_replies",
            toYaml({
              mustSendBeforeLookup: true,
              facts: summary.readyReplies.map((item) => ({
                channelId: item.channelId,
                topic: item.topic,
                triggerPhrases: item.triggerPhrases,
                reply: item.reply,
                reuseWhen: item.reuseWhen,
              })),
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
                  summary: commit.summary,
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

  private rebuildPromptWindowFromCompact(summary: AgentPromptWindowCompactSummary): void {
    this.lastCompactSummary = summary;
    const nextPromptWindow: TextOnlyModelMessage[] = [this.buildCompactSummaryPromptWindowMessage(summary)];
    const readyReplies = this.buildCompactReadyRepliesPromptWindowMessage(summary);
    if (readyReplies) {
      nextPromptWindow.push(readyReplies);
    }
    const activeAttention = this.buildActiveAttentionPromptWindowMessage();
    if (activeAttention) {
      nextPromptWindow.push(activeAttention);
    }
    this.promptWindow = nextPromptWindow;
    this.trimPromptWindow();
  }

  private async formatUserMessage(message: LoopBusMessage): Promise<ContentPart[]> {
    const header = `### ${message.name}`;
    if (message.source === "chat") {
      const attachmentFacts: string[] = [];
      const parts: ContentPart[] = [toTextPart([header, message.text].filter((item) => item.length > 0).join("\n\n"))];
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
          [header, message.text, "attachments:", ...attachmentFacts].filter((item) => item.length > 0).join("\n\n"),
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

  private trimPromptWindow(): void {
    if (this.promptWindow.length <= MAX_HISTORY_MESSAGES) {
      return;
    }
    this.promptWindow = this.promptWindow.slice(this.promptWindow.length - MAX_HISTORY_MESSAGES);
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
        replyTarget: z
          .object({
            systemId: z.string().min(1),
            subjectId: z.string().min(1),
            channelId: z.string().optional(),
            rootId: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .passthrough()
          .optional(),
        tags: z.array(z.string()).optional(),
        createdAt: z.string().optional(),
      })
      .passthrough();

    const attentionCommitToolMetaSchema = z
      .object({
        author: z.string().min(1).optional(),
        source: z.string().min(1).optional(),
        systemId: z.string().optional(),
        subjectId: z.string().optional(),
        channelId: z.string().optional(),
        replyTarget: z
          .object({
            systemId: z.string().min(1),
            subjectId: z.string().min(1),
            channelId: z.string().optional(),
            rootId: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .passthrough()
          .optional(),
        tags: z.array(z.string()).optional(),
        createdAt: z.string().optional(),
      })
      .passthrough();

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
        scores: z.record(z.string(), z.number()),
        summary: z.string(),
        change: attentionCommitChangeSchema,
        createdAt: z.string(),
      }),
    });

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
        contextId: z.string().optional(),
        hash: z.string().optional(),
        depth: z.number().int().min(0).max(8).optional(),
        author: z.string().optional(),
        source: z.string().optional(),
        text: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        minScore: z.number().int().min(0).max(100).optional(),
      }),
      outputSchema: z.object({
        items: z.array(attentionMatchSchema),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          contextId: z.string().optional(),
          hash: z.string().optional(),
          depth: z.number().int().min(0).max(8).optional(),
          author: z.string().optional(),
          source: z.string().optional(),
          text: z.string().optional(),
          offset: z.number().int().min(0).optional(),
          limit: z.number().int().min(1).max(200).optional(),
          minScore: z.number().int().min(0).max(100).optional(),
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
      const effectiveScores =
        input.scores ??
        (input.done
          ? (() => {
              const activeContext = this.deps.attentionGateway
                .listActive()
                .find((item) => item.contextId === input.contextId);
              if (!activeContext) {
                return undefined;
              }
              const activeScores = Object.entries(activeContext.context.scoreMap).filter(([, value]) => value > 0);
              if (activeScores.length === 0) {
                return {};
              }
              return Object.fromEntries(activeScores.map(([hash]) => [hash, 0]));
            })()
          : undefined);
      const effectiveInput = {
        contextId: input.contextId,
        parentCommitIds: input.parentCommitIds,
        meta: input.meta,
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

    const externalTools = (this.deps.toolProviders ?? []).flatMap((provider) =>
      provider.createTools({
        runtimeText: this.runtimeText,
        signal,
        traceTool,
      }),
    );

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
