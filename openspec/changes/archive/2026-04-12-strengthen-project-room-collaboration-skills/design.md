## Context

shared room 协作不是某个业务页面的特例，而是 message/attention/workspace/terminal 组合出来的一种高级工作模式。既然 skills+CLI 是当前 runtime 的渐进式发现架构，那么 shared-room 协作法则也应该进 skills，而不是散落在测试提示词里。

当前问题的本质不是“模型不够聪明”，而是平台没有把下面这些法则稳定告诉它：

- room message 是对外 durable truth
- 角色边界不能越权
- 合同/接口必须有单一信源
- 用户明确判定上一条无效后，应该发纠正消息替换旧事实

## Decision

### 1. 新增 built-in collaboration skill

新增 `agenter-collaboration`，并让它出现在每个 runtime 的 `skills.list` 里。这样即使 AI 没有展开全文，也会先看到简短 summary：

- obey shared-room protocol exactly
- only state facts you verified or own
- replace invalid messages with corrected prefix replies after user feedback

### 2. 协作法则放在 skill body，而不是硬编码到某个测试场景

skill body 只表达 durable law，不表达某个场景私货：

- Role law
- Single-source law
- Correction law
- Proof-before-claim law

这样未来无论是 project-room、design review room、task triage room，都能复用。

### 3. 保持 skills 架构，而不回退到更重的 systemPrompt

这次不去重新扩大 system prompt，只增强 built-in skills 和 skills.list summary。

如果这还不够，再下一步才考虑把部分 collaboration law 提升为 runtime prompt law；但那应该是新的范式决策，不在这次先做。

## Validation

- 新增 runtime skills regression test，锁定 collaboration skill 的暴露与关键法则
- 重跑真实 multi-avatar project-room 场景
