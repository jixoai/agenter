import type {
  AttentionActiveContextMatch,
  AttentionCommit,
  AttentionCommitChange,
  AttentionCommitMeta,
  AttentionCommitToolInput,
  AttentionContextDescriptor,
  AttentionCommitMatch,
  AttentionQueryInput,
} from "@agenter/attention-system";
import type { SessionTerminalOutcome } from "@agenter/session-system";
import { mdxToMd } from "@agenter/mdx2md";
import type {
  TaskCreateInput,
  TaskDoneResult,
  TaskEventInput,
  TaskImportItem,
  TaskImportResult,
  TaskSourceName,
  TaskUpdateInput,
  TaskView,
} from "@agenter/task-system";
import type {
  TerminalControlPlaneConfig,
  TerminalControlPlaneConfigPatch,
  TerminalControlPlaneEntry,
  TerminalProcessProfile,
} from "@agenter/terminal-system";
import { toolDefinition, type ContentPart, type Tool } from "@tanstack/ai";
import { z } from "zod";

import type { LoopBusMessage, LoopBusResponse } from "./loop-bus";
import type { AssistantStreamUpdate, ModelClient, TextOnlyModelMessage } from "./model-client";
import { ModelDecisionError } from "./model-client";
import { projectAttentionCommitMatchForModel } from "./attention-model-view";
import type { PromptStore } from "./prompt-store";
import { createRuntimeText } from "./runtime-text";
import type { SessionStore } from "./session-store";
import type { AppServerLogger, ChatMessage, ChatSessionAsset, TaskEvent, TaskStage } from "./types";
import { mapAbortReasonToOutcome, toTerminalOutcomeFromError } from "./runtime-trace";

interface TerminalDescriptor {
  terminalId: string;
  running: boolean;
  cwd?: string;
  cols: number;
  rows: number;
  focused?: boolean;
  dirty?: boolean;
  latestSeq?: number;
  icon?: string;
  title?: string;
  shortcuts?: Record<string, string>;
  transportUrl?: string;
}

interface TerminalCreateToolInput {
  terminalId?: string;
  processKind?: string;
  command?: string[];
  cwd?: string;
  profile?: TerminalProcessProfile;
}

interface TerminalWriteToolInput {
  terminalId: string;
  text: string;
  submit?: boolean;
  submitKey?: "enter" | "linefeed";
}

interface TerminalReadInput {
  terminalId: string;
  mode?: "auto" | "diff" | "snapshot";
}

interface TerminalFocusInput {
  op?: "add" | "remove" | "replace" | "clear";
  terminalIds?: string[];
}

interface TerminalGateway {
  list: () => TerminalDescriptor[];
  create: (input: TerminalCreateToolInput) => Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }>;
  kill: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  focus: (input: TerminalFocusInput) => Promise<{ ok: boolean; message: string; focusedTerminalIds?: string[] }>;
  write: (input: TerminalWriteToolInput) => Promise<{ ok: boolean; message: string }>;
  read: (input: TerminalReadInput) => Promise<unknown>;
  snapshot: (input: { terminalId: string }) => Promise<unknown>;
  getConfig: () => Promise<TerminalControlPlaneConfig> | TerminalControlPlaneConfig;
  setConfig: (input: { patch: TerminalControlPlaneConfigPatch }) => Promise<TerminalControlPlaneConfig> | TerminalControlPlaneConfig;
}

interface TaskGateway {
  list: () => TaskView[];
  get: (input: { source: TaskSourceName; id: string }) => TaskView | undefined;
  create: (input: TaskCreateInput) => TaskView;
  update: (input: TaskUpdateInput) => TaskView;
  done: (input: { source: TaskSourceName; id: string }) => TaskDoneResult;
  addDependency: (input: { source: TaskSourceName; id: string; target: string }) => TaskView;
  removeDependency: (input: { source: TaskSourceName; id: string; target: string }) => TaskView;
  triggerManual: (input: { source: TaskSourceName; id: string }) => TaskView | undefined;
  emitEvent: (input: TaskEventInput) => {
    topic: string;
    source: "api" | "file" | "scheduler" | "tool";
    affected: TaskView[];
  };
  import: (items: TaskImportItem[]) => TaskImportResult;
}

interface AttentionGateway {
  listContexts: () => AttentionContextDescriptor[];
  listActive: () => AttentionActiveContextMatch[];
  query: (input: AttentionQueryInput) => Promise<AttentionCommitMatch[]> | AttentionCommitMatch[];
  commit: (input: AttentionCommitToolInput) => Promise<AttentionCommit> | AttentionCommit;
}

