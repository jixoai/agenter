import { toolDefinition, type Tool } from "@tanstack/ai";
import { z } from "zod";
import { mdxToMd } from "@agenter/mdx2md";
import type { ChatAddInput, ChatQueryInput, ChatRecord, ChatRemarkInput, ChatReplyInput, ChatReplyResult } from "@agenter/chat-system";
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

import type { LoopBusMessage, LoopBusResponse } from "./loop-bus";
import type { ModelClient, TextOnlyModelMessage } from "./model-client";
import { ModelDecisionError } from "./model-client";
import type { PromptStore } from "./prompt-store";
import { createRuntimeText } from "./runtime-text";
import type { SessionStore } from "./session-store";
import type { AppServerLogger, ChatMessage, TaskEvent, TaskStage } from "./types";

interface TerminalDescriptor {
  terminalId: string;
  running: boolean;
  cwd?: string;
  cols: number;
  rows: number;
  focused?: boolean;
  dirty?: boolean;
  latestSeq?: number;
}

interface TerminalWriteInput {
  terminalId: string;
  text: string;
  submit?: boolean;
  submitKey?: "enter" | "linefeed";
}

interface TerminalReadInput {
  terminalId: string;
}

interface TerminalGateway {
  list: () => TerminalDescriptor[];
  run: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  kill: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  focus: (input: { terminalId: string; focus?: boolean }) => Promise<{ ok: boolean; message: string; focusedTerminalId?: string }>;
  write: (input: TerminalWriteInput) => Promise<{ ok: boolean; message: string }>;
  read: (input: TerminalReadInput) => Promise<unknown>;
  sliceDirty: (input: { terminalId: string; remark?: boolean; wait?: boolean; timeoutMs?: number }) => Promise<unknown>;
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
  emitEvent: (input: TaskEventInput) => { topic: string; source: "api" | "file" | "scheduler" | "tool"; affected: TaskView[] };
  import: (items: TaskImportItem[]) => TaskImportResult;
}

interface ChatGateway {
  list: () => ChatRecord[];
  add: (input: ChatAddInput) => Promise<ChatRecord> | ChatRecord;
  remark: (input: ChatRemarkInput) => Promise<ChatRecord | undefined> | ChatRecord | undefined;
  query: (input: ChatQueryInput) => Promise<ChatRecord[]> | ChatRecord[];
  reply: (input: ChatReplyInput) => Promise<ChatReplyResult> | ChatReplyResult;
}

interface AgentDeps {
  modelClient: ModelClient;
  logger: AppServerLogger;
  promptStore: PromptStore;
  locale?: string;
  terminalGateway: TerminalGateway;
  taskGateway: TaskGateway;
  chatGateway: ChatGateway;
  sessionStore?: SessionStore;
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

interface ChatReplyCall {
  id: number;
  text: string;
  from: string;
  score: number;
  remark: string;
  done: boolean;
  stage?: TaskStage;
  relationships?: Array<{ id: number; score?: number; remark?: string }>;
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

const safeJsonParse = (input: string): unknown => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

const formatTimestamp = (value: number): string => new Date(value).toISOString();

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

const compactSnapshotTail = (lines: string[]): string[] => {
  const trimmed = lines.map((line) => line.replace(/\s+$/g, ""));
  const compacted = trimmed.filter((line) => line.length > 0);
  if (compacted.length === 0) {
    return [];
  }
  return compacted.slice(-MAX_TERMINAL_SNAPSHOT_LINES);
};

const inferStageFromToolTrace = (trace: ToolTraceEntry[]): TaskStage => {
  if (trace.some((entry) => entry.tool === "terminal_write")) {
    return "act";
  }
  if (trace.some((entry) => ["terminal_sliceDirty", "terminal_read", "terminal_run", "terminal_list"].includes(entry.tool))) {
    return "observe";
  }
  if (trace.length > 0) {
    return "decide";
  }
  return "decide";
};

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

