/**
 * LLM Adapters for @tanstack/ai
 * Functional approach to creating connection adapters
 */
import { BaseTextAdapter, type AnyTextAdapter } from "@tanstack/ai/adapters";
import type { TextOptions, StreamChunk } from "@tanstack/ai";

// ============================================================================
// Types
// ============================================================================

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
}

// Re-export Message from chat.ts to ensure consistency
export type { Message } from "./chat.ts";

// ============================================================================
// DeepSeek Adapter
// ============================================================================

/**
 * DeepSeek adapter for @tanstack/ai
 * Using unknown for all metadata types to satisfy DefaultMessageMetadataByModality
 */
export class DeepSeekAdapter extends BaseTextAdapter<
  string,
  { temperature?: number; stream?: boolean },
  readonly ["text"],
  { text: unknown; image: unknown; audio: unknown; video: unknown; document: unknown }
> {
  readonly name = "deepseek";

  constructor(
    model: string,
    private llmConfig: LLMConfig
  ) {
    super({
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
    }, model);
  }

  async *chatStream(
    options: TextOptions<{ temperature?: number; stream?: boolean }>
  ): AsyncIterable<StreamChunk> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.modelOptions?.temperature ?? this.llmConfig.temperature ?? 0,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`DeepSeek error ${response.status}: ${body}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield {
              type: "TEXT_MESSAGE_CONTENT",
              delta: content,
            } as StreamChunk;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  async structuredOutput(): Promise<{ data: unknown; rawText: string }> {
    throw new Error("Structured output not implemented for DeepSeek");
  }
}

// ============================================================================
// Mock Adapter (for testing)
// ============================================================================

/**
 * Mock adapter for testing without API calls
 */
export class MockAdapter extends BaseTextAdapter<
  "mock",
  { temperature?: number; stream?: boolean },
  readonly ["text"],
  { text: unknown; image: unknown; audio: unknown; video: unknown; document: unknown }
> {
  readonly name = "mock";

  constructor() {
    super({ apiKey: "mock", baseUrl: "" }, "mock");
  }

  async *chatStream(
    options: TextOptions<{ temperature?: number; stream?: boolean }>
  ): AsyncIterable<StreamChunk> {
    const lastMessage = options.messages[options.messages.length - 1];
    const content = lastMessage?.content ?? "";
    const reply = `Mock response to: ${typeof content === 'string' ? content.slice(0, 50) : '[non-text content]'}`;

    for (const char of reply) {
      yield {
        type: "TEXT_MESSAGE_CONTENT",
        delta: char,
      } as StreamChunk;
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  async structuredOutput(): Promise<{ data: unknown; rawText: string }> {
    throw new Error("Structured output not implemented for Mock");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const getAdapter = (
  provider: "deepseek" | "mock",
  config?: LLMConfig
): AnyTextAdapter => {
  switch (provider) {
    case "deepseek":
      if (!config) throw new Error("DeepSeek requires config");
      return new DeepSeekAdapter(config.model, config);
    case "mock":
      return new MockAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};
