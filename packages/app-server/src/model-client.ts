import {
  chat,
  maxIterations,
  summarize,
  type AnySummarizeAdapter,
  type AnyTextAdapter,
  type ModelMessage,
  type StreamChunk,
  type Tool,
} from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { createOpenaiChat } from "@tanstack/ai-openai";
import type {
  AttentionReceiptProviderEventKind,
  AttentionReceiptStatus,
} from "@agenter/loopbus-kernel";
import { OpenAICompatChatTextAdapter } from "./deepseek-adapter";
import {
  canCallModel,
  isDeepseekVendor,
  isOllamaProvider,
  resolveApiEnvHint,
  resolveModelCapabilities,
  resolveProviderHeaders,
  type ModelProviderConfig,
} from "./model-provider";
import { OpenAICompletionTextAdapter } from "./openai-completion-adapter";
import { createRuntimeText } from "./runtime-text";
import { TextBackedSummarizeAdapter } from "./text-summarize-adapter";
import type { ModelCapabilities } from "./types";

export interface ModelDecisionDeliveryError {
  providerEventKind: "run_error" | "transport_error";
  errorCode?: string;
  errorMessage: string;
}

export class ModelDecisionError extends Error {
  readonly deliveryError?: ModelDecisionDeliveryError;

  constructor(message: string, options?: { cause?: unknown; deliveryError?: ModelDecisionDeliveryError }) {
    super(message, options);
    this.name = "ModelDecisionError";
    this.deliveryError = options?.deliveryError;
  }
}

export interface DecisionUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AssistantTurn {
  thinking: string;
  text: string;
  usage?: DecisionUsage;
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
  yieldedAfterToolPhase?: boolean;
}

export type AssistantStreamUpdate =
  | {
      kind: "thinking";
      delta?: string;
      content: string;
      timestamp: number;
    }
  | {
      kind: "draft";
      delta?: string;
      content: string;
      usage?: DecisionUsage;
      finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
      timestamp: number;
    }
  | {
      kind: "tool_call";
      toolCallId: string;
      toolName: string;
      argsText: string;
      input?: unknown;
      timestamp: number;
    }
  | {
      kind: "tool_result";
      toolCallId: string;
      toolName: string;
      ok: boolean;
      result?: unknown;
      error?: string | null;
      timestamp: number;
    }
  | {
      kind: "run_finished";
      usage?: DecisionUsage;
      finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
      timestamp: number;
    };

export type AssistantDeliveryEvent =
  | {
      kind: "attempt_started";
      attemptIndex: number;
      timestamp: number;
    }
  | {
      kind: "receipt";
      attemptIndex: number;
      status: AttentionReceiptStatus;
      providerEventKind: AttentionReceiptProviderEventKind;
      timestamp: number;
      finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
      usage?: DecisionUsage;
      errorCode?: string;
      errorMessage?: string;
    };

export type TextOnlyModelMessage = ModelMessage;

export interface ConsumeCommittedAttentionMessagesInput {
  iterationCount: number;
  messages: TextOnlyModelMessage[];
  finishReason: string | null;
}

interface RespondInput {
  systemPrompt: string;
  messages: TextOnlyModelMessage[];
  tools: Tool[];
  abortController?: AbortController;
  temperature?: number;
  maxTokens?: number;
  onUpdate?: (update: AssistantStreamUpdate) => void | Promise<void>;
  onDeliveryEvent?: (event: AssistantDeliveryEvent) => void | Promise<void>;
  consumeCommittedAttentionMessages?: (input: ConsumeCommittedAttentionMessagesInput) => TextOnlyModelMessage[] | undefined;
  shouldYieldAfterToolPhase?: () => boolean;
}

const appendChunk = (current: string, chunk: string | undefined): string => {
  if (!chunk) {
    return current;
  }
  return current + chunk;
};

const safeJsonParse = (input: string): unknown => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

const isRunFinishedChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "RUN_FINISHED" }> =>
  chunk.type === "RUN_FINISHED";

const isTextChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "TEXT_MESSAGE_CONTENT" }> =>
  chunk.type === "TEXT_MESSAGE_CONTENT";

const isThinkingChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "STEP_FINISHED" }> =>
  chunk.type === "STEP_FINISHED";

const isToolCallStartChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "TOOL_CALL_START" }> =>
  chunk.type === "TOOL_CALL_START";

const isToolCallArgsChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "TOOL_CALL_ARGS" }> =>
  chunk.type === "TOOL_CALL_ARGS";

const isToolCallEndChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "TOOL_CALL_END" }> =>
  chunk.type === "TOOL_CALL_END";

const isRunErrorChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "RUN_ERROR" }> =>
  chunk.type === "RUN_ERROR";