interface MessageGateway {
  send: (input: {
    chatId: string;
    content: string;
    rootId?: string;
    from?: string;
    to?: string;
  }) => Promise<{ ok: boolean; messageId: string }> | { ok: boolean; messageId: string };
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
  terminalGateway: TerminalGateway;
  taskGateway: TaskGateway;
  attentionGateway: AttentionGateway;
  messageGateway?: MessageGateway;
  sessionStore?: SessionStore;
  resolveImageAttachment?: (
    attachment: ChatSessionAsset,
  ) => Promise<ResolvedImageAttachmentSource | null> | ResolvedImageAttachmentSource | null;
  onAssistantStream?: (update: AssistantStreamUpdate) => Promise<void> | void;
  onAssistantLiveMessage?: (message: ChatMessage) => Promise<void> | void;
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
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      timestamp: string;
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

interface ActiveTask {
  id: string;
  steps: number;
}

interface ToolTraceEntry {
  tool: string;
  input: unknown;
  output?: unknown;
  error?: string;
  timestamp: string;
}

interface AttentionUpdateCall {
  contextId: string;
  commitId: string;
  text: string;
  author: string;
  scores: Record<string, number>;
  done: boolean;
  stage?: TaskStage;
}

interface AssistantFact {
  content: string;
  channel?: ChatMessage["channel"];
  format?: ChatMessage["format"];
  tool?: ChatMessage["tool"];
}

interface TerminalHelpDocument {
  syntax: "md" | "mdx";
  content: string;
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
const MAX_TERMINAL_DIFF_CHARS = 6_000;
const MAX_TERMINAL_SNAPSHOT_LINES = 16;
const ENABLE_AGENT_TOOLS = true;
const DEFAULT_MODEL_CALL_TIMEOUT_MS = 120_000;
const MAX_ATTENTION_NO_PROGRESS_ATTEMPTS = 2;

const safeJsonParse = (input: string): unknown => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" || error.message === "This operation was aborted"
      : false;

const createAbortError = (reason?: unknown): DOMException =>
  new DOMException(typeof reason === "string" && reason.length > 0 ? reason : "This operation was aborted", "AbortError");

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

const compactSnapshotTail = (tail: string): string => {
  const trimmed = tail.split(/\r?\n/g).map((line) => line.replace(/\s+$/g, ""));
  const compacted = trimmed.filter((line) => line.length > 0);
  if (compacted.length === 0) {
    return "";
  }
  return compacted.slice(-MAX_TERMINAL_SNAPSHOT_LINES).join("\n");
};

const inferStageFromToolTrace = (trace: ToolTraceEntry[]): TaskStage => {
  if (trace.some((entry) => entry.tool === "terminal_write")) {
    return "act";
  }
  if (
    trace.some((entry) =>
      ["terminal_read", "terminal_snapshot", "terminal_create", "terminal_list", "terminal_get_config"].includes(
        entry.tool,
      ),
    )
  ) {
    return "observe";
  }
  if (trace.length > 0) {
    return "decide";
  }
  return "decide";
};

const roundHasAttentionInput = (messages: readonly LoopBusMessage[]): boolean =>
  messages.some((message) => message.source === "attention");

const isAttentionMutationTool = (toolName: string): boolean =>
  toolName === "attention_commit";

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readStringField = (value: unknown, key: string): string | undefined => {
  const record = readRecord(value);
  const raw = record?.[key];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
};

const readNumericRecord = (value: unknown): Record<string, number> => {
  const record = readRecord(value);
  if (!record) {
    return {};
  }
  const scores: Record<string, number> = {};
  for (const [key, score] of Object.entries(record)) {
    if (typeof score === "number" && Number.isFinite(score)) {
      scores[key] = score;
    }
  }
  return scores;
};

const contextIdToChatId = (contextId: string | undefined): string | undefined => {
  if (!contextId) {
    return undefined;
  }
  if (contextId.startsWith("ctx-chat-") || contextId.startsWith("ctx-room-")) {
    return contextId.slice(4);
  }
  return undefined;
};

const readReplyTargetChatId = (value: unknown): string | undefined => {
  const replyTarget = readRecord(value);
  if (replyTarget?.systemId !== "message") {
    return undefined;
  }
  return readStringField(replyTarget, "channelId") ?? readStringField(replyTarget, "subjectId");
};

const readAttentionCommitChatId = (input: unknown): string | undefined => {
  const record = readRecord(input);
  const meta = readRecord(record?.meta);
  if (meta?.systemId === "message") {
    return readStringField(meta, "channelId") ?? readStringField(meta, "subjectId") ?? contextIdToChatId(readStringField(record, "contextId"));
  }
  return contextIdToChatId(readStringField(record, "contextId"));
};

const attentionCommitResolvesWork = (input: unknown): boolean => {
  const record = readRecord(input);
  if (record?.done === true) {
    return true;
  }
  const scores = readNumericRecord(record?.scores);
  return Object.keys(scores).length > 0 && Object.values(scores).every((value) => value <= 0);
};

const collectRequiredMessageDispatchChatIds = (messages: readonly LoopBusMessage[]): string[] => {
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.source !== "attention") {
      continue;
    }
    const chatId = typeof message.meta?.chatId === "string" ? message.meta.chatId : undefined;
    const chatFocused = typeof message.meta?.chatFocused === "boolean" ? message.meta.chatFocused : true;
    if (chatId && chatFocused) {
      ids.add(chatId);
    }
  }
  return [...ids];
};

const collectMessageDispatchChatIds = (toolTrace: readonly ToolTraceEntry[]): Set<string> => {
  const ids = new Set<string>();
  for (const entry of toolTrace) {
    if (entry.tool === "message_send") {
      const chatId = readStringField(entry.input, "chatId");
      if (chatId) {
        ids.add(chatId);
      }
      continue;
    }
    if (entry.tool !== "attention_commit") {
      continue;
    }
    const replyChatId = readReplyTargetChatId(readRecord(readRecord(entry.input)?.meta)?.replyTarget);
    if (replyChatId) {
      ids.add(replyChatId);
    }
  }
  return ids;
};

const findMissingMessageDispatchChatIds = (
  messages: readonly LoopBusMessage[],
  toolTrace: readonly ToolTraceEntry[],
): string[] => {
  const requiredChatIds = new Set(collectRequiredMessageDispatchChatIds(messages));
  if (requiredChatIds.size === 0) {
    return [];
  }
  const dispatchedChatIds = collectMessageDispatchChatIds(toolTrace);
  const missing = new Set<string>();
  for (const entry of toolTrace) {
    if (entry.tool !== "attention_commit" || !attentionCommitResolvesWork(entry.input)) {
      continue;
    }
    const chatId = readAttentionCommitChatId(entry.input);
    if (!chatId || !requiredChatIds.has(chatId) || dispatchedChatIds.has(chatId)) {
      continue;
    }
    missing.add(chatId);
  }
  return [...missing];
};

