/**
 * AI 工具智能体 - 认知工具箱
 * 每个工具是一个配置了特定系统提示的 AI 实例
 */
import { DeepSeekAdapter, getAdapter, createChatStream } from "./index.js";

// 工具配置接口
export interface ToolConfig {
  model: string;
  temperature: number;
  top_p: number;
  systemPrompt: string;
}

// 从环境变量读取配置
function loadToolConfig(prefix: string): ToolConfig {
  return {
    model: process.env[`${prefix}_MODEL`] || "deepseek-chat",
    temperature: parseFloat(process.env[`${prefix}_TEMPERATURE`] || "0.7"),
    top_p: parseFloat(process.env[`${prefix}_TOP_P`] || "0.9"),
    systemPrompt: process.env[`${prefix}_SYSTEM_PROMPT`] || "",
  };
}

// 结构化输出请求
async function structuredOutput<T>(
  config: ToolConfig,
  userMessage: string,
  schema: object
): Promise<T> {
  const adapter = new DeepSeekAdapter(config.model, {
    apiKey: process.env.DEEPSEEK_API_TOKEN!,
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    model: config.model,
    temperature: config.temperature,
  });

  const messages = [
    { role: "system" as const, content: config.systemPrompt },
    { 
      role: "user" as const, 
      content: `${userMessage}\n\n请严格按照以下JSON格式输出：${JSON.stringify(schema)}` 
    },
  ];

  const stream = createChatStream(adapter, messages);
  let result = "";
  for await (const chunk of stream) {
    result += chunk.content || "";
  }

  // 提取 JSON
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]) as T;
}

// ===== 海马体：记忆激活 =====
export interface ActivateResult {
  memories: Array<{
    content: string;
    relevance: number;  // 0-1
    emotional_tag?: string;
    timestamp?: string;
  }>;
  activation_pattern: string;  // 描述激活模式
}

export async function hippocampusActivate(
  cue: string, 
  modality: "semantic" | "episodic" | "emotional" = "semantic"
): Promise<ActivateResult> {
  const config = loadToolConfig("HIPPOCAMPUS");
  const schema = {
    memories: [{
      content: "string",
      relevance: "number (0-1)",
      emotional_tag: "string (optional)",
      timestamp: "string (optional)"
    }],
    activation_pattern: "string (描述如何联想到这些记忆)"
  };

  return structuredOutput<ActivateResult>(
    config,
    `线索："${cue}"\n模态：${modality}\n从长期记忆中激活相关记忆痕迹。`,
    schema
  );
}

// ===== 前额叶：工作记忆管理 =====
export interface WorkingMemoryResult {
  slots: [string?, string?, string?, string?];  // 4个槽位，可能为空
  operations: string[];  // 执行了哪些操作
  reason: string;
}

export async function prefrontalManage(
  newInfo: string,
  currentSlots: string[]
): Promise<WorkingMemoryResult> {
  const config = loadToolConfig("PREFRONTAL");
  const schema = {
    slots: ["string or null"],
    operations: ["string"],
    reason: "string"
  };

  return structuredOutput<WorkingMemoryResult>(
    config,
    `当前槽位：${JSON.stringify(currentSlots)}\n新信息：${newInfo}\n决定如何更新工作记忆。`,
    schema
  );
}

// ===== 杏仁核：情感标记 =====
export interface EmotionResult {
  valence: "positive" | "negative" | "neutral";
  arousal: number;  // 0-1
  priority: "high" | "medium" | "low";
  reason: string;
}

export async function amygdalaFeel(content: string): Promise<EmotionResult> {
  const config = loadToolConfig("AMYGDALA");
  const schema = {
    valence: "positive | negative | neutral",
    arousal: "number (0-1)",
    priority: "high | medium | low",
    reason: "string"
  };

  return structuredOutput<EmotionResult>(
    config,
    `内容："${content}"\n分析情感特征。`,
    schema
  );
}

// ===== 比较皮层：对比分析 =====
export interface CompareResult {
  similarity: number;  // 0-1
  differences: string[];
  conclusion: string;
}

export async function comparatorCompare(
  itemA: string, 
  itemB: string, 
  aspect: string
): Promise<CompareResult> {
  const config = loadToolConfig("COMPARATOR");
  const schema = {
    similarity: "number (0-1)",
    differences: ["string"],
    conclusion: "string"
  };

  return structuredOutput<CompareResult>(
    config,
    `比较A："${itemA}"\n比较B："${itemB}"\n维度：${aspect}`,
    schema
  );
}

// ===== 元认知：自我质疑 =====
export interface MetacognitionResult {
  should_continue: boolean;
  gaps: string[];  // 发现的缺口
  suggested_queries: string[];  // 建议的查询
  confidence: number;  // 当前置信度
}

export async function metacognitionCheck(
  currentState: object,
  triggerMessage: string
): Promise<MetacognitionResult> {
  const config = loadToolConfig("ORCHESTRATOR");
  const schema = {
    should_continue: "boolean",
    gaps: ["string"],
    suggested_queries: ["string"],
    confidence: "number (0-1)"
  };

  return structuredOutput<MetacognitionResult>(
    config,
    `当前认知状态：${JSON.stringify(currentState)}\n用户问题："${triggerMessage}"\n检查是否足够回答，或需要更多信息。`,
    schema
  );
}
