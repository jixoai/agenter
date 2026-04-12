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

export interface SemanticJudgeQuorumOptions {
  attempts?: number;
  minAgreement?: number;
}

export interface SemanticJudgeModelClient {
  respondWithMeta: (input: SemanticJudgeModelInput) => Promise<AssistantTurn>;
}

interface SemanticJudgeCallBase extends SemanticJudgeQuorumOptions {
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

export interface SemanticJudgeAttemptDiagnostic {
  attempt: number;
  raw: string;
  parsedKey?: string;
  error?: string;
}

export class SemanticJudgeDecisionError extends Error {
  readonly attempts?: readonly SemanticJudgeAttemptDiagnostic[];

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SemanticJudgeDecisionError";
  }
}

const withAttemptDiagnostics = (
  error: SemanticJudgeDecisionError,
  attempts: SemanticJudgeAttemptDiagnostic[],
): SemanticJudgeDecisionError => {
  Reflect.set(error, "attempts", attempts);
  return error;
};

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
  constructor(
    private readonly modelClient: SemanticJudgeModelClient,
    private readonly defaults: SemanticJudgeQuorumOptions = {},
  ) {}

  private resolveQuorum(input: SemanticJudgeQuorumOptions): Required<SemanticJudgeQuorumOptions> {
    const attempts = Math.max(1, Math.trunc(input.attempts ?? this.defaults.attempts ?? 1));
    const minAgreement = Math.max(
      1,
      Math.trunc(input.minAgreement ?? this.defaults.minAgreement ?? (attempts === 1 ? 1 : Math.floor(attempts / 2) + 1)),
    );
    if (minAgreement > attempts) {
      throw new SemanticJudgeDecisionError(
        `semantic judge quorum is invalid: minAgreement=${minAgreement} exceeds attempts=${attempts}`,
      );
    }
    return { attempts, minAgreement };
  }

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

  private async runParsedWithQuorum<TResult>(input: {
    systemPrompt: string;
    messages: TextOnlyModelMessage[];
    signal?: AbortSignal;
    maxTokens?: number;
    temperature?: number;
    attempts?: number;
    minAgreement?: number;
    parse: (value: string) => TResult;
    keyOf: (value: TResult) => string;
  }): Promise<TResult> {
    const quorum = this.resolveQuorum({
      attempts: input.attempts,
      minAgreement: input.minAgreement,
    });
    if (quorum.attempts === 1) {
      const raw = await this.runText(input);
      return input.parse(raw);
    }

    const attempts = await Promise.all(
      Array.from({ length: quorum.attempts }, async (_, index) => {
        const raw = await this.runText(input);
        try {
          const parsed = input.parse(raw);
          return {
            attempt: index + 1,
            raw,
            parsed,
            parsedKey: input.keyOf(parsed),
          } satisfies SemanticJudgeAttemptDiagnostic & { parsed: TResult };
        } catch (error) {
          return {
            attempt: index + 1,
            raw,
            error: error instanceof Error ? error.message : String(error),
          } satisfies SemanticJudgeAttemptDiagnostic;
        }
      }),
    );

    const grouped = new Map<string, { count: number; value: TResult }>();
    for (const attempt of attempts) {
      if (!("parsed" in attempt)) {
        continue;
      }
      const parsedKey = attempt.parsedKey;
      if (!parsedKey) {
        continue;
      }
      const current = grouped.get(parsedKey);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(parsedKey, {
          count: 1,
          value: attempt.parsed,
        });
      }
    }

    for (const [key, entry] of grouped) {
      if (entry.count >= quorum.minAgreement) {
        return entry.value;
      }
      grouped.set(key, entry);
    }

    const diagnosticText = attempts
      .map((attempt) =>
        attempt.error
          ? `#${attempt.attempt}:${JSON.stringify(attempt.raw)} -> ${attempt.error}`
          : `#${attempt.attempt}:${JSON.stringify(attempt.raw)} -> ${attempt.parsedKey}`,
      )
      .join("; ");
    throw withAttemptDiagnostics(
      new SemanticJudgeDecisionError(
        `semantic judge failed to reach quorum ${quorum.minAgreement}/${quorum.attempts}: ${diagnosticText}`,
      ),
      attempts,
    );
  }

  async judgeBoolean(input: JudgeBooleanInput): Promise<boolean> {
    const trueToken = input.trueToken ?? DEFAULT_BOOLEAN_TRUE_TOKEN;
    const falseToken = input.falseToken ?? DEFAULT_BOOLEAN_FALSE_TOKEN;
    try {
      return await this.runParsedWithQuorum({
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
        attempts: input.attempts,
        minAgreement: input.minAgreement,
        parse: (response) => {
          if (response === trueToken) {
            return true;
          }
          if (response === falseToken) {
            return false;
          }
          throw new SemanticJudgeDecisionError(`semantic judge returned invalid boolean token: ${JSON.stringify(response)}`);
        },
        keyOf: (value) => (value ? trueToken : falseToken),
      });
    } catch (error) {
      if (!(error instanceof SemanticJudgeDecisionError)) {
        throw error;
      }
      const fallback = await this.judgeStructured({
        instruction: [
          input.instruction,
          "请改为返回 JSON 对象。",
          "如果判断为是，返回 {\"answer\":true}。",
          "如果判断为否，返回 {\"answer\":false}。",
        ].join("\n"),
        content: input.content,
        signal: input.signal,
        maxTokens: Math.max(32, input.maxTokens ?? DEFAULT_BOOLEAN_MAX_TOKENS),
        temperature: input.temperature ?? 0,
        attempts: 1,
        minAgreement: 1,
        outputSchema: z.object({
          answer: z.boolean(),
        }),
      });
      return fallback.answer;
    }
  }

  async judgeCompletion<TResult>(input: JudgeCompletionInput<TResult>): Promise<TResult> {
    return this.runParsedWithQuorum({
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
      attempts: input.attempts,
      minAgreement: input.minAgreement,
      parse: (suffix) => {
        const trimmedSuffix = suffix.trim();
        const combined = trimmedSuffix.startsWith(input.prefix) ? trimmedSuffix : `${input.prefix}${trimmedSuffix}`;
        return input.parse(combined);
      },
      keyOf: (value) => JSON.stringify(value),
    });
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
    return this.runParsedWithQuorum({
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
      attempts: input.attempts,
      minAgreement: input.minAgreement,
      parse: (response) => {
        const jsonText = extractJsonText(response);
        if (!jsonText) {
          throw new SemanticJudgeDecisionError(`semantic judge did not return JSON: ${JSON.stringify(response)}`);
        }
        try {
          return input.outputSchema.parse(JSON.parse(jsonText)) as z.infer<TSchema>;
        } catch (error) {
          throw new SemanticJudgeDecisionError("semantic judge returned invalid structured payload", { cause: error });
        }
      },
      keyOf: (value) => JSON.stringify(value),
    });
  }
}

export const createSemanticJudge = (
  modelClient: SemanticJudgeModelClient,
  defaults?: SemanticJudgeQuorumOptions,
): SemanticJudge => new SemanticJudge(modelClient, defaults);
