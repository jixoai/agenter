import { toJSONSchema, z } from "zod";

import type { AssistantTurn, ModelClient, TextOnlyModelMessage } from "./model-client";

const DEFAULT_BOOLEAN_TRUE_TOKEN = "1";
const DEFAULT_BOOLEAN_FALSE_TOKEN = "0";
const DEFAULT_BOOLEAN_MAX_TOKENS = 1;
const DEFAULT_SPAN_MAX_TOKENS = 12;
const DEFAULT_STRUCTURED_MAX_TOKENS = 128;
const RANGE_PATTERN = /\[\s*(\d+)\s*,\s*(\d+)\s*\]/u;

type SemanticJudgeModelInput = Parameters<ModelClient["respondWithMeta"]>[0];

export interface SemanticJudgeSpan {
  start: number;
  end: number;
}

export interface SemanticJudgeModelClient {
  respondWithMeta: (input: SemanticJudgeModelInput) => Promise<AssistantTurn>;
}

interface SemanticJudgeCallBase {
  content: string;
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface JudgeBooleanInput extends SemanticJudgeCallBase {
  instruction: string;
  trueToken?: string;
  falseToken?: string;
}

export interface JudgeSpanInput extends SemanticJudgeCallBase {
  instruction: string;
}

export interface JudgeStructuredInput<TSchema extends z.ZodType> extends SemanticJudgeCallBase {
  instruction: string;
  outputSchema: TSchema;
}

export interface JudgeCompletionInput<TResult> extends SemanticJudgeCallBase {
  instruction: string;
  prefix: string;
  parse: (value: string) => TResult;
}

export class SemanticJudgeDecisionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SemanticJudgeDecisionError";
  }
}

const toMessage = (role: TextOnlyModelMessage["role"], content: string): TextOnlyModelMessage =>
  ({
    role,
    content,
  }) satisfies TextOnlyModelMessage;

const linkAbortController = (
  signal: AbortSignal | undefined,
): {
  abortController: AbortController | undefined;
  cleanup: () => void;
} => {
  if (!signal) {
    return {
      abortController: undefined,
      cleanup: () => {},
    };
  }
  const abortController = new AbortController();
  if (signal.aborted) {
    abortController.abort(signal.reason);
    return {
      abortController,
      cleanup: () => {},
    };
  }
  const handleAbort = (): void => abortController.abort(signal.reason);
  signal.addEventListener("abort", handleAbort, { once: true });
  return {
    abortController,
    cleanup: () => signal.removeEventListener("abort", handleAbort),
  };
};

const extractJsonText = (value: string): string | null => {
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return trimmed;
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }
  return null;
};

const parseSpan = (value: string): SemanticJudgeSpan => {
  const match = RANGE_PATTERN.exec(value);
  if (!match) {
    throw new SemanticJudgeDecisionError(`semantic judge returned invalid span: ${JSON.stringify(value)}`);
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new SemanticJudgeDecisionError(`semantic judge returned invalid span bounds: ${JSON.stringify(value)}`);
  }
  return { start, end };
};

export class SemanticJudge {
  constructor(private readonly modelClient: SemanticJudgeModelClient) {}

  private async runText(input: {
    systemPrompt: string;
    messages: TextOnlyModelMessage[];
    signal?: AbortSignal;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const { abortController, cleanup } = linkAbortController(input.signal);
    try {
      const response = await this.modelClient.respondWithMeta({
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        tools: [],
        abortController,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      });
      return response.text.trim();
    } finally {
      cleanup();
    }
  }

  async judgeBoolean(input: JudgeBooleanInput): Promise<boolean> {
    const trueToken = input.trueToken ?? DEFAULT_BOOLEAN_TRUE_TOKEN;
    const falseToken = input.falseToken ?? DEFAULT_BOOLEAN_FALSE_TOKEN;
    const response = await this.runText({
      systemPrompt: [
        "进行内容分析判断。",
        `任务：${input.instruction}`,
        `如果结果为是，返回 ${trueToken}。`,
        `如果结果为否，返回 ${falseToken}。`,
        "只返回答案本身，不要解释。",
      ].join("\n"),
      messages: [toMessage("user", input.content)],
      signal: input.signal,
      maxTokens: input.maxTokens ?? DEFAULT_BOOLEAN_MAX_TOKENS,
      temperature: input.temperature ?? 0,
    });
    if (response === trueToken) {
      return true;
    }
    if (response === falseToken) {
      return false;
    }
    throw new SemanticJudgeDecisionError(`semantic judge returned invalid boolean token: ${JSON.stringify(response)}`);
  }

  async judgeCompletion<TResult>(input: JudgeCompletionInput<TResult>): Promise<TResult> {
    const suffix = await this.runText({
      systemPrompt: [
        "进行内容分析判断。",
        `任务：${input.instruction}`,
        "你会看到用户内容，以及 assistant 已经写好的答案前缀。",
        "只返回前缀之后需要补全的后续文本，不要重复前缀，不要解释。",
      ].join("\n"),
      messages: [toMessage("user", input.content), toMessage("assistant", input.prefix)],
      signal: input.signal,
      maxTokens: input.maxTokens ?? DEFAULT_SPAN_MAX_TOKENS,
      temperature: input.temperature ?? 0,
    });
    const trimmedSuffix = suffix.trim();
    const combined = trimmedSuffix.startsWith(input.prefix) ? trimmedSuffix : `${input.prefix}${trimmedSuffix}`;
    return input.parse(combined);
  }

  async judgeSpan(input: JudgeSpanInput): Promise<SemanticJudgeSpan> {
    return this.judgeCompletion({
      instruction: [
        input.instruction,
        "如果满足条件，返回下标范围，例如 [12,34]。",
        "如果不满足，返回 [0,0]。",
        "下标采用 JavaScript string slice 的 start/end 语义，end 为排他。",
      ].join("\n"),
      content: input.content,
      prefix: "[",
      signal: input.signal,
      maxTokens: input.maxTokens ?? DEFAULT_SPAN_MAX_TOKENS,
      temperature: input.temperature ?? 0,
      parse: parseSpan,
    });
  }

  async judgeStructured<TSchema extends z.ZodType>(input: JudgeStructuredInput<TSchema>): Promise<z.infer<TSchema>> {
    const schemaJson = JSON.stringify(toJSONSchema(input.outputSchema), null, 2);
    const response = await this.runText({
      systemPrompt: [
        "进行内容分析判断。",
        `任务：${input.instruction}`,
        "只返回一个满足下列 JSON Schema 的 JSON 值，不要解释。",
        schemaJson,
      ].join("\n"),
      messages: [toMessage("user", input.content)],
      signal: input.signal,
      maxTokens: input.maxTokens ?? DEFAULT_STRUCTURED_MAX_TOKENS,
      temperature: input.temperature ?? 0,
    });
    const jsonText = extractJsonText(response);
    if (!jsonText) {
      throw new SemanticJudgeDecisionError(`semantic judge did not return JSON: ${JSON.stringify(response)}`);
    }
    try {
      return input.outputSchema.parse(JSON.parse(jsonText)) as z.infer<TSchema>;
    } catch (error) {
      throw new SemanticJudgeDecisionError("semantic judge returned invalid structured payload", { cause: error });
    }
  }
}

export const createSemanticJudge = (modelClient: SemanticJudgeModelClient): SemanticJudge =>
  new SemanticJudge(modelClient);
