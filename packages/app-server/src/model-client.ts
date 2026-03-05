import {
  chat,
  summarize,
  type AnySummarizeAdapter,
  type AnyTextAdapter,
  type StreamChunk,
  type Tool,
} from "@tanstack/ai";
import { createAnthropicChat, createAnthropicSummarize } from "@tanstack/ai-anthropic";
import { createGeminiChat, createGeminiSummarize } from "@tanstack/ai-gemini";
import { createOllamaChat, createOllamaSummarize } from "@tanstack/ai-ollama";
import { createOpenaiChat, createOpenaiSummarize } from "@tanstack/ai-openai";
import { DeepseekTextAdapter } from "./deepseek-adapter";
import { createRuntimeText } from "./runtime-text";

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

export interface TextOnlyModelMessage {
  role: "user" | "assistant" | "tool";
  content: Array<{
    type: "text";
    content: string;
  }>;
  name?: string;
}

export interface ModelProviderConfig {
  providerId: string;
  kind:
    | "deepseek"
    | "openai"
    | "anthropic"
    | "gemini"
    | "grok"
    | "ollama"
    | "openai-compatible"
    | "anthropic-compatible";
  model: string;
  lang?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxRetries: number;
  maxToken?: number;
  compactThreshold?: number;
}

interface RespondInput {
  systemPrompt: string;
  messages: TextOnlyModelMessage[];
  tools: Tool[];
}

const isDeepseekBaseUrl = (baseUrl: string | undefined): boolean => {
  if (!baseUrl) {
    return false;
  }
  const value = baseUrl.toLowerCase();
  return value.includes("api.deepseek.com");
};

const appendChunk = (current: string, chunk: string | undefined): string => {
  if (!chunk) {
    return current;
  }
  return current + chunk;
};

const isRunFinishedChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "RUN_FINISHED" }> =>
  chunk.type === "RUN_FINISHED";

const isTextChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "TEXT_MESSAGE_CONTENT" }> =>
  chunk.type === "TEXT_MESSAGE_CONTENT";

const isThinkingChunk = (chunk: StreamChunk): chunk is Extract<StreamChunk, { type: "STEP_FINISHED" }> =>
  chunk.type === "STEP_FINISHED";

export class ModelClient {
  private readonly textAdapter: AnyTextAdapter;
  private readonly summarizeAdapter: AnySummarizeAdapter | null;
  private readonly runtimeText: ReturnType<typeof createRuntimeText>;

  constructor(private readonly config: ModelProviderConfig) {
    this.textAdapter = this.createTextAdapter(config);
    this.summarizeAdapter = this.createSummarizeAdapter(config);
    this.runtimeText = createRuntimeText(config.lang);
  }

  getMeta(): { provider: string; model: string; providerId: string; baseUrl?: string } {
    return {
      provider: this.config.kind,
      model: this.config.model,
      providerId: this.config.providerId,
      baseUrl: this.config.baseUrl,
    };
  }

  getCompactConfig(): { maxToken?: number; compactThreshold?: number } {
    return {
      maxToken: this.config.maxToken,
      compactThreshold: this.config.compactThreshold,
    };
  }