const buildAttentionNoProgressReminder = (attempt: number): TextOnlyModelMessage => ({
  role: "user",
  content: [
    toTextPart(
      [
        `attention_round_retry: ${attempt}`,
        "The previous attention round made no progress.",
        "Every attention round must end with an attention_commit.",
        "Tool calls without an attention commit are still incomplete.",
        "If the work is complete, commit the relevant scores to 0.",
        "Do not reply with plain text only.",
      ].join("\n"),
    ),
  ],
});

const buildAttentionMessageDispatchReminder = (attempt: number, chatIds: string[]): TextOnlyModelMessage => ({
  role: "user",
  content: [
    toTextPart(
      [
        `attention_round_retry: ${attempt}`,
        "The previous attention round resolved chat-backed work without dispatching the visible reply.",
        `Missing visible dispatch target(s): ${chatIds.join(", ")}`,
        "Before setting a chat-backed attention score to 0, you must either:",
        "- call message_send to the target chat channel, or",
        "- set attention_commit.meta.replyTarget for that chat channel.",
        "attention_commit alone does not count as a user-visible reply.",
      ].join("\n"),
    ),
  ],
});

export class AgenterAI {
  private eventListeners: Array<(event: TaskEvent) => void> = [];
  private statsListeners: Array<(stats: AgentRuntimeStats) => void> = [];
  private activeTask: ActiveTask | null = null;
  private history: TextOnlyModelMessage[] = [];
  private compactPending = false;
  private compactForced = false;
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

  private async withModelCallTimeout<T>(
    input: {
      signal?: AbortSignal;
      run: (abortController: AbortController) => Promise<T>;
    },
  ): Promise<T> {
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
    this.compactPending = true;
    this.compactForced = true;
    this.deps.logger.log({
      channel: "agent",
      level: "info",
      message: "history.compact.requested",
      meta: {
        reason,
      },
    });
  }

  onTaskEvent(listener: (event: TaskEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((it) => it !== listener);
    };
  }

  onStats(listener: (stats: AgentRuntimeStats) => void): () => void {
    this.statsListeners.push(listener);
    listener(this.stats);
    return () => {
      this.statsListeners = this.statsListeners.filter((it) => it !== listener);
    };
  }

  inspectDebugState(): { history: TextOnlyModelMessage[]; stats: AgentRuntimeStats } {
    return {
      history: structuredClone(this.history),
      stats: { ...this.stats },
    };
  }

