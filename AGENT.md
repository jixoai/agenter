# Agenter Project Guide

你是 Agenter 项目的实现者与维护者。请以"架构理解 + 迭代改进"的方式工作，并严格遵守 KISS / YAGNI / DRY / SOLID 与类型安全原则（TypeScript 不使用 any / as any / @ts-nocheck）。

---

## 1. 项目愿景

### 1.1 核心目标

**每一轮对话都可以在"无历史消息"的前提下完成推理**。

通过 Rememberer 从客观事实日志中重建短期认知（CognitiveState），避免传统"滑动窗口"历史注入带来的成本和幻觉风险。

### 1.2 当前实现状态

项目已完成以下架构：

- **TUI**: React + Ink 实现的队列工作流终端界面
- **API**: WebSocket 实时通信（取代 stdio bridge）
- **LLM**: @tanstack/ai 标准化接口
- **Memory**: JSONL + ChromaDB 向量检索

---

## 2. 架构设计

### 2.1 数据层：Objective Facts

持久化存储在 `~/.agenter-demo/mid_term.jsonl`：

```typescript
type FactType = "USER_MSG" | "AI_THOUGHT" | "TOOL_RESULT" | "SYSTEM_EVENT";

interface ObjectiveFact {
  id: string;
  timestamp: number;
  type: FactType;
  content: string;
  metadata?: Record<string, unknown>;
}
```

### 2.2 记忆层：Rememberer

```typescript
interface CognitiveState {
  current_goal: string;
  plan_status: string[];
  key_facts: string[];
  last_action_result: string;
}
```

Rememberer 职责：
1. 获取近期事实 + 向量检索相关事实
2. 调用 LLM 摘要为 CognitiveState
3. 返回结构化状态用于下一轮

### 2.3 执行层：队列工作流

多 Tab 并行编辑 + FIFO 队列处理：

```
editing → (Ctrl+Enter) → waiting → running → finished
   ↑←←←←←←←← (Esc) ←←←←←←←←←←←←←←←←←←←←←←┘
```

---

## 3. 项目结构

```
agenter/
├── src/
│   ├── llm/                    # @tanstack/ai 集成
│   │   ├── adapters.ts         # DeepSeekAdapter, MockAdapter
│   │   ├── chat.ts             # 流式聊天函数
│   │   ├── config.ts           # 配置加载
│   │   └── index.ts            # 模块导出
│   ├── api-ws.ts               # WebSocket API 服务器
│   ├── memory-manager.ts       # JSONL 存储
│   ├── rememberer.ts           # 认知状态重建
│   ├── types.ts                # 共享类型
│   ├── utils.ts                # 工具函数
│   └── ...
├── tui-react/                  # Ink + React TUI
│   └── src/
│       ├── App.tsx             # 队列工作流主逻辑
│       ├── TopBar.tsx          # Tab 列表
│       ├── ContentArea.tsx     # 内容渲染
│       ├── ws-client.ts        # WebSocket 客户端
│       └── ...
└── start.ps1 / start.sh        # 启动脚本
```

---

## 4. TUI 交互规范

### 4.1 队列工作流

**Tab 状态机**：
- `editing` (✎ 白色): 可编辑，正在输入
- `waiting` (⏳ 蓝色 [1/3]): 在队列中等待
- `running` (▶ 紫色): 正在执行（回忆/回答）
- `finished` (✓ 绿色): 已完成

**核心快捷键**：

| 快捷键 | 场景 | 行为 |
|--------|------|------|
| `Ctrl+Enter` | editing | 推入队列 (editing → waiting) |
| `Shift+Enter` | editing/waiting | 立即执行 (→ running) |
| `Enter` | editing | 换行 |
| `Enter` | waiting/running/finished | 找 editing tab 或创建新 tab |
| `Esc` | waiting/finished | 重新编辑 (→ editing) |
| `←/→` | 全局 | 切换 tab |
| `Alt+←/→` | 全局 | 跳 10 个 tab |

### 4.2 视觉设计

**TopBar**：
- Tab 颜色反映状态
- 显示队列位置 `[1/3]`
- 显示队列总数

**内容区**：
1. USER: 无色(编辑中) / 蓝色(已提交)
2. MEMORY: 紫色背景
3. ANSWER: 绿色背景

---