  async respondWithMeta(input: RespondInput): Promise<AssistantTurn> {
    if (!this.canCallModel()) {
      return {
        thinking: "",
        text: this.runtimeText.t("model.missing_api_key", { env: this.resolveApiEnvHint() }),
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

        for await (const chunk of chat({
          adapter: this.textAdapter,
          messages: input.messages,
          systemPrompts: [input.systemPrompt],
          tools: input.tools,
          temperature: this.config.temperature,
          stream: true,
        })) {
          if (isTextChunk(chunk)) {
            text = appendChunk(text, chunk.delta);
            continue;
          }
          if (isThinkingChunk(chunk)) {
            thinking = appendChunk(thinking, chunk.delta);
            continue;
          }
          if (isRunFinishedChunk(chunk)) {
            usage = chunk.usage;
            finishReason = chunk.finishReason;
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
          throw new ModelDecisionError(`${this.config.kind} response failed after ${attempt} attempt(s): ${message}`, {
            cause: error,
          });
        }
        await Bun.sleep(Math.min(2_000, 300 * 2 ** (attempt - 1)));
      }
    }

    throw new ModelDecisionError(`${this.config.kind} response failed: retries exhausted`);
  }

  async summarizeText(text: string): Promise<{ summary: string; usage?: DecisionUsage; skipped?: string }> {
    if (!this.summarizeAdapter) {
      return { summary: "", skipped: `summarize adapter not available for ${this.config.kind}` };
    }
    if (!this.canCallModel()) {
      return { summary: "", skipped: `missing api key for ${this.config.kind}` };
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

  private canCallModel(): boolean {
    if (this.config.kind === "ollama") {
      return true;
    }
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  private resolveApiEnvHint(): string {
    if (
      this.config.kind === "deepseek" ||
      (this.config.kind === "openai-compatible" && isDeepseekBaseUrl(this.config.baseUrl))
    ) {
      return "DEEPSEEK_API_KEY";
    }
    if (this.config.kind === "anthropic" || this.config.kind === "anthropic-compatible") {
      return "ANTHROPIC_API_KEY";
    }
    if (this.config.kind === "gemini") {
      return "GOOGLE_API_KEY/GEMINI_API_KEY";
    }
    return "OPENAI_API_KEY";
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
    if (config.kind === "deepseek" || (config.kind === "openai-compatible" && isDeepseekBaseUrl(config.baseUrl))) {
      return new DeepseekTextAdapter(
        {
          apiKey: config.apiKey ?? "",
          baseUrl: config.baseUrl ?? "https://api.deepseek.com/v1",
        },
        model as never,
      ) as unknown as AnyTextAdapter;
    }
    if (config.kind === "openai") {
      return createOpenaiChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnyTextAdapter;
    }
    if (config.kind === "anthropic") {
      return createAnthropicChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnyTextAdapter;
    }
    if (config.kind === "gemini") {
      return createGeminiChat(model as never, config.apiKey ?? "", {}) as unknown as AnyTextAdapter;
    }
    if (config.kind === "ollama") {
      return createOllamaChat(model as never, config.baseUrl) as unknown as AnyTextAdapter;
    }
    if (config.kind === "anthropic-compatible") {
      return createAnthropicChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnyTextAdapter;
    }
    if (config.kind === "grok") {
      return createOpenaiChat(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnyTextAdapter;
    }
    return createOpenaiChat(model as never, config.apiKey ?? "", {
      baseURL: config.baseUrl,
    }) as unknown as AnyTextAdapter;
  }

  private createSummarizeAdapter(config: ModelProviderConfig): AnySummarizeAdapter | null {
    const model = config.model;
    if (config.kind === "deepseek" || (config.kind === "openai-compatible" && isDeepseekBaseUrl(config.baseUrl))) {
      return null;
    }
    if (config.kind === "openai") {
      return createOpenaiSummarize(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnySummarizeAdapter;
    }
    if (config.kind === "anthropic") {
      return createAnthropicSummarize(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnySummarizeAdapter;
    }
    if (config.kind === "gemini") {
      return createGeminiSummarize(config.apiKey ?? "", model as never, {}) as unknown as AnySummarizeAdapter;
    }
    if (config.kind === "ollama") {
      return createOllamaSummarize(model as never, config.baseUrl) as unknown as AnySummarizeAdapter;
    }
    if (config.kind === "anthropic-compatible") {
      return createAnthropicSummarize(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnySummarizeAdapter;
    }
    if (config.kind === "grok") {
      return createOpenaiSummarize(model as never, config.apiKey ?? "", {
        baseURL: config.baseUrl,
      }) as unknown as AnySummarizeAdapter;
    }
    return createOpenaiSummarize(model as never, config.apiKey ?? "", {
      baseURL: config.baseUrl,
    }) as unknown as AnySummarizeAdapter;
  }
}
