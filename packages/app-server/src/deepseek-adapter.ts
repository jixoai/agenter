import type { DefaultMessageMetadataByModality, ModelMessage, StreamChunk, TextOptions, Tool } from "@tanstack/ai";
import { BaseTextAdapter, type StructuredOutputOptions, type StructuredOutputResult } from "@tanstack/ai/adapters";

type DeepseekProviderOptions = Record<string, unknown>;

export interface OpenAICompatChatTextConfig {
  apiKey: string;
  baseUrl: string;
  name?: string;
  headers?: Record<string, string>;
}

interface OpenAICompatToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAICompatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAICompatToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAICompatCompletionResponse {
  choices?: Array<{
    finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | null;
    message?: {
      role?: "assistant";
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: OpenAICompatToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/g, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
};

const compactPreview = (input: string, max = 240): string => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max)}...`;
};

const extractBalancedJson = (input: string): string | null => {
  let start = -1;
  let inString = false;
  let escapeNext = false;
  const stack: string[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (start < 0) {
      if (char === "{" || char === "[") {
        start = index;
        stack.push(char === "{" ? "}" : "]");
      }
      continue;
    }

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }
    if (char === "}" || char === "]") {
      const expected = stack[stack.length - 1];
      if (char !== expected) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
};

const parseJsonText = (content: string): unknown => {
  const trimmed = content.trim();
  const errors: string[] = [];

  const parseCandidate = (candidate: string): unknown | null => {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      return null;
    }
  };

  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseCandidate(fenced[1].trim());
    if (parsed !== null) {
      return parsed;
    }
  }

  const direct = parseCandidate(trimmed);
  if (direct !== null) {
    return direct;
  }

  const extracted = extractBalancedJson(trimmed);
  if (extracted) {
    const parsed = parseCandidate(extracted);
    if (parsed !== null) {
      return parsed;
    }
  }

  const details = errors.length > 0 ? errors[errors.length - 1] : "unknown parse error";
  throw new Error(`JSON Parse error: ${details}; rawPreview="${compactPreview(trimmed)}"`);
};

const extractTextContent = (content: ModelMessage["content"]): string => {
  if (typeof content === "string") {
    return content;
  }
  if (content === null || content === undefined) {
    return "";
  }
  return content
    .map((part) => (part.type === "text" ? part.content : ""))
    .filter((text) => text.length > 0)
    .join("\n");
};

const convertMessages = (messages: ModelMessage[], systemPrompts: string[] = []): OpenAICompatMessage[] => {
  const result: OpenAICompatMessage[] = systemPrompts
    .filter((prompt) => prompt.trim().length > 0)
    .map((prompt) => ({
      role: "system",
      content: prompt,
    }));

  for (const message of messages) {
    if (message.role === "tool") {
      result.push({
        role: "tool",
        content: extractTextContent(message.content),
        tool_call_id: message.toolCallId,
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      result.push({
        role: "assistant",
        content: extractTextContent(message.content) || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })),
      });
      continue;
    }

    result.push({
      role: message.role,
      content: extractTextContent(message.content),
      name: message.name,
    });
  }

  return result;
};

const convertTools = (tools: Tool[] = []): Array<Record<string, unknown>> => {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  }));
};

export class OpenAICompatChatTextAdapter<TModel extends string> extends BaseTextAdapter<
  TModel,
  DeepseekProviderOptions,
  readonly ["text"],
  DefaultMessageMetadataByModality
> {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private lastUsage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined;

  constructor(config: OpenAICompatChatTextConfig, model: TModel) {
    super({ apiKey: config.apiKey, baseUrl: config.baseUrl }, model);
    this.name = config.name ?? "openai-chat-compatible";
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.headers = config.headers ?? {};
    this.lastUsage = undefined;
  }

  getLastUsage():
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined {
    return this.lastUsage;
  }

  async *chatStream(options: TextOptions<DeepseekProviderOptions>): AsyncIterable<StreamChunk> {
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
      messages: convertMessages(options.messages ?? [], options.systemPrompts ?? []),
      tools: convertTools(options.tools ?? []),
      tool_choice: options.tools && options.tools.length > 0 ? "auto" : undefined,
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      stream: false,
      ...(typeof options.modelOptions === "object" && options.modelOptions ? options.modelOptions : {}),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
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

    const data = (await response.json()) as OpenAICompatCompletionResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content ?? "";
    const reasoningContent = message?.reasoning_content ?? "";
    const toolCalls = message?.tool_calls ?? [];

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

    if (reasoningContent.length > 0) {
      const stepId = createId("step");
      yield {
        type: "STEP_STARTED",
        stepId,
        stepType: "thinking",
        timestamp: Date.now(),
        model: this.model,
      };
      yield {
        type: "STEP_FINISHED",
        stepId,
        delta: reasoningContent,
        content: reasoningContent,
        timestamp: Date.now(),
        model: this.model,
      };
    }

    for (let index = 0; index < toolCalls.length; index += 1) {
      const toolCall = toolCalls[index];
      yield {
        type: "TOOL_CALL_START",
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        index,
        timestamp: Date.now(),
        model: this.model,
      };
      if (toolCall.function.arguments.length > 0) {
        yield {
          type: "TOOL_CALL_ARGS",
          toolCallId: toolCall.id,
          delta: toolCall.function.arguments,
          args: toolCall.function.arguments,
          timestamp: Date.now(),
          model: this.model,
        };
      }
    }

    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;
    this.lastUsage = usage;
    yield {
      type: "RUN_FINISHED",
      runId,
      finishReason: choice?.finish_reason ?? (toolCalls.length > 0 ? "tool_calls" : "stop"),
      usage,
      timestamp: Date.now(),
      model: this.model,
    };
  }

  async structuredOutput(
    options: StructuredOutputOptions<DeepseekProviderOptions>,
  ): Promise<StructuredOutputResult<unknown>> {
    const payload = {
      model: this.model,
      messages: convertMessages(options.chatOptions.messages ?? [], options.chatOptions.systemPrompts ?? []),
      temperature: options.chatOptions.temperature,
      top_p: options.chatOptions.topP,
      max_tokens: options.chatOptions.maxTokens,
      stream: false,
      ...(typeof options.chatOptions.modelOptions === "object" && options.chatOptions.modelOptions
        ? options.chatOptions.modelOptions
        : {}),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.headers,
      },
      signal: options.chatOptions.request?.signal,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${response.status} status code (${text || "no body"})`);
    }

    const data = (await response.json()) as OpenAICompatCompletionResponse;
    const rawText = data.choices?.[0]?.message?.content ?? "";
    if (rawText.length === 0) {
      throw new Error("empty structured output content");
    }
    return {
      rawText,
      data: parseJsonText(rawText),
    };
  }
}

export class DeepseekTextAdapter<TModel extends string> extends OpenAICompatChatTextAdapter<TModel> {
  constructor(config: OpenAICompatChatTextConfig, model: TModel) {
    super({ ...config, name: "deepseek" }, model);
  }
}
