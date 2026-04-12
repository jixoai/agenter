import type { SemanticJudge, SemanticJudgeSpan } from "./semantic-judge";

const URL_SIGNAL_PATTERN = /(https?:\/\/|www\.)/iu;

export const hasUrlSignal = (content: string): boolean => URL_SIGNAL_PATTERN.test(content);

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
