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
