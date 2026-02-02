/**
 * 回忆编排器 - 主控 AI
 * 协调各个认知工具 AI，流式输出回忆过程
 */
import {
  hippocampusActivate,
  prefrontalManage,
  amygdalaFeel,
  comparatorCompare,
  metacognitionCheck,
  ActivateResult,
  EmotionResult,
  WorkingMemoryResult,
  MetacognitionResult,
} from "./llm/tool-agents.js";
import { CognitiveState } from "./types.js";
import { RecallTrace } from "./rememberer.js";

// 流式输出类型
export type RecallFrame =
  | { type: "start"; trigger: string }
  | { type: "activate"; data: ActivateResult; round: number }
  | { type: "hold"; data: WorkingMemoryResult }
  | { type: "feel"; data: EmotionResult }
  | { type: "compare"; data: { similarity: number; conclusion: string } }
  | { type: "metacognition"; data: MetacognitionResult }
  | { type: "state_update"; field: string; value: any; reason: string }
  | { type: "complete"; state: CognitiveState; trace: RecallTrace }
  | { type: "interrupt"; reason: string };

interface WorkingState {
  trigger: string;
  workingMemory: string[];
  activatedFacts: Array<{ content: string; relevance: number; round: number }>;
  emotions: Array<{ content: string; emotion: EmotionResult }>;
  round: number;
  confidence: number;
}

export async function* recallStream(
  triggerMessage: string
): AsyncGenerator<RecallFrame> {
  // 初始状态
  const state: WorkingState = {
    trigger: triggerMessage,
    workingMemory: [],
    activatedFacts: [],
    emotions: [],
    round: 0,
    confidence: 0,
  };

  yield { type: "start", trigger: triggerMessage };

  // 回忆循环
  while (state.round < 5) {
    state.round++;

    // 1. 激活记忆（海马体）
    const activateResult = await hippocampusActivate(
      state.round === 1 ? triggerMessage : state.workingMemory.join(" "),
      "semantic"
    );

    yield { type: "activate", data: activateResult, round: state.round };

    // 记录激活的事实
    for (const mem of activateResult.memories) {
      state.activatedFacts.push({
        content: mem.content,
        relevance: mem.relevance,
        round: state.round,
      });
    }

    // 2. 更新工作记忆（前额叶）
    const newInfo = activateResult.memories.map(m => m.content).join("; ");
    const holdResult = await prefrontalManage(newInfo, state.workingMemory);

    yield { type: "hold", data: holdResult };
    state.workingMemory = holdResult.slots.filter(Boolean) as string[];

    // 3. 情感标记（杏仁核）- 并行处理
    const feelPromises = activateResult.memories.map(async (mem) => {
      const emotion = await amygdalaFeel(mem.content);
      return { content: mem.content, emotion };
    });
    const emotions = await Promise.all(feelPromises);
    state.emotions.push(...emotions);

    for (const { content, emotion } of emotions) {
      yield { type: "feel", data: emotion };
      yield {
        type: "state_update",
        field: "emotional_marker",
        value: emotion,
        reason: `对"${content.slice(0, 20)}..."的情感分析`,
      };
    }

    // 4. 元认知检查（是否足够？）
    const currentCognitiveState = buildPartialState(state);
    const metaResult = await metacognitionCheck(
      currentCognitiveState,
      triggerMessage
    );

    yield { type: "metacognition", data: metaResult };
    state.confidence = metaResult.confidence;

    // 如果足够或没有新查询，结束
    if (!metaResult.should_continue || metaResult.suggested_queries.length === 0) {
      break;
    }

    // 继续下一轮，使用建议的查询
    state.workingMemory.push(...metaResult.suggested_queries);
  }

  // 构建最终状态
  const finalState = buildFinalState(state);
  const trace: RecallTrace = {
    trigger: state.trigger,
    recent_count: state.activatedFacts.filter(f => f.round === 1).length,
    related_count: state.activatedFacts.filter(f => f.round > 1).length,
    merged_count: state.activatedFacts.length,
    tool_calls: state.emotions.map(e => `amygdala_feel("${e.content.slice(0, 15)}...")`),
    messages: [],
    raw_response: "",
  };

  yield { type: "complete", state: finalState, trace };
}

// 构建部分状态（用于元认知检查）
function buildPartialState(state: WorkingState): object {
  return {
    trigger: state.trigger,
    working_memory: state.workingMemory,
    activated_facts_count: state.activatedFacts.length,
    emotions: state.emotions.map(e => ({
      content: e.content.slice(0, 30),
      valence: e.emotion.valence,
      priority: e.emotion.priority,
    })),
    confidence: state.confidence,
  };
}

// 构建最终认知状态
function buildFinalState(state: WorkingState): CognitiveState {
  // 基于工作记忆和情感标记，提取关键信息
  const highPriorityFacts = state.emotions
    .filter(e => e.emotion.priority === "high")
    .map(e => e.content);

  // 推导目标
  const goal = inferGoal(state.trigger, state.workingMemory);

  // 推导计划状态
  const planStatus = inferPlan(state.workingMemory);

  // 关键事实（去重，按优先级排序）
  const keyFacts = [...new Set([
    ...highPriorityFacts,
    ...state.workingMemory.slice(0, 5),
  ])].slice(0, 10);

  // 最后行动结果（从记忆中找最近的操作）
  const lastAction = state.workingMemory.find(w => 
    w.includes("完成") || w.includes("已") || w.includes("成功")
  ) || "No recent action";

  return {
    current_goal: goal,
    plan_status: planStatus,
    key_facts: keyFacts,
    last_action_result: lastAction,
  };
}

function inferGoal(trigger: string, memory: string[]): string {
  // 简化版：从触发消息和记忆中推断目标
  if (trigger.includes("名字") || trigger.includes("叫什么")) {
    return "确认用户身份并回答名字相关问题";
  }
  if (trigger.includes("文件") || trigger.includes("创建")) {
    return "协助用户完成文件操作任务";
  }
  return `回应用户: ${trigger.slice(0, 30)}...`;
}

function inferPlan(memory: string[]): string[] {
  // 从记忆中找计划线索
  const steps: string[] = [];
  
  if (memory.some(m => m.includes("创建"))) steps.push("创建文件 (done/todo)");
  if (memory.some(m => m.includes("读取"))) steps.push("读取文件 (done/todo)");
  if (memory.some(m => m.includes("删除"))) steps.push("删除文件 (done/todo)");
  
  if (steps.length === 0) {
    steps.push("理解用户需求 (done)", "检索相关信息 (done)", "生成回答 (active)");
  }
  
  return steps;
}
