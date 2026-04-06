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
import type { SessionStore } from "./session-store";
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

export interface AgentToolProviderPromptContext {
  readonly runtimeText: ReturnType<typeof createRuntimeText>;
  readonly locale?: string;
}

export interface AgentToolProvider {
  readonly name: string;
  buildSystemPromptSection?: (
    context: AgentToolProviderPromptContext,
  ) => Promise<string | null | undefined> | string | null | undefined;
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
  avatarName?: string;
  locale?: string;
  attentionGateway: AttentionGateway;
  toolProviders?: AgentToolProvider[];
  sessionStore?: SessionStore;
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
const DEFAULT_MODEL_CALL_TIMEOUT_MS = 120_000;
const MAX_EXTERNAL_MODEL_ROUNDS = 8;
const DEFAULT_AVATAR_PROMPT_NAME = "agenter-ai";
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

const normalizeCompactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const isPromptWindowCommandText = (value: string): boolean => value.startsWith("/");

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

  private async buildProviderOwnedSystemGuide(): Promise<string> {
    const sections = await Promise.all(
      (this.deps.toolProviders ?? []).map(async (provider) => {
        const section = await provider.buildSystemPromptSection?.({
          runtimeText: this.runtimeText,
          locale: this.deps.locale,
        });
        return typeof section === "string" ? section.trim() : "";
      }),
    );
    return joinPromptSections(sections);
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
    const compactInput = this.buildCompactInput();
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
        return;
      }
      roundMessages = result.interleavedMessages;
      if (roundMessages.length > 0) {
        await this.pushIncomingBatchToPromptWindow(roundMessages);
      }
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
    const agenter = await this.deps.promptStore.buildMd(promptDocs.AGENTER, {
      slots: sharedPromptSlots,
    });
    const contract = await this.deps.promptStore.buildMd(promptDocs.RESPONSE_CONTRACT);
    const systemsGuide = await this.buildProviderOwnedSystemGuide();
    const templateHasSystemsGuideSlot = promptDocs.SYSTEM_TEMPLATE.content.includes('name="SYSTEMS_GUIDE"');
    const systemPrompt = await this.deps.promptStore.buildMd(promptDocs.SYSTEM_TEMPLATE, {
      slots: {
        AGENTER_SYSTEM:
          templateHasSystemsGuideSlot || systemsGuide.length === 0
            ? agenterSystem
            : joinPromptSections([agenterSystem, systemsGuide]),
        SYSTEMS_GUIDE: systemsGuide,
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
      const continueFromToolPhase = response.finishReason === "tool_calls";
      return {
        continueModelRound: continueFromToolPhase || interleavedMessages.length > 0,
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
      if (!aborted && contextOverflow) {
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