  async send(messages: LoopBusMessage[]): Promise<LoopBusResponse<ChatMessage, TaskStage> | void> {
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
    await this.pushIncomingBatchToHistory(orderedMessages);
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
    const toolTrace: ToolTraceEntry[] = [];
    const chatReplies: ChatReplyCall[] = [];
    const tools = ENABLE_AGENT_TOOLS
      ? this.buildTools(taskId, toolTrace, {
          onChatReply: (reply) => {
            chatReplies.push(reply);
          },
        })
      : [];

    const callId = createId();
    const historySnapshot = [...this.history];
    const contextChars = systemPrompt.length + JSON.stringify(historySnapshot).length;
    this.stats.lastContextChars = contextChars;
    this.stats.totalContextChars += contextChars;
    this.emitStats();

    try {
      const response = await this.deps.modelClient.respondWithMeta({
        systemPrompt,
        messages: historySnapshot,
        tools,
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

      this.deps.sessionStore?.appendCall({
        id: callId,
        timestamp: new Date().toISOString(),
        provider: this.deps.modelClient.getMeta().provider,
        model: this.deps.modelClient.getMeta().model,
        request: {
          systemPrompt,
          messages: historySnapshot,
          tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
          meta: {
            taskId,
            loopCount: this.stats.loops,
            historySize: historySnapshot.length,
          },
        },
        response: {
          decision: {
            stage: chatReplies[chatReplies.length - 1]?.stage ?? inferStageFromToolTrace(toolTrace),
            done: chatReplies.some((item) => item.done),
            toUser: chatReplies.map((item) => item.text),
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

      this.pushAssistantTurnToHistory({ thinking: response.thinking, text: response.text, toolTrace, chatReplies });

      const stage = chatReplies[chatReplies.length - 1]?.stage ?? inferStageFromToolTrace(toolTrace);
      const done = chatReplies.some((item) => item.done) || stage === "done";
      const toUserMessages = this.composeAssistantMessages(chatReplies, response.thinking, toolTrace);
      const summary = this.resolveTaskSummary({
        stage,
        done,
        chatReplies,
        text: response.text,
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
          toUser: toUserMessages,
          toTerminal: [],
          toTools: [],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "Error";
      const stack = error instanceof Error ? error.stack : undefined;
      const details = error instanceof ModelDecisionError ? { retried: true } : undefined;
      this.deps.sessionStore?.appendCall({
        id: callId,
        timestamp: new Date().toISOString(),
        provider: this.deps.modelClient.getMeta().provider,
        model: this.deps.modelClient.getMeta().model,
        request: {
          systemPrompt,
          messages: historySnapshot,
          tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
          meta: {
            taskId,
            loopCount: this.stats.loops,
            historySize: historySnapshot.length,
          },
        },
        response: {
          toolTrace,
        },
        error: { message, name, stack, details },
      });
      this.activeTask = null;
      this.deps.logger.log({
        channel: "error",
        level: "error",
        message: `agenter-ai failed: ${message}`,
      });
      const user = this.createAssistantMessage(this.runtimeText.t("ai.call_failed", { message }));
      return {
        taskId,
        stage: "error",
        done: true,
        summary: user.content,
        outputs: { toUser: [user], toTerminal: [], toTools: [] },
      };
    }
  }

  private composeAssistantMessages(
    chatReplies: ChatReplyCall[],
    thinking: string,
    toolTrace: ToolTraceEntry[],
  ): ChatMessage[] {
    const result: ChatMessage[] = [];
    if (thinking.trim().length > 0) {
      result.push(
        this.createAssistantMessage(thinking.trim(), {
          channel: "self_talk",
          format: "markdown",
        }),
      );
    }

    for (const tool of toolTrace) {
      result.push(
        this.createAssistantMessage(
          mdFence(
            "yaml+tool_call",
            toYaml({
              tool: tool.tool,
              input: tool.input,
              timestamp: tool.timestamp,
            }),
          ),
          {
            channel: "tool_call",
            format: "markdown",
            tool: { name: tool.tool },
          },
        ),
      );

      if (tool.output !== undefined || tool.error !== undefined) {
        result.push(
          this.createAssistantMessage(
            mdFence(
              "yaml+tool_result",
              toYaml({
                tool: tool.tool,
                ok: tool.error === undefined,
                output: tool.output ?? null,
                error: tool.error ?? null,
                timestamp: tool.timestamp,
              }),
            ),
            {
              channel: "tool_result",
              format: "markdown",
              tool: { name: tool.tool, ok: tool.error === undefined },
            },
          ),
        );
      }
    }

    const replies = chatReplies.map((item) => item.text.trim()).filter((item) => item.length > 0);
    for (const reply of replies) {
      result.push(
        this.createAssistantMessage(reply, {
          channel: "to_user",
          format: "markdown",
        }),
      );
    }
    return result;
  }

  private async pushIncomingBatchToHistory(messages: LoopBusMessage[]): Promise<void> {
    const rendered = await Promise.all(messages.map((message) => this.formatUserMessage(message)));
    const content = rendered.join("\n\n---\n\n");
    this.history.push({
      role: "user",
      content: [
        {
          type: "text",
          content,
        },
      ],
    });
    this.trimHistory();
  }

  private pushAssistantTurnToHistory(input: {
    thinking: string;
    text: string;
    chatReplies: ChatReplyCall[];
    toolTrace: ToolTraceEntry[];
  }): void {
    const toUserReplies = input.chatReplies.map((item) => item.text.trim()).filter((item) => item.length > 0);
    const parts: string[] = [];
    if (toUserReplies.length > 0) {
      parts.push(`to_user_count: ${toUserReplies.length}`);
      parts.push(`to_user_last: ${toUserReplies[toUserReplies.length - 1]}`);
    }
    if (input.thinking.trim().length > 0) {
      parts.push(`self_talk: ${input.thinking.trim()}`);
    }
    if (input.text.trim().length > 0) {
      parts.push(`assistant_text: ${input.text.trim()}`);
    }
    if (input.toolTrace.length > 0) {
      const toolNames = Array.from(new Set(input.toolTrace.map((trace) => trace.tool)));
      parts.push(`tool_trace_count: ${input.toolTrace.length}`);
      parts.push(`tool_trace_tools: ${toolNames.join(", ")}`);
    }

    this.history.push({
      role: "assistant",
      content: [
        {
          type: "text",
          content: parts.join("\n\n"),
        },
      ],
    });
    this.trimHistory();
  }

  private async maybeCompactHistory(taskId: string): Promise<void> {
    const minimumHistory = this.compactForced ? 2 : 8;
    if (!this.compactPending || this.history.length < minimumHistory) {
      return;
    }
    const chatFacts = this.deps.chatGateway.list();
    const historyText = this.history
      .map((item, index) => {
        const content = item.content.map((part) => part.content).join("\n");
        return `# ${index + 1} ${item.role}\n${content}`;
      })
      .join("\n\n");
    const compactInput =
      chatFacts.length === 0
        ? historyText
        : `${historyText}\n\n# chat_attention\n${JSON.stringify(
            chatFacts.map((item) => ({
              id: item.id,
              from: item.from,
              score: item.score,
              remark: item.remark,
              content: item.content,
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
        content: [
          {
            type: "text",
            content: `history_summary:\n${compact.summary.trim()}`,
          },
        ],
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

  private async formatUserMessage(message: LoopBusMessage): Promise<string> {
    const header = `### ${message.name}`;
    if (message.source === "chat") {
      return [header, message.text].join("\n\n");
    }
    if (message.source === "terminal") {
      return [header, await this.formatTerminalMessage(message.text)].join("\n\n");
    }
    if (message.source === "task") {
      return [header, mdFence("yaml", message.text)].join("\n\n");
    }
    if (message.source === "chat-system") {
      return [header, await this.formatChatSystemMessage(message.text)].join("\n\n");
    }

    const metaYaml = toYaml({
      source: message.source,
      timestamp: formatTimestamp(message.timestamp),
      ...(message.meta ?? {}),
    });
    return [header, mdFence("yaml", metaYaml), mdFence("text", message.text)].join("\n\n");
  }

  private async formatChatSystemMessage(text: string): Promise<string> {
    const parsed = safeJsonParse(text);
    if (!parsed || typeof parsed !== "object") {
      return mdFence("text", text);
    }
    const payload = parsed as Record<string, unknown>;
    if (payload.kind !== "chat-system-list" || !Array.isArray(payload.items)) {
      return mdFence("yaml", toYaml(payload));
    }
    const items = payload.items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: item.id ?? null,
        from: item.from ?? "unknown",
        score: item.score ?? 0,
        remark: item.remark ?? "",
        content: item.content ?? "",
      }));
    const markdown = items
      .map((item) => `- [#${item.id}] (${item.from}) score=${item.score} remark=${JSON.stringify(item.remark)}\n  ${String(item.content)}`)
      .join("\n");
    return [mdFence("yaml", toYaml({ kind: "chat-system-list", count: items.length })), mdFence("markdown", markdown)].join("\n\n");
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
        hint: "call terminal_sliceDirty if detailed diff is needed",
      });
      return mdFence("yaml", metaYaml);
    }

    if (kind === "terminal-snapshot") {
      const tail = Array.isArray(payload.tail) ? payload.tail.filter((item): item is string => typeof item === "string") : [];
      const compactTail = compactSnapshotTail(tail);
      const metaYaml = toYaml({
        kind,
        terminalId: payload.terminalId ?? "unknown",
        seq: payload.seq ?? 0,
        cols: payload.cols ?? 0,
        rows: payload.rows ?? 0,
        cursor: payload.cursor ?? null,
        tailLines: compactTail.length,
      });
      const body = compactTail.length > 0 ? mdFence("text", compactTail.join("\n")) : "_empty snapshot tail_";
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
      onChatReply: (reply: ChatReplyCall) => void;
    },
  ): Tool[] {
    const traceTool = async <TInput extends unknown, TOutput extends unknown>(
      toolName: string,
      input: TInput,
      handler: () => Promise<TOutput>,
    ): Promise<TOutput> => {
      const timestamp = new Date().toISOString();
      try {
        const output = await handler();
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

    const chatListTool = toolDefinition({
      name: "chat_list",
      description: this.runtimeText.t("tool.chat_list.description"),
      outputSchema: z.object({
        items: z.array(
          z.object({
            id: z.number().int(),
            content: z.string(),
            from: z.string(),
            score: z.number().int(),
            remark: z.string(),
            updatedAt: z.string(),
          }),
        ),
      }),
    }).server(async () =>
      traceTool("chat_list", {}, async () => ({
        items: this.deps.chatGateway.list(),
      })),
    );

    const chatAddTool = toolDefinition({
      name: "chat_add",
      description: this.runtimeText.t("tool.chat_add.description"),
      inputSchema: z.object({
        content: z.string().min(1),
        from: z.string().min(1),
        score: z.number().int().min(0).max(100).optional(),
        remark: z.string().optional(),
      }),
      outputSchema: z.object({
        id: z.number().int(),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          content: z.string().min(1),
          from: z.string().min(1),
          score: z.number().int().min(0).max(100).optional(),
          remark: z.string().optional(),
        })
        .parse(rawInput);
      return traceTool("chat_add", input, async () => {
        const record = await this.deps.chatGateway.add(input);
        return { id: record.id };
      });
    });

    const chatRemarkTool = toolDefinition({
      name: "chat_remark",
      description: this.runtimeText.t("tool.chat_remark.description"),
      inputSchema: z.object({
        id: z.number().int(),
        score: z.number().int().min(0).max(100).optional(),
        remark: z.string().optional(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        updated: z
          .object({
            id: z.number().int(),
            score: z.number().int(),
            remark: z.string(),
          })
          .nullable(),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          id: z.number().int(),
          score: z.number().int().min(0).max(100).optional(),
          remark: z.string().optional(),
        })
        .parse(rawInput);
      return traceTool("chat_remark", input, async () => {
        const updated = await this.deps.chatGateway.remark(input);
        return {
          ok: Boolean(updated),
          updated: updated
            ? {
                id: updated.id,
                score: updated.score,
                remark: updated.remark,
              }
            : null,
        };
      });
    });

    const chatQueryTool = toolDefinition({
      name: "chat_query",
      description: this.runtimeText.t("tool.chat_query.description"),
      inputSchema: z.object({
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        query: z.string().optional(),
      }),
      outputSchema: z.object({
        items: z.array(
          z.object({
            id: z.number().int(),
            content: z.string(),
            from: z.string(),
            score: z.number().int(),
            remark: z.string(),
            updatedAt: z.string(),
          }),
        ),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          offset: z.number().int().min(0).optional(),
          limit: z.number().int().min(1).max(200).optional(),
          query: z.string().optional(),
        })
        .parse(rawInput);
      return traceTool("chat_query", input, async () => ({
        items: await this.deps.chatGateway.query(input),
      }));
    });

    const chatReplyTool = toolDefinition({
      name: "chat_reply",
      description: this.runtimeText.t("tool.chat_reply.description"),
      inputSchema: z.object({
        replyContent: z.string().min(1).optional(),
        text: z.string().min(1).optional(),
        from: z.string().optional(),
        score: z.number().int().min(0).max(100).optional(),
        relationships: z
          .array(
            z.object({
              id: z.number().int(),
              score: z.number().int().min(0).max(100).optional(),
              remark: z.string().optional(),
            }),
          )
          .optional(),
        done: z.boolean().optional(),
        stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
      }).refine((value) => Boolean(value.replyContent || value.text), {
        message: "replyContent is required",
      }),
      outputSchema: z.object({ ok: z.boolean(), id: z.number().int() }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          replyContent: z.string().min(1).optional(),
          text: z.string().min(1).optional(),
          from: z.string().optional(),
          score: z.number().int().min(0).max(100).optional(),
          relationships: z
            .array(
              z.object({
                id: z.number().int(),
                score: z.number().int().min(0).max(100).optional(),
                remark: z.string().optional(),
              }),
            )
            .optional(),
          done: z.boolean().optional(),
          stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
        }).refine((value) => Boolean(value.replyContent || value.text), {
          message: "replyContent is required",
        })
        .parse(rawInput);
      const replyContent = input.replyContent ?? input.text ?? "";
      return traceTool("chat_reply", input, async () => {
        const result = await this.deps.chatGateway.reply({
          replyContent,
          from: input.from,
          score: input.score,
          relationships: input.relationships,
        });
        hooks.onChatReply({
          id: result.reply.id,
          text: result.reply.content,
          from: result.reply.from,
          score: result.reply.score,
          remark: result.reply.remark,
          done: input.done ?? false,
          stage: input.stage,
          relationships: input.relationships,
        });
        return { ok: true, id: result.reply.id };
      });
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
          }),
        ),
      }),
    }).server(async () =>
      traceTool("terminal_list", {}, async () => ({
        terminals: this.deps.terminalGateway.list(),
      })),
    );

