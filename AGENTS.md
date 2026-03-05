# AGENTS Best Practices

本项目测试策略从 **TDD 升级为 BDD**，并作为默认工程实践。

## 1) 核心原则

- 以行为为中心：先描述“用户/系统行为”，再写实现细节。
- 测试即文档：测试名称要能直接表达业务意图与验收标准。
- TDD 仍保留：作为 BDD 场景落地时的实现手段（红-绿-重构）。

## 2) 标准流程（BDD-First）

1. 先写行为场景（Feature / Scenario），明确验收边界。
2. 用 Given / When / Then 结构编写失败测试（Red）。
3. 实现最小代码使场景通过（Green）。
4. 在不改变行为的前提下重构（Refactor）。
5. 补充回归场景，防止行为漂移。

## 3) 测试分层（只保留高价值）

- **E2E**：跨进程/跨包关键链路（如 CLI -> daemon -> ws/http）。
- **Integration**：模块协作与协议边界（runtime、registry、protocol）。
- **Unit**：纯逻辑与算法规则（解析、映射、状态机）。

约束：

- 避免对实现细节做脆弱断言（私有字段、内部顺序等）。
- 优先断言“可观察行为”和“稳定契约”。
- 低信号高耗时用例应移除或下沉为更小范围测试。

## 4) 命名规范

- `describe("Feature: ...")`
- `test("Scenario: Given ... When ... Then ...")`

示例：

- `Feature: CLI daemon lifecycle`
- `Scenario: Given daemon is running When doctor checks health Then exit code is 0`

## 5) 完成标准（DoD）

- 新功能至少包含一个行为场景测试。
- 关键路径变更必须有 e2e 或 integration 覆盖。
- `bun run typecheck` 与 `bun run test` 必须通过。
- 文档（SPEC/README/AGENTS）与行为保持一致。

## 6) 用户协作方法论（必须遵守）

- **先证据后结论**：先跑真实流程（CLI/TUI/WebUI/Browser），再下判断；不凭主观猜测解释问题。
- **保持客观展示**：AI 输出不做“语义篡改/清洗/特化”；UI 只做结构化呈现。
- **国际化单一真源**：业务层不硬编码文案；统一通过 i18n 包与配置加载。
- **配置优先于硬编码**：模型、终端入口、提示词路径、策略等一律走 settings/prompt sources。
- **架构做减法，算法做加法**：先保证路径直觉、最小可用，再增强算法与可观测性。
- **循环系统哲学**：LoopBus 持续空转；仅在有效输入（用户输入、终端变更、待办任务）到来时触发 AI 调用。
- **功能层次化呈现**：主界面聚焦聊天与任务推进；进阶能力放入侧栏/工具面板，不堆叠在主视图。
- **问题定位分层实验**：先隔离运行时（PTY/Terminal），再隔离渲染层（xterm/headless/web），逐层缩小问题面。

## 7) Browser 走查标准（agent-browser）

### 7.1 固定流程

1. `agent-browser open <url>`
2. `agent-browser wait --load networkidle`
3. `agent-browser snapshot -i`
4. 交互后重新 `snapshot -i`
5. `get text body` + `screenshot --full` 记录证据

### 7.2 默认回归用例（WebUI）

- **Case A / 启动可用性**：页面加载成功，关键入口可见（New session / Select workspace / Chat 输入框）。
- **Case B / 会话创建**：可创建 session，主聊天区进入可输入状态。
- **Case C / 对话链路**：发送消息后，能看到可观察的状态推进与最终 assistant 回复。
- **Case D / 错误可见性**：当终端/模型失败时，界面出现明确错误信息，且可继续操作。

### 7.3 结果判定

- 每个用例都要记录：`预期`、`实际`、`证据路径`、`是否通过`。
- 不通过时必须附带最小复现步骤与日志位置。
