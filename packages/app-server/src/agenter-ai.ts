import { toolDefinition, type Tool } from "@tanstack/ai";
import { z } from "zod";
import { mdxToMd } from "@agenter/mdx2md";

import type { LoopBusMessage, LoopBusResponse } from "./loop-bus";
import type { DeepseekClient, TextOnlyModelMessage } from "./deepseek-client";
import { DeepseekDecisionError } from "./deepseek-client";
import type { PromptStore } from "./prompt-store";
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

interface AgentDeps {
  deepseek: DeepseekClient;
  logger: AppServerLogger;
  promptStore: PromptStore;
  terminalGateway: TerminalGateway;
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
  text: string;
  done: boolean;
  stage?: TaskStage;
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
const MAX_STEPS_PER_TASK = 24;
const MAX_PRELUDE_MESSAGES = 24;
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

const INTERNAL_MARKER_LINE = /^\[(to_user|self_talk|assistant_text|tool_trace|tool_trace_count|tool_trace_tools)\]\s*$/i;
const INTERNAL_KEY_LINE = /^(to_user_count|assistant_text|self_talk|tool_trace_count|tool_trace_tools)\s*:/i;
const INTERNAL_TOOL_TRACE_ITEM = /^-\s*tool=/i;

const normalizeAssistantVisibleText = (input: string): string => {
  const lines = input
    .trim()
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !INTERNAL_MARKER_LINE.test(line))
    .filter((line) => !INTERNAL_KEY_LINE.test(line))
    .filter((line) => !INTERNAL_TOOL_TRACE_ITEM.test(line));