const toTransportDeliveryError = (message: string): ModelDecisionDeliveryError => ({
  providerEventKind: "transport_error",
  errorMessage: message,
});

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" || error.message === "This operation was aborted"
      : false;

export class ModelClient {
  private readonly textAdapter: AnyTextAdapter;
  private readonly summarizeAdapter: AnySummarizeAdapter | null;
  private readonly runtimeText: ReturnType<typeof createRuntimeText>;
  private readonly capabilities: ModelCapabilities;

  constructor(private readonly config: ModelProviderConfig) {
    this.capabilities = resolveModelCapabilities(config);
    this.textAdapter = this.createTextAdapter(config);
    this.summarizeAdapter = this.createSummarizeAdapter(config);
    this.runtimeText = createRuntimeText(config.lang);
  }

  getMeta(): {
    provider: string;
    model: string;
    providerId: string;
    apiStandard: ModelProviderConfig["apiStandard"];
    vendor?: string;
    profile?: string;
    baseUrl?: string;
    capabilities: ModelCapabilities;
  } {
    return {
      provider: this.config.vendor ? `${this.config.vendor}/${this.config.apiStandard}` : this.config.apiStandard,
      model: this.config.model,
      providerId: this.config.providerId,
      apiStandard: this.config.apiStandard,
      vendor: this.config.vendor,
      profile: this.config.profile,
      baseUrl: this.config.baseUrl,
      capabilities: this.capabilities,
    };
  }

  getContextBudgetTokens(): number | null {
    if (typeof this.config.maxContextTokens === "number" && Number.isFinite(this.config.maxContextTokens)) {
      return this.config.maxContextTokens;
    }
    if (typeof this.config.maxToken === "number" && Number.isFinite(this.config.maxToken)) {
      return this.config.maxToken;
    }
    return null;
  }