    const runTool = toolDefinition({
      name: "terminal_run",
      description: this.runtimeText.t("tool.terminal_run.description"),
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_run", input, async () => this.deps.terminalGateway.run(input));
    });

    const focusTool = toolDefinition({
      name: "terminal_focus",
      description: this.runtimeText.t("tool.terminal_focus.description"),
      inputSchema: z.object({
        terminalId: z.string(),
        focus: z.boolean().optional(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        message: z.string(),
        focusedTerminalId: z.string().optional(),
      }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          terminalId: z.string(),
          focus: z.boolean().optional(),
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

    const sliceTool = toolDefinition({
      name: "terminal_sliceDirty",
      description: this.runtimeText.t("tool.terminal_slice_dirty.description"),
      inputSchema: z.object({
        terminalId: z.string(),
        remark: z.boolean().optional(),
        wait: z.boolean().optional(),
        timeoutMs: z.number().int().positive().max(120_000).optional(),
      }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z
        .object({
          terminalId: z.string(),
          remark: z.boolean().optional(),
          wait: z.boolean().optional(),
          timeoutMs: z.number().int().positive().max(120_000).optional(),
        })
        .parse(rawInput);
      return traceTool("terminal_sliceDirty", input, async () =>
        this.deps.terminalGateway.sliceDirty({
          terminalId: input.terminalId,
          remark: input.remark ?? true,
          wait: input.wait ?? false,
          timeoutMs: input.timeoutMs,
        }),
      );
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
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_read", input, async () => this.deps.terminalGateway.read(input));
    });

    const taskSourceSchema = z.string().min(1);
    const taskIdSchema = z.string().min(1);
    const taskRefSchema = z.object({
      source: taskSourceSchema,
      id: taskIdSchema,
    });
    const taskRefLikeSchema = z.union([z.string().min(1), taskRefSchema]);
    const taskRelationshipTypeSchema = z.enum(["blocks", "blocked_by", "relates_to", "parent_of", "child_of", "duplicates"]);
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
      const input = z.object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) }).parse(rawInput);
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
      const input = z.object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) }).parse(rawInput);
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
      return traceTool("task_trigger_manual", input, async () => ({ task: this.deps.taskGateway.triggerManual(input) ?? null }));
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
      chatListTool,
      chatAddTool,
      chatRemarkTool,
      chatQueryTool,
      chatReplyTool,
      listTool,
      runTool,
      focusTool,
      killTool,
      sliceTool,
      writeTool,
      readTool,
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
    chatReplies: ChatReplyCall[];
    text: string;
    thinking: string;
  }): string {
    const explicitReplies = input.chatReplies.map((item) => item.text.trim()).filter((item) => item.length > 0);
    const lastReply = explicitReplies[explicitReplies.length - 1];
    if (lastReply && lastReply.trim().length > 0) {
      return lastReply;
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
