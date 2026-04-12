import type { SemanticJudge, SemanticJudgeSpan } from "./semantic-judge";

const URL_SIGNAL_PATTERN = /(https?:\/\/|www\.)/iu;
const normalizeSignal = (value: string): string => value.trim().toLocaleLowerCase();

export const hasUrlSignal = (content: string): boolean => URL_SIGNAL_PATTERN.test(content);

const hasConceptSignal = (
  content: string,
  input: {
    concept: string;
    aliases?: readonly string[];
  },
): boolean => {
  const normalizedContent = normalizeSignal(content);
  const candidates = [input.concept, ...(input.aliases ?? [])]
    .map((candidate) => normalizeSignal(candidate))
    .filter((candidate) => candidate.length > 0);
  return candidates.some((candidate) => normalizedContent.includes(candidate));
};

const hasForbiddenSignal = (content: string, forbidden: readonly string[]): boolean => {
  const normalizedContent = normalizeSignal(content);
  const normalizedForbidden = forbidden
    .map((candidate) => normalizeSignal(candidate))
    .filter((candidate) => candidate.length > 0);
  return normalizedForbidden.some((candidate) => normalizedContent.includes(candidate));
};

export const judgeContainsUrl = async (
  judge: SemanticJudge,
  content: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (!hasUrlSignal(content)) {
    return false;
  }
  return judge.judgeBoolean({
    instruction: "如果内容中包含 URL、网址或网页链接，判断为是；否则判断为否。",
    content,
    signal,
    maxTokens: 1,
  });
};

export const judgeUrlSpan = async (
  judge: SemanticJudge,
  content: string,
  signal?: AbortSignal,
): Promise<SemanticJudgeSpan> => {
  if (!hasUrlSignal(content)) {
    return { start: 0, end: 0 };
  }
  return judge.judgeSpan({
    instruction: "如果内容中包含 URL、网址或网页链接，返回该 URL 在原文中的下标范围。",
    content,
    signal,
    maxTokens: 12,
  });
};

export const judgeMentionsConcept = async (
  judge: SemanticJudge,
  input: {
    content: string;
    concept: string;
    aliases?: readonly string[];
    signal?: AbortSignal;
  },
): Promise<boolean> => {
  if (hasConceptSignal(input.content, input)) {
    return true;
  }
  return judge.judgeBoolean({
    instruction: [
      `判断内容是否明确提到、表达或回答了这个概念：${input.concept}。`,
      input.aliases && input.aliases.length > 0 ? `可接受的等价表达包括：${input.aliases.join("、")}。` : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
    content: input.content,
    signal: input.signal,
    maxTokens: 1,
  });
};

export const judgeAvoidsForbiddenMentions = async (
  judge: SemanticJudge,
  input: {
    content: string;
    forbidden: readonly string[];
    description?: string;
    signal?: AbortSignal;
  },
): Promise<boolean> => {
  if (hasForbiddenSignal(input.content, input.forbidden)) {
    return false;
  }
  const leaked = await judge.judgeBoolean({
    instruction: [
      "判断内容是否泄漏、提到、代说或传达了任意禁止信息。",
      input.description ? `禁止信息类别：${input.description}。` : "",
      `禁止信息列表：${input.forbidden.join("、")}。`,
      "如果存在任意泄漏或等价表达，判断为是；否则判断为否。",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
    content: input.content,
    signal: input.signal,
    maxTokens: 1,
  });
  return leaked === false;
};