## 5. WebSocket 协议

### 5.1 请求

```typescript
{ id: number; type: "recall"; tab_id: number; message: string }
{ id: number; type: "respond"; tab_id: number; message: string; cognitive_state?: CognitiveState }
{ id: number; type: "reset" }
{ id: number; type: "ping" }
```

### 5.2 响应

```typescript
// 回忆结果
{ id; type: "recall_result"; tab_id; memory_text: string; cognitive_state }

// 流式元信息
{ id; type: "respond_meta"; tab_id; summary: string; tools: string[] }

// 流式增量
{ id; type: "respond_delta"; tab_id; delta: string }

// 完成
{ id; type: "respond_done"; tab_id; reply: string; summary: string; tools: string[] }

// 错误
{ id; type: "respond_error"; tab_id; message: string }
```

### 5.3 连接管理

- 自动重连（最多 5 次）
- 连接状态实时显示
- 断开时显示 reconnecting...

---

## 6. LLM 集成

### 6.1 @tanstack/ai

使用标准化 Adapter 接口：

```typescript
import { DeepSeekAdapter, createChatStream } from "./llm";

const adapter = new DeepSeekAdapter("deepseek-chat", {
  apiKey: process.env.DEEPSEEK_API_TOKEN,
  baseUrl: "https://api.deepseek.com/v1",
});

const stream = createChatStream(adapter, messages);
for await (const chunk of stream) {
  // 处理流式输出
}
```

### 6.2 响应格式

**Responder 输出格式**：
```
SUMMARY: <一句话总结>
TOOLS: <逗号分隔的工具名或 NONE>
ANSWER:
<markdown 格式回答>
```

**Rememberer 输出格式**：
```json
{
  "current_goal": "...",
  "plan_status": ["..."],
  "key_facts": ["..."],
  "last_action_result": "..."
}
```

---

## 7. 开发规范

### 7.1 函数式编程

- 优先使用纯函数
- 状态变更通过返回新对象
- 避免副作用，副作用集中在 hooks

示例：
```typescript
// ✅ 纯函数
const mergeFacts = (a: Fact[], b: Fact[]): Fact[] => {
  const map = new Map([...a, ...b].map(f => [f.id, f]));
  return Array.from(map.values());
};

// ✅ 函数组合
const processTab = pipe(
  updateStatus("waiting"),
  setQueuePosition(queue.length + 1)
);
```

### 7.2 类型安全

- 禁止 `any`, `as any`, `@ts-nocheck`
- 所有函数参数和返回值必须标注类型
- 使用 `satisfies` 替代 `as` 类型断言

### 7.3 文件组织

- 单文件 < 300 行
- 按功能模块拆分
- 导出统一在 `index.ts`

### 7.4 导入规范

Bun 使用真实文件后缀（但省略扩展名）：

```typescript
// ✅ 正确
import { Tab } from "./types";
import { App } from "./App";

// ❌ 错误（不需要 .js 后缀）
import { Tab } from "./types.js";
```

---

## 8. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | mock | mock / deepseek |
| `DEEPSEEK_API_TOKEN` | - | DeepSeek API Key |
| `DEEPSEEK_MODEL` | deepseek-chat | 模型名称 |
| `AGENTER_WS_PORT` | 3457 | WebSocket 端口 |
| `AGENTER_WS_URL` | ws://127.0.0.1:3457/ws | TUI 连接地址 |
| `AGENTER_STORAGE_DIR` | ~/.agenter-demo | 数据目录 |

---

## 9. 启动与调试

### 9.1 快速启动

```bash
# Windows
.\start.ps1

# macOS/Linux
./start.sh
```

### 9.2 手动启动

```bash
# 终端 1: 启动 API
bun run src/api-ws.ts

# 终端 2: 启动 TUI
cd tui-react && bun run dev
```

### 9.3 测试

```bash
# 测试 WebSocket 连接
bun run test-ws.ts
```

---

## 10. 迭代原则

1. **KISS**: 保持简单，避免过度设计
2. **YAGNI**: 不实现不需要的功能
3. **DRY**: 提取重复逻辑为函数
4. **SOLID**: 单一职责，接口隔离
5. **Type Safety**: 类型即文档，类型即安全

---

请在现有代码基础上持续迭代，严格保持上述约束与交互标准。
