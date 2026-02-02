# Role

你是一名精通 **Bun**、**TypeScript** 和 **LLM Agent 架构** 的系统架构师。
你需要构建一个名为 **Agenter Memory PoC** 的原型系统。

# Project Goal

实现 Agenter 的核心记忆机制。
**核心理念**：放弃传统的“滑动窗口”历史记录。每一轮对话，Agenter 都不依赖上一轮的 context 数组，而是必须通过“回忆器 (Rememberer)”从文件系统中提取客观事实，重构出一份全新的“短期记忆认知 (Short-Term Cognitive State)”，输入给 LLM 进行下一轮决策。
**目的**：通过高昂的 Token 成本和计算时间，换取极致的逻辑可靠性和对幻觉的抑制。

# Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **AI Integration**: Mock 一个 `callAI(messages, model)` 函数，实际使用时可接入 Deepseek/OpenAI。
- **Storage**: JSON Lines (`.jsonl`) 文件系统，遵循 Unix 哲学。

# Architecture Specifications

## 1. 数据结构 (Data Models)

所有数据持久化存储在 `~/.agenter-demo/` 下。

### A. 客观事实 (Objective Facts) - `mid_term.jsonl`

这是“中期/永久记忆”。不存总结，只存**客观发生的事实**。

```typescript
type FactType = "USER_MSG" | "AI_THOUGHT" | "TOOL_RESULT" | "SYSTEM_EVENT";

interface ObjectiveFact {
  id: string;
  timestamp: number;
  type: FactType;
  content: string; // 原始内容
  metadata?: any; // 如工具调用的参数、文件路径等
}
```

### B. 短期认知 (Short-Term Cognitive State) - _In-Memory / Context_

这是每次“回忆器”工作后的产物，也是 LLM 真正看到的 Input。限制最大 Token (如 32k)。

```typescript
interface CognitiveState {
  current_goal: string; // 当前任务目标
  plan_status: string[]; // 已完成步骤 vs 待办步骤
  key_facts: string[]; // 从 mid_term 筛选出的、对当前一步最有用的事实
  last_action_result: string; // 上一步操作的直接结果
}
```

## 2. 核心组件 (Components)

请实现以下三个核心 Class/Function：

### A. `MemoryManager` (I/O Layer)

- 负责向 `mid_term.jsonl` 追加写入 `ObjectiveFact`。
- 负责读取最近 N 条或根据时间范围读取事实。
- _Bonus_: 实现简单的向量检索模拟（可以用关键词匹配代替，为了 Demo 简单）。

### B. `The Rememberer` (The Core)

这是系统的核心大脑。它的工作流程如下：

1. **Fetch**: 从 `MemoryManager` 获取最近的大量事实（比如最近 100 条）以及相关的长期记忆。
2. **Digest (AI Process)**: 调用 LLM，输入 Raw Facts，要求 LLM 输出 `CognitiveState`。
   - _Prompt 核心逻辑_：“你是一个记忆整理专家。基于这些客观发生的日志，请告诉我：我们现在在做什么？做到了哪一步？哪些信息对下一步行动至关重要？请忽略无关噪音。”
3. **Output**: 返回结构化的 `CognitiveState`。

### C. `AgenterLoop` (Main Process)

这是主循环，模拟“一轮”思考：

1. **Receive**: 接收用户指令（如果是第一轮）或系统自动触发。
2. **Recall**: 调用 `The Rememberer`，得到 `cognitiveState`。
3. **Construct Context**: 将 `cognitiveState` 转化为 System Prompt 或 User Message。
   - _注意_：这里**不要**把之前的对话记录 append 进去，只把 `cognitiveState` 放入。Context 是纯净的。
4. **Generate**: 调用 LLM (Executor) 进行决策或回答。
5. **Commit**:
   - 将 LLM 的决策结果、工具调用结果封装为 `ObjectiveFact` 写入 `mid_term.jsonl`。
   - **不保存** LLM 的生成过程（Context），只保存**结果**。

# Requirement for Implementation

请编写 `main.ts` 和相关模块代码。
代码需要包含一个模拟的 `runDemo()` 函数，模拟以下场景来验证记忆系统：

1. **User**: "帮我创建一个 Hello World 文件，然后读取它，最后删除它。" (写入事实)
2. **Loop 1**:
   - Rememberer 读取事实 -> 分析出目标是“创建文件”。
   - Executor 生成代码 -> 写入 `hello.txt`。
   - 结果存入 `mid_term.jsonl`。
3. **Loop 2**:
   - Rememberer 读取（包含 User指令 + Loop1 的创建结果） -> 分析出“文件已创建，下一步是读取”。
   - Executor 生成读取指令 -> 读取成功。
   - 结果存入 `mid_term.jsonl`。
4. **Loop 3**:
   - Rememberer 读取全部历史 -> 分析出“已读取，下一步是删除”。
   - Executor 执行删除。

**关键点**：请在代码注释中明确标出，哪一步是在“重构上下文”，并证明每一轮的 Context 都是新生成的，而不是简单的 Array Push。

# Start Coding

请基于以上设计，提供完整的、可运行的 Bun TypeScript 代码。

### 验证 DEMO 成功的标准（你自己用于验收）：

1.  **Context 纯净度检查**：
    在 `Loop 2` 或 `Loop 3` 时，打印发给 LLM 的 `messages`。
    - **失败情况**：如果里面包含了 Loop 1 的完整对话历史（`role: user`, `role: assistant`...）。
    - **成功情况**：`messages` 里只有一条 System Message（包含了由 Rememberer 总结的 `CognitiveState`）和当前的一条 Trigger Message。

2.  **断点续传能力**：
    在 Loop 2 执行完后，强行关掉进程。再次启动程序。
    - 因为状态都在 `mid_term.jsonl` 文件里，Agenter 应该能通过 `Rememberer` 读取文件，瞬间知道“我现在做到读取了，下一步该删除”，而不需要你重新把上下文喂给它。

3.  **幻觉测试**：
    当日志文件非常长（比如模拟 1000 条操作后），看 `Rememberer` 提取的 `current_goal` 是否依然清晰。这是验证 Deepseek vs Opus 区别的关键点（Deepseek 是否能在大量噪音中提取出正确的 State）。