  async respondWithMeta(input: RespondInput): Promise<AssistantTurn> {
    if (!canCallModel(this.config)) {
      const timestamp = Date.now();
      const errorMessage = this.runtimeText.t("model.missing_api_key", { env: resolveApiEnvHint(this.config) });
      await input.onDeliveryEvent?.({
        kind: "attempt_started",
        attemptIndex: 1,
        timestamp,
      });
      await input.onDeliveryEvent?.({
        kind: "receipt",
        attemptIndex: 1,
        status: "errored",
        providerEventKind: "transport_error",
        timestamp,
        errorMessage,
      });
      throw new ModelDecisionError(errorMessage, {
        deliveryError: toTransportDeliveryError(errorMessage),
      });
    }

    const maxAttempts = Math.max(1, this.config.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = Date.now();
      await input.onDeliveryEvent?.({
        kind: "attempt_started",
        attemptIndex: attempt,
        timestamp: attemptStartedAt,
      });
      let terminalReceiptEmitted = false;
      const emitTerminalReceipt = async (event: Extract<AssistantDeliveryEvent, { kind: "receipt" }>): Promise<void> => {
        terminalReceiptEmitted = true;
        await input.onDeliveryEvent?.(event);
      };
      try {
        let text = "";
        let thinking = "";
        let usage: DecisionUsage | undefined;
        let finishReason: AssistantTurn["finishReason"];
        let yieldedAfterToolPhase = false;
        let acceptedEmitted = false;
        const toolCalls = new Map<string, { toolName: string; argsText: string }>();
        const defaultLoopStrategy = maxIterations(5);
        const effectiveMaxTokens = input.maxTokens ?? this.config.maxToken;
        const emitAcceptedReceipt = async (
          providerEventKind: Extract<
            AttentionReceiptProviderEventKind,
            "text_delta" | "thinking_delta" | "tool_call_start"
          >,
          timestamp: number,
        ): Promise<void> => {
          if (acceptedEmitted) {
            return;
          }
          acceptedEmitted = true;
          await input.onDeliveryEvent?.({
            kind: "receipt",
            attemptIndex: attempt,
            status: "accepted",
            providerEventKind,
            timestamp,
          });
        };

        for await (const chunk of chat({
          adapter: this.textAdapter,
          messages: input.messages,
          systemPrompts: [input.systemPrompt],
          tools: this.capabilities.tools ? input.tools : [],
          temperature: input.temperature ?? this.config.temperature,
          maxTokens: effectiveMaxTokens,
          modelOptions: this.buildModelOptions(effectiveMaxTokens),
          abortController: input.abortController,
          agentLoopStrategy: (state) => {
            if (!defaultLoopStrategy(state)) {
              return false;
            }
            if (state.finishReason === "tool_calls") {
              const committedAttentionMessages = input.consumeCommittedAttentionMessages?.({
                iterationCount: state.iterationCount,
                messages: state.messages,
                finishReason: state.finishReason,
              });
              if (committedAttentionMessages && committedAttentionMessages.length > 0) {
                state.messages.push(...committedAttentionMessages);
                return true;
              }
            }
            if (state.finishReason === "tool_calls" && input.shouldYieldAfterToolPhase?.()) {
              yieldedAfterToolPhase = true;
              return false;
            }
            return true;
          },
          stream: true,
        })) {
          if (isTextChunk(chunk)) {
            text = appendChunk(text, chunk.delta);
            await emitAcceptedReceipt("text_delta", chunk.timestamp);
            await input.onUpdate?.({
              kind: "draft",
              delta: chunk.delta,
              content: text,
              timestamp: chunk.timestamp,
            });
            continue;
          }
          if (isThinkingChunk(chunk)) {
            thinking = appendChunk(thinking, chunk.delta);
            await emitAcceptedReceipt("thinking_delta", chunk.timestamp);
            await input.onUpdate?.({
              kind: "thinking",
              delta: chunk.delta,
              content: thinking,
              timestamp: chunk.timestamp,
            });
            continue;
          }
          if (isToolCallStartChunk(chunk)) {
            toolCalls.set(chunk.toolCallId, { toolName: chunk.toolName, argsText: "" });
            await emitAcceptedReceipt("tool_call_start", chunk.timestamp);
            await input.onUpdate?.({
              kind: "tool_call",
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              argsText: "",
              timestamp: chunk.timestamp,
            });
            continue;
          }
          if (isToolCallArgsChunk(chunk)) {
            const current = toolCalls.get(chunk.toolCallId);
            const argsText = chunk.args ?? appendChunk(current?.argsText ?? "", chunk.delta);
            const toolName = current?.toolName ?? "tool";
            toolCalls.set(chunk.toolCallId, { toolName, argsText });
            await input.onUpdate?.({
              kind: "tool_call",
              toolCallId: chunk.toolCallId,
              toolName,
              argsText,
              input: safeJsonParse(argsText),
              timestamp: chunk.timestamp,
            });
            continue;
          }
          if (isToolCallEndChunk(chunk)) {
            const current = toolCalls.get(chunk.toolCallId);
            const toolName = current?.toolName ?? chunk.toolName;
            const argsText = current?.argsText ?? "";
            await input.onUpdate?.({
              kind: "tool_call",
              toolCallId: chunk.toolCallId,
              toolName,
              argsText,
              input: chunk.input ?? (argsText.length > 0 ? safeJsonParse(argsText) : undefined),
              timestamp: chunk.timestamp,
            });
            if (chunk.result !== undefined) {
              await input.onUpdate?.({
                kind: "tool_result",
                toolCallId: chunk.toolCallId,
                toolName,
                ok: true,
                result: safeJsonParse(chunk.result),
                timestamp: chunk.timestamp,
              });
            }
            toolCalls.delete(chunk.toolCallId);
            continue;
          }
          if (isRunFinishedChunk(chunk)) {
            usage = chunk.usage;
            finishReason = chunk.finishReason;
            await input.onUpdate?.({
              kind: "run_finished",
              usage,
              finishReason,
              timestamp: chunk.timestamp,
            });
            await emitTerminalReceipt({
              kind: "receipt",
              attemptIndex: attempt,
              status: "completed",
              providerEventKind: "run_finished",
              timestamp: chunk.timestamp,
              finishReason,
              usage,
            });
            continue;
          }
          if (isRunErrorChunk(chunk)) {
            await emitTerminalReceipt({
              kind: "receipt",
              attemptIndex: attempt,
              status: "errored",
              providerEventKind: "run_error",
              timestamp: chunk.timestamp,
              errorCode: chunk.error.code ?? undefined,
              errorMessage: chunk.error.message,
            });
            throw new ModelDecisionError(
              `${chunk.error.message}${chunk.error.code ? ` [${chunk.error.code}]` : ""}`,
              {
                deliveryError: {
                  providerEventKind: "run_error",
                  errorCode: chunk.error.code ?? undefined,
                  errorMessage: chunk.error.message,
                },
              },
            );
          }
        }

        if (!terminalReceiptEmitted) {
          const errorMessage = "model stream ended without a terminal receipt";
          await emitTerminalReceipt({
            kind: "receipt",
            attemptIndex: attempt,
            status: "errored",
            providerEventKind: "transport_error",
            timestamp: Date.now(),
            errorMessage,
          });
          throw new ModelDecisionError(errorMessage, {
            deliveryError: toTransportDeliveryError(errorMessage),
          });
        }

        return {
          thinking: thinking.trim(),
          text: text.trim(),
          usage,
          finishReason,
          yieldedAfterToolPhase,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const deliveryError =
          error instanceof ModelDecisionError ? error.deliveryError : toTransportDeliveryError(message);
        if (isAbortError(error)) {
          if (!terminalReceiptEmitted) {
            await emitTerminalReceipt({
              kind: "receipt",
              attemptIndex: attempt,
              status: "aborted",
              providerEventKind: "abort",
              timestamp: Date.now(),
              errorMessage: message,
            });
          }
          throw error;
        }
        if (!terminalReceiptEmitted) {
          await emitTerminalReceipt({
            kind: "receipt",
            attemptIndex: attempt,
            status: "errored",
            providerEventKind: deliveryError?.providerEventKind ?? "transport_error",
            timestamp: Date.now(),
            errorCode: deliveryError?.errorCode,
            errorMessage: deliveryError?.errorMessage ?? message,
          });
        }
        if (attempt >= maxAttempts || !this.isRetryable(message)) {
          throw new ModelDecisionError(
            `${this.config.apiStandard} response failed after ${attempt} attempt(s): ${message}`,
            { cause: error, deliveryError },
          );
        }
        await Bun.sleep(Math.min(2_000, 300 * 2 ** (attempt - 1)));
      }
    }

    throw new ModelDecisionError(`${this.config.apiStandard} response failed: retries exhausted`, {
      deliveryError: {
        providerEventKind: "transport_error",
        errorMessage: `${this.config.apiStandard} response failed: retries exhausted`,
      },
    });
  }

  private buildModelOptions(maxTokens: number | undefined): Record<string, unknown> | undefined {
    if (this.config.apiStandard !== "anthropic") {
      return undefined;
    }
    const options: Record<string, unknown> = {};
    if (typeof this.config.topK === "number") {
      options.top_k = this.config.topK;
    }
    if (this.config.thinking?.enabled === true && (maxTokens === undefined || maxTokens > 1_024)) {
      const fallbackBudget = this.config.thinking.budgetTokens ?? 1_024;
      const clampedBudget =
        typeof maxTokens === "number"
          ? Math.max(1_024, Math.min(fallbackBudget, maxTokens - 1))
          : Math.max(1_024, fallbackBudget);
      options.thinking = {
        type: "enabled",
        budget_tokens: clampedBudget,
      };
    } else if (this.config.thinking?.enabled === false) {
      options.thinking = {
        type: "disabled",
      };
    }
    return Object.keys(options).length > 0 ? options : undefined;
  }

  async summarizeText(text: string): Promise<{ summary: string; usage?: DecisionUsage; skipped?: string }> {
    if (!this.summarizeAdapter) {
      return { summary: "", skipped: `summarize adapter not available for ${this.config.apiStandard}` };
    }
    if (!canCallModel(this.config)) {
      return { summary: "", skipped: `missing api key for ${this.config.apiStandard}` };
    }

    try {
      const result = await summarize({
        adapter: this.summarizeAdapter,
        text,
        style: "concise",
      });
      return {
        summary: result.summary,
        usage: result.usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        summary: "",
        skipped: message,
      };
    }
  }

  private isRetryable(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("fetch failed") ||
      normalized.includes("network") ||
      normalized.includes("timeout") ||
      normalized.includes("429") ||
      normalized.includes("500") ||
      normalized.includes("502") ||
      normalized.includes("503") ||
      normalized.includes("504")
    );
  }