  const compacted: string[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      if (compacted.length === 0 || compacted[compacted.length - 1] === "") {
        continue;
      }
      compacted.push("");
      continue;
    }
    compacted.push(line);
  }
  return compacted.join("\n").trim();
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
  private preludeMessages: LoopBusMessage[] = [];
  private stats: AgentRuntimeStats = {
    loops: 0,
    apiCalls: 0,
    lastContextChars: 0,
    totalContextChars: 0,
  };

  constructor(private readonly deps: AgentDeps) {}

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

  async send(messages: LoopBusMessage[]): Promise<LoopBusResponse | void> {
    let orderedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    if (orderedMessages.length === 0) {
      return;
    }
    this.stats.loops += 1;

    const hasFreshUserInput = orderedMessages.some((item) => item.source === "chat" && item.role === "user");
    if (hasFreshUserInput && this.activeTask === null) {
      this.activeTask = { id: createId(), steps: 0 };
      this.emitTask(this.activeTask.id, "plan", "接收用户输入并开始处理");
    }

    if (!this.activeTask) {
      this.preludeMessages.push(...orderedMessages);
      if (this.preludeMessages.length > MAX_PRELUDE_MESSAGES) {
        this.preludeMessages = this.preludeMessages.slice(this.preludeMessages.length - MAX_PRELUDE_MESSAGES);
      }
      this.deps.logger.log({
        channel: "agent",
        level: "debug",
        message: "ai.skip",
        meta: { reason: "no-active-task", messageCount: orderedMessages.length, preludeCount: this.preludeMessages.length },
      });
      return;
    }

    if (this.activeTask.steps >= MAX_STEPS_PER_TASK) {
      const user = this.createAssistantMessage("达到自动循环上限，请提供下一步指令。");
      this.activeTask = null;
      return {
        stage: "done",
        done: true,
        summary: user.content,
        outputs: {
          toUser: [user],
          toTerminal: [],
          toTools: [],
        },
      };
    }

    const taskId = this.activeTask.id;
    if (hasFreshUserInput && this.preludeMessages.length > 0) {
      orderedMessages = [...this.preludeMessages, ...orderedMessages].sort((a, b) => a.timestamp - b.timestamp);
      this.preludeMessages = [];
    }
    await this.pushIncomingBatchToHistory(orderedMessages);

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
      const response = await this.deps.deepseek.respondWithMeta({
        systemPrompt,
        messages: historySnapshot,
        tools,
      });

      this.stats.apiCalls += 1;
      if (response.usage?.promptTokens !== undefined) {
        this.stats.lastPromptTokens = response.usage.promptTokens;
        this.stats.totalPromptTokens = (this.stats.totalPromptTokens ?? 0) + response.usage.promptTokens;
      }
      this.emitStats();

      this.deps.sessionStore?.appendCall({
        id: callId,
        timestamp: new Date().toISOString(),
        provider: this.deps.deepseek.getMeta().provider,
        model: this.deps.deepseek.getMeta().model,
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

      this.pushAssistantTurnToHistory({
        thinking: response.thinking,
        text: response.text,
        toolTrace,
        chatReplies,
      });

      this.activeTask.steps += 1;
      const stage = chatReplies[chatReplies.length - 1]?.stage ?? inferStageFromToolTrace(toolTrace);
      const done = chatReplies.some((item) => item.done) || stage === "done";
      const toUserMessages = this.composeAssistantMessages(chatReplies, response.thinking, response.text, toolTrace);
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
      const details = error instanceof DeepseekDecisionError ? { attempts: error.attempts } : undefined;
      this.deps.sessionStore?.appendCall({
        id: callId,
        timestamp: new Date().toISOString(),
        provider: this.deps.deepseek.getMeta().provider,
        model: this.deps.deepseek.getMeta().model,
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
      const user = this.createAssistantMessage(`agenter-ai 调用失败：${message}`);
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
    text: string,
    toolTrace: ToolTraceEntry[],
  ): ChatMessage[] {
    const result: ChatMessage[] = [];
    const normalizedText = normalizeAssistantVisibleText(text);
    const normalizedThinking = normalizeAssistantVisibleText(thinking);
    const hasDuplicateUserReply = chatReplies.some((reply) => reply.text.trim() === normalizedText);

    if (normalizedThinking.length > 0) {
      result.push(
        this.createAssistantMessage(normalizedThinking, {
          channel: "self_talk",
          format: "markdown",
        }),
      );
    }
    if (normalizedText.length > 0 && !hasDuplicateUserReply) {
      result.push(
        this.createAssistantMessage(normalizedText, {
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

    for (const reply of chatReplies) {
      result.push(
        this.createAssistantMessage(reply.text, {
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
    toolTrace: ToolTraceEntry[];
    chatReplies: ChatReplyCall[];
  }): void {
    const parts: string[] = [];
    if (input.chatReplies.length > 0) {
      const replies = input.chatReplies.map((reply) => reply.text.trim()).filter((line) => line.length > 0);
      parts.push(`to_user_count: ${input.chatReplies.length}`);
      if (replies.length > 0) {
        parts.push(`to_user_last: ${replies[replies.length - 1]}`);
      }
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

  private async formatUserMessage(message: LoopBusMessage): Promise<string> {
    const header = `### ${message.name}`;
    if (message.source === "chat") {
      return [header, message.text].join("\n\n");
    }
    if (message.source === "terminal") {
      return [header, await this.formatTerminalMessage(message.text)].join("\n\n");
    }

    const metaYaml = toYaml({
      source: message.source,
      timestamp: formatTimestamp(message.timestamp),
      ...(message.meta ?? {}),
    });
    return [header, mdFence("yaml", metaYaml), mdFence("text", message.text)].join("\n\n");
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

    const chatReplyTool = toolDefinition({
      name: "chat_reply",
      description: "向用户发送回复。你与用户沟通时必须调用这个工具。",
      inputSchema: z.object({
        text: z.string().min(1),
        done: z.boolean().optional(),
        stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
      }),
      outputSchema: z.object({ ok: z.boolean() }),
    }).server(async (rawInput) => {
      const input = z
        .object({
          text: z.string().min(1),
          done: z.boolean().optional(),
          stage: z.enum(["plan", "act", "observe", "decide", "done"]).optional(),
        })
        .parse(rawInput);
      return traceTool("chat_reply", input, async () => {
        hooks.onChatReply({
          text: input.text,
          done: input.done ?? false,
          stage: input.stage,
        });
        return { ok: true };
      });
    });

    const listTool = toolDefinition({
      name: "terminal_list",
      description: "列出当前可用的终端实例。",
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
      description: "启动指定终端实例，并返回 help 与 snapshot 等初始化信息。",
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_run", input, async () => this.deps.terminalGateway.run(input));
    });

    const focusTool = toolDefinition({
      name: "terminal_focus",
      description: "设置当前聚焦终端。focus=false 时不会清除当前聚焦，只返回当前状态。",
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
      description: "停止指定终端实例。",
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_kill", input, async () => this.deps.terminalGateway.kill(input));
    });

    const sliceTool = toolDefinition({
      name: "terminal_sliceDirty",
      description: "采集脏区差异。支持 wait=true 阻塞等待新的终端变化。",
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
      description: "向终端写入文本并可选提交。",
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
      description: "读取终端快照信息。",
      inputSchema: z.object({ terminalId: z.string() }),
      outputSchema: z.record(z.string(), z.unknown()),
    }).server(async (rawInput) => {
      const input = z.object({ terminalId: z.string() }).parse(rawInput);
      return traceTool("terminal_read", input, async () => this.deps.terminalGateway.read(input));
    });

    const tools: Tool[] = [chatReplyTool, listTool, runTool, focusTool, killTool, sliceTool, writeTool, readTool];

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
    const lastReply = input.chatReplies[input.chatReplies.length - 1];
    if (lastReply && lastReply.text.trim().length > 0) {
      return lastReply.text;
    }
    if (input.text.trim().length > 0) {
      return input.text.trim();
    }
    if (input.thinking.trim().length > 0) {
      return "模型输出了思考内容，等待下一步。";
    }
    return input.done ? "任务完成" : `进入 ${input.stage} 阶段`;
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
