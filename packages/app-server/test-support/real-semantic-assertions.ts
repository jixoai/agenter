import { judgeContainsAllConcepts, type SemanticJudge } from "../src";

const ACK_SIGNAL_PATTERN = /(收到|明白|开始|处理中|稍后|汇报|会处理|Understood|handle|report back|working on it)/iu;
const DELIVERY_SIGNAL_PATTERN =
  /(已上线|可访问|可以打开|请打开|链接|已完成|交付|已更新|新版|ready|available|open|visit|updated)/iu;
const WEATHER_SIGNAL_PATTERN = /(厦门|天气|预报|气温|降雨|forecast|weather)/iu;

export const judgeAcknowledgesWorkAndPromisesFollowUp = async (
  judge: SemanticJudge,
  content: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (ACK_SIGNAL_PATTERN.test(content)) {
    return true;
  }
  return judge.judgeBoolean({
    instruction: "判断这段 assistant 回复是否在确认收到任务，并表示会处理、继续执行或稍后反馈结果。不要要求固定措辞。",
    content,
    signal,
    maxTokens: 1,
  });
};

export const judgeAnswersWeatherForecastRequest = async (
  judge: SemanticJudge,
  content: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (!WEATHER_SIGNAL_PATTERN.test(content)) {
    return false;
  }
  return judge.judgeBoolean({
    instruction:
      "判断这段 assistant 回复是否在回答厦门未来 15 天天气或天气预报，并给出了查询后的结果摘要。不要要求固定格式或固定前缀。",
    content,
    signal,
    maxTokens: 1,
  });
};

export const judgeMarkupExpressesConcepts = async (
  judge: SemanticJudge,
  input: {
    content: string;
    concepts: ReadonlyArray<{
      key: string;
      concept: string;
      aliases?: readonly string[];
    }>;
    signal?: AbortSignal;
  },
): Promise<boolean> =>
  judgeContainsAllConcepts(judge, {
    content: input.content,
    items: input.concepts,
    signal: input.signal,
  });

export const judgeReportsReadyUrlDelivery = async (
  judge: SemanticJudge,
  content: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (!DELIVERY_SIGNAL_PATTERN.test(content)) {
    return false;
  }
  return judge.judgeBoolean({
    instruction:
      "判断这段 assistant 回复是否在告诉用户：网页或应用已经准备好、已经上线、已经更新或现在可以打开，并把链接作为交付结果发给用户。不要要求固定前缀。",
    content,
    signal,
    maxTokens: 1,
  });
};