  private createTextAdapter(config: ModelProviderConfig): AnyTextAdapter {
    const model = config.model;
    const headers = resolveProviderHeaders(config);
    if (isOllamaProvider(config)) {
      return createOllamaChat(model as never, config.baseUrl) as unknown as AnyTextAdapter;
    }
    if (config.apiStandard === "anthropic") {
      return createAnthropicChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnyTextAdapter;
    }
    if (config.apiStandard === "gemini") {
      return createGeminiChat(model as never, config.apiKey ?? "", {}) as unknown as AnyTextAdapter;
    }
    if (config.apiStandard === "openai-responses") {
      return createOpenaiChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
        defaultHeaders: headers,
      }) as unknown as AnyTextAdapter;
    }
    if (config.apiStandard === "openai-completion") {
      return new OpenAICompletionTextAdapter(
        {
          apiKey: config.apiKey ?? "",
          baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
          headers,
          name: config.vendor ?? "openai-completion-compatible",
        },
        model as never,
      ) as unknown as AnyTextAdapter;
    }
    return new OpenAICompatChatTextAdapter(
      {
        apiKey: config.apiKey ?? "",
        baseUrl:
          config.baseUrl ?? (isDeepseekVendor(config) ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1"),
        headers,
        name: config.vendor ?? "openai-chat-compatible",
      },
      model as never,
    ) as unknown as AnyTextAdapter;
  }

  private createSummarizeAdapter(config: ModelProviderConfig): AnySummarizeAdapter | null {
    if (!this.capabilities.summarizeFallback) {
      return null;
    }
    return new TextBackedSummarizeAdapter(this.textAdapter, config.model, config.vendor ?? config.apiStandard);
  }
}