  async send(
    messages: LoopBusMessage[],
    context?: { signal?: AbortSignal },
  ): Promise<LoopBusResponse<ChatMessage, TaskStage> | void> {
    const orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    if (orderedMessages.length === 0) {
      return;
    }
    this.stats.loops += 1;

    if (this.activeTask === null) {
      this.activeTask = { id: createId(), steps: 0 };
      this.emitTask(this.activeTask.id, "plan", this.runtimeText.t("task.plan.start"));
    }

    const taskId = this.activeTask.id;
    const incomingHistoryMessage = await this.pushIncomingBatchToHistory(orderedMessages);
    await this.maybeCompactHistory(taskId);

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
    const attentionRound = roundHasAttentionInput(orderedMessages);
    const baseHistorySnapshot = attentionRound ? [incomingHistoryMessage] : [...this.history];
    const maxAttempts = attentionRound ? MAX_ATTENTION_NO_PROGRESS_ATTEMPTS : 1;
    let attempt = 0;
    let retryReminder: TextOnlyModelMessage | null = null;

    while (attempt < maxAttempts) {
      const toolTrace: ToolTraceEntry[] = [];
      const attentionUpdates: AttentionUpdateCall[] = [];
      const tools = ENABLE_AGENT_TOOLS
        ? this.buildTools(taskId, toolTrace, {
            onAttentionUpdate: (update) => {
              attentionUpdates.push(update);
            },
          }, context?.signal)
        : [];
      const historySnapshot = retryReminder ? [...baseHistorySnapshot, retryReminder] : baseHistorySnapshot;
      const contextChars = systemPrompt.length + JSON.stringify(historySnapshot).length;
      this.stats.lastContextChars = contextChars;
      this.stats.totalContextChars += contextChars;
      this.emitStats();

      const callId = createId();
      const requestRecord = {
        systemPrompt,
        messages: historySnapshot,
        tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
        meta: {
          taskId,
          loopCount: this.stats.loops,
          historySize: historySnapshot.length,
          attempt: attempt + 1,
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
              messages: historySnapshot,
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
            this.compactPending = true;
          }
        }
        this.emitStats();

        const normalizedResponseText = response.text.trim();
        const attentionMutation = attentionUpdates.length > 0;
        const invalidAttentionNoProgress = attentionRound && !attentionMutation;
        const missingMessageDispatchChatIds = attentionRound ? findMissingMessageDispatchChatIds(orderedMessages, toolTrace) : [];
        const invalidAttentionMessageDispatch = attentionRound && missingMessageDispatchChatIds.length > 0;
        const suppressUserFacingReply = attentionRound || attentionMutation;
        const discardAssistantFacts = invalidAttentionNoProgress || invalidAttentionMessageDispatch;
        const decisionToUser =
          normalizedResponseText.length > 0 && !suppressUserFacingReply ? [normalizedResponseText] : [];
        const stage = attentionUpdates[attentionUpdates.length - 1]?.stage ?? inferStageFromToolTrace(toolTrace);
        const done = attentionUpdates.some((item) => item.done) || stage === "done";
        const completedAt = Date.now();

        if (invalidAttentionNoProgress || invalidAttentionMessageDispatch) {
          const reason = invalidAttentionMessageDispatch ? "attention.missing_message_dispatch" : "attention.no_progress";
          const message = invalidAttentionMessageDispatch
            ? `attention round resolved chat-backed work without visible dispatch: ${missingMessageDispatchChatIds.join(", ")}`
            : "attention round made no progress";
          const retryable = attempt + 1 < maxAttempts;
          retryReminder = invalidAttentionMessageDispatch
            ? buildAttentionMessageDispatchReminder(attempt + 1, missingMessageDispatchChatIds)
            : buildAttentionNoProgressReminder(attempt + 1);
          await this.persistModelCall({
            ...callRecordBase,
            status: "error",
            completedAt,
            outcome: {
              code: "error",
              message,
              reason,
              retryable,
            },
            response: {
              decision: {
                stage,
                done: false,
                toUser: [],
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
              name: "AttentionNoProgressError",
              details: {
                attempt: attempt + 1,
                retrying: retryable,
              },
            },
          });
          this.compactPending = true;

          if (retryable) {
            attempt += 1;
            continue;
          }

          const summary = this.resolveTaskSummary({
            stage,
            done: false,
            attentionUpdates,
            text: "",
            thinking: response.thinking,
          });
          this.emitTask(taskId, stage, summary);
          return {
            taskId,
            stage,
            done: false,
            summary,
            outputs: {
              toUser: [],
              toTerminal: [],
              toTools: [],
            },
          };
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
              stage,
              done,
              toUser: decisionToUser,
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

        const assistantFacts = this.buildAssistantFacts({
          thinking: response.thinking,
          text: response.text,
          toolTrace,
          attentionUpdates,
        });
        const publishedAssistantFacts = this.selectPublishedAssistantFacts(assistantFacts, {
          suppressUserFacingReply,
          discardAll: discardAssistantFacts,
        });
        this.pushAssistantTurnToHistory(
          this.selectPublishedAssistantFacts(assistantFacts, {
            suppressUserFacingReply: suppressUserFacingReply || discardAssistantFacts,
            discardAll: discardAssistantFacts,
          }),
        );

        const summary = this.resolveTaskSummary({
          stage,
          done,
          attentionUpdates,
          text: suppressUserFacingReply || discardAssistantFacts ? "" : response.text,
          thinking: response.thinking,
        });

        this.emitTask(taskId, stage, summary);
        if (done) {
          this.activeTask = null;
        }

        return {
          taskId,
          stage,
          done,
          summary,
          outputs: {
            toUser: this.composeAssistantMessages(publishedAssistantFacts),
            toTerminal: [],
            toTools: [],
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const name = error instanceof Error ? error.name : "Error";
        const stack = error instanceof Error ? error.stack : undefined;
        const aborted = isAbortError(error);
        const timeout = message.includes("timed out after");
        const outcome =
          aborted
            ? mapAbortReasonToOutcome(context?.signal?.reason ?? error)
            : timeout
              ? {
                  code: "timeout" as const,
                  message,
                  reason: "model.timeout",
                  retryable: true,
                  error: error instanceof Error ? { name, message, stack } : error,
                }
              : toTerminalOutcomeFromError(error);
        const details =
          aborted
            ? { canceled: true }
            : error instanceof ModelDecisionError
              ? { retried: true }
              : timeout
                ? { timeout: true }
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
        this.activeTask = null;
        if (aborted) {
          throw error;
        }
        this.deps.logger.log({
          channel: "error",
          level: "error",
          message: `agenter-ai failed: ${message}`,
        });
        const summary = this.runtimeText.t("ai.call_failed", { message });
        const failureFacts: AssistantFact[] = [
          {
            content: summary,
            channel: "to_user",
            format: "markdown",
          },
        ];
        this.pushAssistantTurnToHistory(failureFacts);
        return {
          taskId,
          stage: "error",
          done: true,
          summary,
          outputs: {
            toUser: this.composeAssistantMessages(failureFacts),
            toTerminal: [],
            toTools: [],
          },
        };
      }
    }

    return;
  }

  private buildAssistantFacts(input: {
    attentionUpdates: AttentionUpdateCall[];
    thinking: string;
    toolTrace: ToolTraceEntry[];
    text?: string;
  }): AssistantFact[] {
    const result: AssistantFact[] = [];
    const normalizedThinking = input.thinking.trim();
    const normalizedText = input.text?.trim() ?? "";

    if (normalizedThinking.length > 0) {
      result.push({
        content: normalizedThinking,
        channel: "self_talk",
        format: "markdown",
      });
    }

    if (normalizedText.length > 0) {
      result.push({
        content: normalizedText,
        channel: "to_user",
        format: "markdown",
      });
    }

    for (const tool of input.toolTrace) {
      result.push({
        content: mdFence(
          "yaml+tool_call",
          toYaml({
            tool: tool.tool,
            input: tool.input,
            timestamp: tool.timestamp,
          }),
        ),
        channel: "tool_call",
        format: "markdown",
        tool: { name: tool.tool },
      });

      if (tool.output !== undefined || tool.error !== undefined) {
        result.push({
          content: mdFence(
            "yaml+tool_result",
            toYaml({
              tool: tool.tool,
              ok: tool.error === undefined,
              output: tool.output ?? null,
              error: tool.error ?? null,
              timestamp: tool.timestamp,
            }),
          ),
          channel: "tool_result",
          format: "markdown",
          tool: { name: tool.tool, ok: tool.error === undefined },
        });
      }
    }

    return result;
  }

  private selectPublishedAssistantFacts(
    facts: readonly AssistantFact[],
    input: {
      suppressUserFacingReply: boolean;
      discardAll?: boolean;
    },
  ): AssistantFact[] {
    if (input.discardAll) {
      return [];
    }
    if (!input.suppressUserFacingReply) {
      return [...facts];
    }
    return facts.filter((fact) => fact.channel !== "to_user");
  }

  private composeAssistantMessages(facts: readonly AssistantFact[]): ChatMessage[] {
    return facts.map((fact) =>
      this.createAssistantMessage(fact.content, {
        channel: fact.channel,
        format: fact.format,
        tool: fact.tool,
      }),
    );
  }

  private async persistModelCall(record: AgentModelCallRecord): Promise<void> {
    this.deps.sessionStore?.appendCall({
      ...record,
      timestamp: new Date(record.timestamp).toISOString(),
      completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : undefined,
    });
    await this.deps.onModelCall?.(record);
  }

  private async pushIncomingBatchToHistory(messages: LoopBusMessage[]): Promise<TextOnlyModelMessage> {
    const rendered = await Promise.all(messages.map((message) => this.formatUserMessage(message)));
    const content: ContentPart[] = [];
    rendered.forEach((parts, index) => {
      if (index > 0) {
        content.push(toTextPart("\n\n---\n\n"));
      }
      content.push(...parts);
    });
    const historyMessage: TextOnlyModelMessage = {
      role: "user",
      content,
    };
    this.history.push(historyMessage);
    this.trimHistory();
    return historyMessage;
  }

  private pushAssistantTurnToHistory(facts: readonly AssistantFact[]): void {
    if (facts.length === 0) {
      return;
    }

    for (const fact of facts) {
      this.history.push({
        role: "assistant",
        content: [toTextPart(fact.content)],
      });
    }

    this.trimHistory();
  }

  private async maybeCompactHistory(taskId: string): Promise<void> {
    const minimumHistory = this.compactForced ? 2 : 8;
    if (!this.compactPending || this.history.length < minimumHistory) {
      return;
    }
    const attentionFacts = this.deps.attentionGateway.listActive();
    const historyText = this.history
      .map((item, index) => {
        const content = historyContentToText(item.content);
        return `# ${index + 1} ${item.role}\n${content}`;
      })
      .join("\n\n");

    const compactInput =
      attentionFacts.length === 0
        ? historyText
        : `${historyText}\n\n# attention_system\n${JSON.stringify(
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
    const compact = await this.deps.modelClient.summarizeText(compactInput);
    if (!compact.summary || compact.summary.trim().length === 0) {
      this.deps.logger.log({
        channel: "agent",
        level: "warn",
        message: "history.compact.skipped",
        meta: {
          reason: compact.skipped ?? "empty-summary",
          taskId,
        },
      });
      this.compactPending = false;
      this.compactForced = false;
      return;
    }
    this.history = [
      {
        role: "assistant",
        content: [toTextPart(`history_summary:\n${compact.summary.trim()}`)],
      },
      ...this.history.slice(-12),
    ];
    this.trimHistory();
    this.compactPending = false;
    this.compactForced = false;
    this.deps.logger.log({
      channel: "agent",
      level: "info",
      message: "history.compact.done",
      meta: {
        taskId,
        chars: compact.summary.length,
      },
    });
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
        attachmentFacts.push(`- ${attachment.kind}: ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`);
      }
      if (attachmentFacts.length > 0) {
        parts[0] = toTextPart([header, message.text, "attachments:", ...attachmentFacts].filter((item) => item.length > 0).join("\n\n"));
      }
      return parts;
    }
    if (message.source === "terminal") {
      return [toTextPart([header, await this.formatTerminalMessage(message.text)].join("\n\n"))];
    }
    if (message.source === "task") {
      return [toTextPart([header, mdFence("yaml", message.text)].join("\n\n"))];
    }
    if (message.source === "attention") {
      return [toTextPart([header, message.text].join("\n\n"))];
    }

    const metaYaml = toYaml({
      source: message.source,
      timestamp: formatTimestamp(message.timestamp),
      ...(message.meta ?? {}),
    });
    return [toTextPart([header, mdFence("yaml", metaYaml), mdFence("text", message.text)].join("\n\n"))];
  }

  private async formatTerminalMessage(text: string): Promise<string> {
    const parsed = safeJsonParse(text);
    if (typeof parsed === "string") {
      return mdFence("text", parsed);
    }
    if (!parsed || typeof parsed !== "object") {
      return mdFence("text", String(text));
    }

    const payload = parsed as Record<string, unknown>;
    const kind = typeof payload.kind === "string" ? payload.kind : "terminal-event";

    if (kind === "terminal-diff") {
      const diff = typeof payload.diff === "string" ? payload.diff : "";
      const compactDiff =
        diff.length > MAX_TERMINAL_DIFF_CHARS
          ? `${diff.slice(0, MAX_TERMINAL_DIFF_CHARS)}\n... [truncated ${diff.length - MAX_TERMINAL_DIFF_CHARS} chars]`
          : diff;
      const metaYaml = toYaml({
        kind,
        terminalId: payload.terminalId ?? "unknown",
        status: payload.status ?? "unknown",
        fromHash: payload.fromHash ?? null,
        toHash: payload.toHash ?? null,
        bytes: payload.bytes ?? 0,
        truncated: diff.length > MAX_TERMINAL_DIFF_CHARS,
      });
      return [mdFence("yaml", metaYaml), mdFence("diff", compactDiff)].join("\n\n");
    }

    if (kind === "terminal-dirty-summary") {
      const metaYaml = toYaml({
        kind,
        terminalId: payload.terminalId ?? "unknown",
        focused: payload.focused ?? false,
        dirty: payload.dirty ?? true,
        seq: payload.seq ?? 0,
        status: payload.status ?? "unknown",
        hint: "call terminal_read if an explicit terminal inspection is needed",
      });
      return mdFence("yaml", metaYaml);
    }

    if (kind === "terminal-snapshot") {
      const rawTail =
        typeof payload.tail === "string"
          ? payload.tail
          : Array.isArray(payload.tail)
            ? payload.tail.filter((item): item is string => typeof item === "string").join("\n")
            : "";
      const compactTail = compactSnapshotTail(rawTail);
      const tailLines = compactTail.length === 0 ? 0 : compactTail.split(/\r?\n/g).length;
      const metaYaml = toYaml({
        kind,
        terminalId: payload.terminalId ?? "unknown",
        seq: payload.seq ?? 0,
        cols: payload.cols ?? 0,
        rows: payload.rows ?? 0,
        cursor: payload.cursor ?? null,
        tailLines,
      });
      const body = compactTail.length > 0 ? mdFence("text", compactTail) : "_empty snapshot tail_";
      return [mdFence("yaml", metaYaml), body].join("\n\n");
    }

    if (kind === "terminal-help") {
      const helpText = await this.renderTerminalHelp(payload);
      const metaYaml = toYaml({
        kind,
        terminalId: payload.terminalId ?? "unknown",
        command: payload.command ?? "unknown",
        source: payload.source ?? "unknown",
        truncated: payload.truncated ?? false,
        error: payload.error ?? null,
      });
      const body = helpText.length > 0 ? mdFence("markdown", helpText) : "_empty help_";
      return [mdFence("yaml", metaYaml), body].join("\n\n");
    }

    return mdFence("yaml", toYaml(payload));
  }

  private async renderTerminalHelp(payload: Record<string, unknown>): Promise<string> {
    const doc = payload.doc as TerminalHelpDocument | undefined;
    const manualsRaw = payload.manuals;
    const manuals: Record<string, string> =
      manualsRaw && typeof manualsRaw === "object"
        ? Object.fromEntries(
            Object.entries(manualsRaw as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {};

    if (!doc || typeof doc !== "object" || typeof doc.content !== "string") {
      return typeof payload.text === "string" ? payload.text : "";
    }
    if (doc.syntax === "md") {
      return doc.content;
    }
    if (doc.syntax !== "mdx") {
      return doc.content;
    }

    try {
      const rendered = await mdxToMd(doc.content, {
        defaultTagPolicy: "remove",
        expressionPolicy: "remove",
        tagTransforms: {
          CliHelp: ({ attributes }) => {
            const command = typeof attributes.command === "string" ? attributes.command.trim() : "";
            if (command.length > 0 && manuals[command]) {
              return manuals[command];
            }
            if (command.length > 0) {
              const lower = command.toLowerCase();
              for (const [key, value] of Object.entries(manuals)) {
                if (key.toLowerCase() === lower) {
                  return value;
                }
              }
            }
            return "";
          },
        },
      });
      return rendered.markdown.trim();
    } catch {
      return doc.content;
    }
  }

  private trimHistory(): void {
    if (this.history.length <= MAX_HISTORY_MESSAGES) {
      return;
    }
    this.history = this.history.slice(this.history.length - MAX_HISTORY_MESSAGES);
  }

  private buildTools(
    taskId: string,
    trace: ToolTraceEntry[],
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
      const timestamp = new Date().toISOString();
      try {
        throwIfAborted();
        const output = await handler();
        throwIfAborted();
        trace.push({
          tool: toolName,
          input,
          output,
          timestamp,
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trace.push({
          tool: toolName,
          input,
          error: message,
          timestamp,
        });
        throw error;
      }
    };

    const attentionCommitMetaSchema = z.object({
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
    }).passthrough();

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
      inputSchema: z.object({
        contextId: z.string().min(1),
        parentCommitIds: z.array(z.string()).optional(),
        meta: attentionCommitMetaSchema,
        scores: z.record(z.string(), z.number()).optional(),
        summary: z.string().min(1),
        change: attentionCommitChangeSchema,
        done: z.boolean().optional(),
        stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        commitId: z.string(),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          contextId: z.string().min(1),
          parentCommitIds: z.array(z.string()).optional(),
          meta: attentionCommitMetaSchema,
          scores: z.record(z.string(), z.number()).optional(),
          summary: z.string().min(1),
          change: attentionCommitChangeSchema,
          done: z.boolean().optional(),
          stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
        })
        .parse(rawInput);
      return traceTool("attention_commit", input, async () => {
        const commit = await this.deps.attentionGateway.commit(input);
        hooks.onAttentionUpdate({
          contextId: input.contextId,
          commitId: commit.commitId,
          text: commit.summary,
          author: commit.meta.author,
          scores: commit.scores,
          done: input.done ?? false,
          stage: input.stage,
        });
        return { ok: true, commitId: commit.commitId };
      });
    });

    const messageSendTool = this.deps.messageGateway
      ? toolDefinition({
          name: "message_send",
          description: this.runtimeText.t("tool.message_send.description"),
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
          return traceTool("message_send", input, async () => await this.deps.messageGateway!.send(input));
        })
      : null;

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

    const listTool = toolDefinition({
      name: "terminal_list",
      description: this.runtimeText.t("tool.terminal_list.description"),
      outputSchema: z.object({
        terminals: z.array(
          z.object({
            terminalId: z.string(),
            running: z.boolean(),
            cwd: z.string().optional(),
            cols: z.number(),
            rows: z.number(),
            focused: z.boolean().optional(),
            dirty: z.boolean().optional(),
            latestSeq: z.number().optional(),
            icon: z.string().optional(),
            title: z.string().optional(),
            shortcuts: z.record(z.string(), z.string()).optional(),
            transportUrl: z.string().optional(),
          }),
        ),
      }),
    }).server(async () =>
      traceTool("terminal_list", {}, async () => ({
        terminals: this.deps.terminalGateway.list(),
      })),
    );

    const createTool = toolDefinition({
      name: "terminal_create",
      description: this.runtimeText.t("tool.terminal_create.description"),
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
      return traceTool("terminal_create", input, async () => this.deps.terminalGateway.create(input));
    });

    const focusTool = toolDefinition({
      name: "terminal_focus",
      description: this.runtimeText.t("tool.terminal_focus.description"),
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
      return traceTool("terminal_focus", input, async () => this.deps.terminalGateway.focus(input));
    });

    const killTool = toolDefinition({
      name: "terminal_kill",
      description: this.runtimeText.t("tool.terminal_kill.description"),
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_kill", input, async () => this.deps.terminalGateway.kill(input));
    });

    const writeTool = toolDefinition({
      name: "terminal_write",
      description: this.runtimeText.t("tool.terminal_write.description"),
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
      return traceTool("terminal_write", input, async () => this.deps.terminalGateway.write(input));
    });

    const readTool = toolDefinition({
      name: "terminal_read",
      description: this.runtimeText.t("tool.terminal_read.description"),
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
      return traceTool("terminal_read", input, async () => this.deps.terminalGateway.read(input));
    });

    const snapshotTool = toolDefinition({
      name: "terminal_snapshot",
      description: this.runtimeText.t("tool.terminal_snapshot.description"),
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_snapshot", input, async () => this.deps.terminalGateway.snapshot(input));
    });

    const getConfigTool = toolDefinition({
      name: "terminal_get_config",
      description: this.runtimeText.t("tool.terminal_get_config.description"),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async () => traceTool("terminal_get_config", {}, async () => this.deps.terminalGateway.getConfig()));

    const setConfigTool = toolDefinition({
      name: "terminal_set_config",
      description: this.runtimeText.t("tool.terminal_set_config.description"),
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
      return traceTool("terminal_set_config", input, async () => this.deps.terminalGateway.setConfig({ patch: input.patch }));
    });

    const taskSourceSchema = z.string().min(1);
    const taskIdSchema = z.string().min(1);
    const taskRefSchema = z.object({
      source: taskSourceSchema,
      id: taskIdSchema,
    });
    const taskRefLikeSchema = z.union([z.string().min(1), taskRefSchema]);
    const taskRelationshipTypeSchema = z.enum([
      "blocks",
      "blocked_by",
      "relates_to",
      "parent_of",
      "child_of",
      "duplicates",
    ]);
    const taskRelationshipSchema = z.object({
      type: taskRelationshipTypeSchema,
      target: taskRefLikeSchema,
    });
    const taskTriggerSchema = z.union([
      z.object({ type: z.literal("manual") }),
      z.object({ type: z.literal("event"), topic: z.string().min(1) }),
      z.object({ type: z.literal("at"), at: z.string().min(1) }),
      z.object({ type: z.literal("cron"), expr: z.string().min(1) }),
    ]);
    const taskStatusSchema = z.enum(["backlog", "pending", "ready", "running", "done", "failed", "canceled"]);
    const taskCreateSchema = z.object({
      source: taskSourceSchema,
      id: taskIdSchema.optional(),
      title: z.string().min(1),
      body: z.string().optional(),
      status: taskStatusSchema.optional(),
      type: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      milestone: z.string().optional(),
      projects: z.array(z.string()).optional(),
      dependsOn: z.array(taskRefLikeSchema).optional(),
      relationships: z.array(taskRelationshipSchema).optional(),
      triggers: z.array(taskTriggerSchema).optional(),
      sourceFile: z.string().optional(),
    });
    const taskPatchSchema = z.object({
      title: z.string().optional(),
      body: z.string().optional(),
      status: taskStatusSchema.optional(),
      type: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      milestone: z.string().optional(),
      projects: z.array(z.string()).optional(),
      dependsOn: z.array(taskRefLikeSchema).optional(),
      relationships: z.array(taskRelationshipSchema).optional(),
      triggers: z.array(taskTriggerSchema).optional(),
    });
    const taskUpdateSchema = z.object({
      source: taskSourceSchema,
      id: taskIdSchema,
      patch: taskPatchSchema,
    });
    const taskImportTaskSchema = z.object({
      id: taskIdSchema.optional(),
      title: z.string().min(1),
      body: z.string().optional(),
      status: taskStatusSchema.optional(),
      type: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      milestone: z.string().optional(),
      projects: z.array(z.string()).optional(),
      dependsOn: z.array(taskRefLikeSchema).optional(),
      relationships: z.array(taskRelationshipSchema).optional(),
      triggers: z.array(taskTriggerSchema).optional(),
    });
    const taskImportItemSchema = z.object({
      source: taskSourceSchema,
      file: z.string().min(1),
      task: taskImportTaskSchema,
    });

    const taskListTool = toolDefinition({
      name: "task_list",
      description: this.runtimeText.t("tool.task_list.description"),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async () => traceTool("task_list", {}, async () => ({ tasks: this.deps.taskGateway.list() })));

    const taskGetTool = toolDefinition({
      name: "task_get",
      description: this.runtimeText.t("tool.task_get.description"),
      inputSchema: z.object({
        source: taskSourceSchema,
        id: z.string().min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
      return traceTool("task_get", input, async () => ({ task: this.deps.taskGateway.get(input) ?? null }));
    });

    const taskImportTool = toolDefinition({
      name: "task_import_markdown_batch",
      description: this.runtimeText.t("tool.task_import.description"),
      inputSchema: z.object({
        items: z.array(taskImportItemSchema).min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ items: z.array(taskImportItemSchema).min(1) }).parse(rawInput);
      const items: TaskImportItem[] = input.items;
      return traceTool("task_import_markdown_batch", input, async () => this.deps.taskGateway.import(items));
    });

    const taskCreateTool = toolDefinition({
      name: "task_create",
      description: this.runtimeText.t("tool.task_create.description"),
      inputSchema: taskCreateSchema,
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input: TaskCreateInput = taskCreateSchema.parse(rawInput);
      return traceTool("task_create", input, async () => this.deps.taskGateway.create(input));
    });

    const taskUpdateTool = toolDefinition({
      name: "task_update",
      description: this.runtimeText.t("tool.task_update.description"),
      inputSchema: taskUpdateSchema,
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input: TaskUpdateInput = taskUpdateSchema.parse(rawInput);
      return traceTool("task_update", input, async () => this.deps.taskGateway.update(input));
    });

    const taskDoneTool = toolDefinition({
      name: "task_done",
      description: this.runtimeText.t("tool.task_done.description"),
      inputSchema: z.object({
        source: taskSourceSchema,
        id: z.string().min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
      return traceTool("task_done", input, async () => this.deps.taskGateway.done(input));
    });

    const taskAddDependencyTool = toolDefinition({
      name: "task_add_dependency",
      description: this.runtimeText.t("tool.task_add_dependency.description"),
      inputSchema: z.object({
        source: taskSourceSchema,
        id: z.string().min(1),
        target: z.string().min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z
        .object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) })
        .parse(rawInput);
      return traceTool("task_add_dependency", input, async () =>
        this.deps.taskGateway.addDependency({
          source: input.source,
          id: input.id,
          target: input.target,
        }),
      );
    });

    const taskRemoveDependencyTool = toolDefinition({
      name: "task_remove_dependency",
      description: this.runtimeText.t("tool.task_remove_dependency.description"),
      inputSchema: z.object({
        source: taskSourceSchema,
        id: z.string().min(1),
        target: z.string().min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z
        .object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) })
        .parse(rawInput);
      return traceTool("task_remove_dependency", input, async () =>
        this.deps.taskGateway.removeDependency({
          source: input.source,
          id: input.id,
          target: input.target,
        }),
      );
    });

    const taskTriggerManualTool = toolDefinition({
      name: "task_trigger_manual",
      description: this.runtimeText.t("tool.task_trigger_manual.description"),
      inputSchema: z.object({
        source: taskSourceSchema,
        id: z.string().min(1),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
      return traceTool("task_trigger_manual", input, async () => ({
        task: this.deps.taskGateway.triggerManual(input) ?? null,
      }));
    });

    const taskEmitEventTool = toolDefinition({
      name: "task_emit_event",
      description: this.runtimeText.t("tool.task_emit_event.description"),
      inputSchema: z.object({
        topic: z.string().min(1),
        payload: z.unknown().optional(),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ topic: z.string().min(1), payload: z.unknown().optional() }).parse(rawInput);
      return traceTool("task_emit_event", input, async () =>
        this.deps.taskGateway.emitEvent({
          topic: input.topic,
          payload: input.payload,
          source: "tool",
        }),
      );
    });

    const tools: Tool[] = [
      attentionContextListTool,
      attentionQueryTool,
      attentionCommitTool,
      ...(messageSendTool ? [messageSendTool] : []),
      listTool,
      createTool,
      focusTool,
      killTool,
      writeTool,
      readTool,
      snapshotTool,
      getConfigTool,
      setConfigTool,
      taskListTool,
      taskGetTool,
      taskImportTool,
      taskCreateTool,
      taskUpdateTool,
      taskDoneTool,
      taskAddDependencyTool,
      taskRemoveDependencyTool,
      taskTriggerManualTool,
      taskEmitEventTool,
    ];

    this.deps.logger.log({
      channel: "agent",
      level: "debug",
      message: "ai.tools.ready",
      meta: { taskId, count: tools.length },
    });

    return tools;
  }

  private resolveTaskSummary(input: {
    stage: TaskStage;
    done: boolean;
    attentionUpdates: AttentionUpdateCall[];
    text: string;
    thinking: string;
  }): string {
    const lastUpdate = [...input.attentionUpdates]
      .map((item) => item.text.trim())
      .filter((item) => item.length > 0)
      .at(-1);
    if (lastUpdate && lastUpdate.trim().length > 0) {
      return lastUpdate;
    }
    if (input.text.trim().length > 0) {
      return input.text.trim();
    }
    if (input.thinking.trim().length > 0) {
      return this.runtimeText.t("task.summary.thinking_only");
    }
    if (input.done) {
      return this.runtimeText.t("task.summary.done");
    }
    return this.runtimeText.t("task.summary.stage", { stage: input.stage });
  }

  private emitTask(taskId: string, stage: TaskStage, summary: string): void {
    const event: TaskEvent = {
      taskId,
      stage,
      summary,
      timestamp: Date.now(),
    };
    this.deps.logger.log({
      channel: "agent",
      level: "info",
      message: `${stage}: ${summary}`,
      meta: { taskId },
    });
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  private emitStats(): void {
    const snapshot = { ...this.stats };
    for (const listener of this.statsListeners) {
      listener(snapshot);
    }
  }

  private createAssistantMessage(
    content: string,
    options?: Pick<ChatMessage, "channel" | "format" | "tool">,
  ): ChatMessage {
    return {
      id: createId(),
      role: "assistant",
      content,
      timestamp: Date.now(),
      channel: options?.channel,
      format: options?.format,
      tool: options?.tool,
    };
  }
}
