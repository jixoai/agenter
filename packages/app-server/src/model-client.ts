import {
  chat,
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
export class ModelDecisionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelDecisionError";
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
}

export type AssistantStreamUpdate =
  | {
      kind: "draft";
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

export type TextOnlyModelMessage = ModelMessage;

interface RespondInput {
  systemPrompt: string;
  messages: TextOnlyModelMessage[];
  tools: Tool[];
  abortController?: AbortController;
  onUpdate?: (update: AssistantStreamUpdate) => void | Promise<void>;
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

  getCompactConfig(): { maxToken?: number; compactThreshold?: number } {
    return {
      maxToken: this.config.maxToken,
      compactThreshold: this.config.compactThreshold,
    };
  }

  async respondWithMeta(input: RespondInput): Promise<AssistantTurn> {
    if (!canCallModel(this.config)) {
      return {
        thinking: "",
        text: this.runtimeText.t("model.missing_api_key", { env: resolveApiEnvHint(this.config) }),
        finishReason: "stop",
      };
    }

    const maxAttempts = Math.max(1, this.config.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        let text = "";
        let thinking = "";
        let usage: DecisionUsage | undefined;
        let finishReason: AssistantTurn["finishReason"];
        const toolCalls = new Map<string, { toolName: string; argsText: string }>();

        for await (const chunk of chat({
          adapter: this.textAdapter,
          messages: input.messages,
          systemPrompts: [input.systemPrompt],
          tools: this.capabilities.tools ? input.tools : [],
          temperature: this.config.temperature,
          abortController: input.abortController,
          stream: true,
        })) {
          if (isTextChunk(chunk)) {
            text = appendChunk(text, chunk.delta);
            await input.onUpdate?.({
              kind: "draft",
              content: text,
              timestamp: chunk.timestamp,
            });
            continue;
          }
          if (isThinkingChunk(chunk)) {
            thinking = appendChunk(thinking, chunk.delta);
            continue;
          }
          if (isToolCallStartChunk(chunk)) {
            toolCalls.set(chunk.toolCallId, { toolName: chunk.toolName, argsText: "" });
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
          }
        }

        return {
          thinking: thinking.trim(),
          text: text.trim(),
          usage,
          finishReason,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= maxAttempts || !this.isRetryable(message)) {
          throw new ModelDecisionError(
            `${this.config.apiStandard} response failed after ${attempt} attempt(s): ${message}`,
            { cause: error },
          );
        }
        await Bun.sleep(Math.min(2_000, 300 * 2 ** (attempt - 1)));
      }
    }

    throw new ModelDecisionError(`${this.config.apiStandard} response failed: retries exhausted`);
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
        baseUrl: config.baseUrl ?? (isDeepseekVendor(config) ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1"),
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
