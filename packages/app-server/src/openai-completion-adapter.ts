import type { DefaultMessageMetadataByModality, ModelMessage, StreamChunk, TextOptions } from "@tanstack/ai";
import { BaseTextAdapter, type StructuredOutputOptions, type StructuredOutputResult } from "@tanstack/ai/adapters";

interface OpenAICompletionResponse {
  choices?: Array<{
    finish_reason?: "stop" | "length" | "content_filter" | null;
    text?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface OpenAICompletionTextConfig {
  apiKey: string;
  baseUrl: string;
  name?: string;
  headers?: Record<string, string>;
}

const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/g, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
};

const extractTextContent = (content: ModelMessage["content"]): string => {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => (part.type === "text" ? part.content : ""))
    .filter((value) => value.length > 0)
    .join("\n");
};

const toPrompt = (messages: ModelMessage[], systemPrompts: string[] = []): string => {
  const sections: string[] = [];
  for (const prompt of systemPrompts) {
    if (prompt.trim().length > 0) {
      sections.push(`System:\n${prompt}`);
    }
  }
  for (const message of messages) {
    const label =
      message.role === "assistant"
        ? "Assistant"
        : message.role === "tool"
          ? `Tool${message.toolCallId ? `(${message.toolCallId})` : ""}`
          : message.role === "user"
            ? "User"
            : "System";
    const content = extractTextContent(message.content);
    if (content.trim().length > 0) {
      sections.push(`${label}:\n${content}`);
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      sections.push(
        `Assistant tool calls:\n${JSON.stringify(
          message.toolCalls.map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          })),
          null,
          2,
        )}`,
      );
    }
  }
  sections.push("Assistant:");
  return sections.join("\n\n");
};

const parseJsonText = (content: string): unknown => {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

export class OpenAICompletionTextAdapter<TModel extends string> extends BaseTextAdapter<
  TModel,
  Record<string, unknown>,
  readonly ["text"],
  DefaultMessageMetadataByModality
> {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenAICompletionTextConfig, model: TModel) {
    super({ apiKey: config.apiKey, baseUrl: config.baseUrl }, model);
    this.name = config.name ?? "openai-completion-compatible";
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.headers = config.headers ?? {};
  }

  async *chatStream(options: TextOptions<Record<string, unknown>>): AsyncIterable<StreamChunk> {
    const runId = createId("run");
    const messageId = createId("msg");
    const timestamp = Date.now();

    yield {
      type: "RUN_STARTED",
      runId,
      timestamp,
      model: this.model,
    };

    const payload = {
      model: this.model,
      prompt: toPrompt(options.messages ?? [], options.systemPrompts ?? []),
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      stream: false,
      ...(typeof options.modelOptions === "object" && options.modelOptions ? options.modelOptions : {}),
    };

    const response = await fetch(`${this.baseUrl}/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.headers,
      },
      signal: options.request?.signal,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      yield {
        type: "RUN_ERROR",
        runId,
        timestamp: Date.now(),
        model: this.model,
        error: {
          message: `${response.status} status code (${text || "no body"})`,
        },
      };
      return;
    }

    const data = (await response.json()) as OpenAICompletionResponse;
    const choice = data.choices?.[0];
    const content = choice?.text?.trim() ?? "";

    if (content.length > 0) {
      yield {
        type: "TEXT_MESSAGE_START",
        messageId,
        role: "assistant",
        timestamp: Date.now(),
        model: this.model,
      };
      yield {
        type: "TEXT_MESSAGE_CONTENT",
        messageId,
        delta: content,
        content,
        timestamp: Date.now(),
        model: this.model,
      };
      yield {
        type: "TEXT_MESSAGE_END",
        messageId,
        timestamp: Date.now(),
        model: this.model,
      };
    }

    yield {
      type: "RUN_FINISHED",
      runId,
      finishReason: choice?.finish_reason ?? "stop",
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
      timestamp: Date.now(),
      model: this.model,
    };
  }

  async structuredOutput(
    options: StructuredOutputOptions<Record<string, unknown>>,
  ): Promise<StructuredOutputResult<unknown>> {
    const prompt = toPrompt(options.chatOptions.messages ?? [], options.chatOptions.systemPrompts ?? []);
    const response = await fetch(`${this.baseUrl}/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.headers,
      },
      signal: options.chatOptions.request?.signal,
      body: JSON.stringify({
        model: this.model,
        prompt,
        temperature: options.chatOptions.temperature,
        top_p: options.chatOptions.topP,
        max_tokens: options.chatOptions.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status} status code (${text || "no body"})`);
    }

    const data = (await response.json()) as OpenAICompletionResponse;
    const rawText = data.choices?.[0]?.text?.trim() ?? "";
    if (rawText.length === 0) {
      throw new Error("empty structured output content");
    }
    return {
      rawText,
      data: parseJsonText(rawText),
    };
  }
}
