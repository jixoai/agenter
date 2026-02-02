/**
 * 环境变量管理模块
 * 所有默认值定义在此处，敏感配置（如 API Token）从 .env 读取
 */

// ===== 工具函数 =====
function env(key: string, defaultValue: string): string;
function env(key: string, defaultValue: number): number;
function env(key: string, defaultValue: boolean): boolean;
function env(key: string, defaultValue: string | number | boolean): string | number | boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  
  if (typeof defaultValue === "number") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  if (typeof defaultValue === "boolean") {
    return value === "1" || value.toLowerCase() === "true";
  }
  
  return value;
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// ===== LLM Provider =====
export const llmConfig = {
  /** LLM 提供商: deepseek | mock */
  provider: env("LLM_PROVIDER", "deepseek") as "deepseek" | "mock",
  
  /** DeepSeek API Token (必须从 .env 设置) */
  get apiToken() {
    return requiredEnv("DEEPSEEK_API_TOKEN");
  },
  
  /** DeepSeek API 基础 URL */
  baseUrl: env("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
  
  /** 默认模型 */
  model: env("DEEPSEEK_MODEL", "deepseek-chat"),
};

// ===== Orchestrator (主回忆器) =====
export const orchestratorConfig = {
  /** 模型名称 */
  model: env("ORCHESTRATOR_MODEL", "deepseek-chat"),
  /** 温度：创造性 vs 确定性 */
  temperature: env("ORCHESTRATOR_TEMPERATURE", 0.7),
  /** Top P 采样 */
  topP: env("ORCHESTRATOR_TOP_P", 0.9),
  /** 最大令牌数 */
  maxTokens: env("ORCHESTRATOR_MAX_TOKENS", 2000),
  /** 系统提示 */
  systemPrompt: env("ORCHESTRATOR_SYSTEM_PROMPT", `你是认知中枢的协调者。你的任务是协调多个认知工具（海马体、前额叶、杏仁核、比较皮层）完成记忆回忆和认知任务。

工作流程：
1. 分析用户输入，确定需要什么认知功能
2. 调用适当的工具链
3. 整合工具输出，形成连贯的认知状态
4. 元认知检查：评估是否需要继续回忆

输出格式：JSON，包含认知状态更新`),
};

// ===== Tool: Hippocampus (记忆激活) =====
export const hippocampusConfig = {
  model: env("HIPPOCAMPUS_MODEL", "deepseek-chat"),
  temperature: env("HIPPOCAMPUS_TEMPERATURE", 0.3),
  topP: env("HIPPOCAMPUS_TOP_P", 0.5),
  systemPrompt: env("HIPPOCAMPUS_SYSTEM_PROMPT", `你是海马体。你的任务是从长期记忆中激活相关记忆痕迹。

输入一个线索，输出按相关度排序的记忆片段（最多5个）。
要联想、模糊匹配、考虑情感标记。

输出JSON格式：{
  memories: [{ content: string, relevance: number (0-1), emotional_tag?: string, timestamp?: string }],
  activation_pattern: string (描述激活模式)
}`),
};

// ===== Tool: Prefrontal (工作记忆) =====
export const prefrontalConfig = {
  model: env("PREFRONTAL_MODEL", "deepseek-chat"),
  temperature: env("PREFRONTAL_TEMPERATURE", 0.2),
  topP: env("PREFRONTAL_TOP_P", 0.3),
  systemPrompt: env("PREFRONTAL_SYSTEM_PROMPT", `你是前额叶皮层。管理工作记忆的4个槽位（4±1 规则）。

输入新信息和当前槽位，决定如何更新：
- 替换：移除旧信息，放入新信息
- 合并：将相关信息合并到一个槽位
- 丢弃：如果信息不重要，直接丢弃

输出JSON格式：{
  slots: [string?] (4个槽位，可能为null),
  operations: string[] (执行的操作列表),
  reason: string (决策理由)
}`),
};

// ===== Tool: Amygdala (情感标记) =====
export const amygdalaConfig = {
  model: env("AMYGDALA_MODEL", "deepseek-chat"),
  temperature: env("AMYGDALA_TEMPERATURE", 0.8),
  topP: env("AMYGDALA_TOP_P", 0.9),
  systemPrompt: env("AMYGDALA_SYSTEM_PROMPT", `你是杏仁核。给记忆和情境打情感标记。

分析内容的：
- 效价(valence): positive | negative | neutral
- 唤醒度(arousal): 0-1（情绪强度）
- 优先级(priority): high | medium | low

输出JSON格式：{
  valence: "positive" | "negative" | "neutral",
  arousal: number (0-1),
  priority: "high" | "medium" | "low",
  reason: string (分析理由)
}`),
};

// ===== Tool: Comparator (比较分析) =====
export const comparatorConfig = {
  model: env("COMPARATOR_MODEL", "deepseek-chat"),
  temperature: env("COMPARATOR_TEMPERATURE", 0.4),
  topP: env("COMPARATOR_TOP_P", 0.6),
  systemPrompt: env("COMPARATOR_SYSTEM_PROMPT", `你是比较皮层。比较两个事物在特定维度上的异同。

输出JSON格式：{
  similarity: number (0-1, 整体相似度),
  differences: string[] (关键差异列表),
  conclusion: string (综合结论)
}`),
};

// ===== WebSocket Server =====
export const wsConfig = {
  /** WebSocket 服务端口 */
  port: env("AGENTER_WS_PORT", 3457),
};

// ===== Storage =====
export const storageConfig = {
  /** 数据存储目录 */
  dir: env("AGENTER_STORAGE_DIR", "./data"),
};

// ===== ChromaDB =====
export const chromaConfig = {
  /** ChromaDB 服务 URL */
  url: process.env.CHROMA_URL,
  
  /** 集合名称 */
  collection: env("CHROMA_COLLECTION", "agenter-memory"),
  
  /** ChromaDB 可执行文件路径 */
  bin: process.env.CHROMA_BIN,
  
  /** 是否自动启动 ChromaDB */
  autoStart: env("CHROMA_AUTO_START", true),
  
  /** ChromaDB 主机 */
  host: env("CHROMA_HOST", "127.0.0.1"),
  
  /** ChromaDB 端口 */
  port: env("CHROMA_PORT", 8000),
  
  /** ChromaDB 数据目录 */
  dataDir: process.env.CHROMA_DATA_DIR,
  
  /** 向量维度 */
  embeddingDim: env("AGENTER_EMBEDDING_DIM", 48),
};

// ===== 导出汇总 =====
export const envConfig = {
  llm: llmConfig,
  orchestrator: orchestratorConfig,
  hippocampus: hippocampusConfig,
  prefrontal: prefrontalConfig,
  amygdala: amygdalaConfig,
  comparator: comparatorConfig,
  ws: wsConfig,
  storage: storageConfig,
  chroma: chromaConfig,
};

export default envConfig;
