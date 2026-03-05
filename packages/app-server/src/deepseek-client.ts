import { chat, type Tool, type StreamChunk } from "@tanstack/ai";

import { DeepseekTextAdapter } from "./deepseek-adapter";
import { createRuntimeText } from "./runtime-text";

interface RetryTrace {
  attempt: number;
  retryable: boolean;
  message: string;
  timestamp: string;
}

export class DeepseekDecisionError extends Error {
  readonly attempts: RetryTrace[];

  constructor(message: string, attempts: RetryTrace[], options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DeepseekDecisionError";
    this.attempts = attempts;
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

export interface DeepseekClientOptions {
  temperature?: number;
  maxRetries?: number;
  lang?: string;
}

interface RespondInput {
  systemPrompt: string;
  messages: TextOnlyModelMessage[];
  tools: Tool[];
}

export interface TextOnlyModelMessage {
  role: "user" | "assistant" | "tool";
  content: Array<{
    type: "text";
    content: string;
  }>;
  name?: string;
}

const appendChunk = (current: string, chunk: string | undefined): string => {
  if (!chunk || chunk.length === 0) {
    return current;
  }
  return current + chunk;
};

const isRunFinishedChunk = (
  chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "RUN_FINISHED" }> => chunk.type === "RUN_FINISHED";

const isTextChunk = (
  chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "TEXT_MESSAGE_CONTENT" }> => chunk.type === "TEXT_MESSAGE_CONTENT";

const isThinkingChunk = (
  chunk: StreamChunk,
): chunk is Extract<StreamChunk, { type: "STEP_FINISHED" }> => chunk.type === "STEP_FINISHED";

export class DeepseekClient {
  private readonly adapter: DeepseekTextAdapter<string>;
  private readonly maxRetries: number;
  private readonly temperature: number;
  private readonly runtimeText: ReturnType<typeof createRuntimeText>;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly baseUrl = "https://api.deepseek.com/v1",
    options: DeepseekClientOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 2;
    this.temperature = options.temperature ?? 0.2;
    this.adapter = new DeepseekTextAdapter(
      {
        apiKey: apiKey ?? "",
        baseUrl,
      },
      model,
    );
    this.runtimeText = createRuntimeText(options.lang);
  }

  getMeta(): { provider: "deepseek(openai-compatible)"; model: string; baseUrl: string } {
    return {
      provider: "deepseek(openai-compatible)",
      model: this.model,
      baseUrl: this.baseUrl,
    };
  }

  async respondWithMeta(input: RespondInput): Promise<AssistantTurn> {
    if (!this.apiKey) {
      return {
        thinking: "",
        text: this.runtimeText.t("model.missing_api_key", { env: "DEEPSEEK_API_KEY" }),
        finishReason: "stop",
      };
    }

    const attempts: RetryTrace[] = [];
    const totalAttempts = this.maxRetries + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        let text = "";
        let thinking = "";
        let usage: DecisionUsage | undefined;
        let finishReason: "stop" | "length" | "content_filter" | "tool_calls" | null | undefined;

        for await (const chunk of chat({
          adapter: this.adapter,
          messages: input.messages,
          systemPrompts: [input.systemPrompt],
          tools: input.tools,
          temperature: this.temperature,
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
        const retryable = this.isRetryableError(message);
        attempts.push({
          attempt,
          retryable,
          message,
          timestamp: new Date().toISOString(),
        });

        if (!retryable || attempt >= totalAttempts) {
          throw new DeepseekDecisionError(
            `deepseek response failed after ${attempt} attempt(s): ${message}`,
            attempts,
            { cause: error },
          );
        }

        await Bun.sleep(this.resolveRetryDelayMs(attempt));
      }
    }

    throw new DeepseekDecisionError("deepseek response failed: retries exhausted", attempts);
  }

  private resolveRetryDelayMs(attempt: number): number {
    return Math.min(2000, 300 * 2 ** (attempt - 1));
  }

  private isRetryableError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("fetch failed") ||
      normalized.includes("network") ||
      normalized.includes("timeout") ||
      normalized.includes("429 status code") ||
      normalized.includes("500 status code") ||
      normalized.includes("502 status code") ||
      normalized.includes("503 status code") ||
      normalized.includes("504 status code")
    );
  }
}
