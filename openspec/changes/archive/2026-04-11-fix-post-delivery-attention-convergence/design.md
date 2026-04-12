## Context

主架构已经切到 `skills.list + root_workspace_bash + minimal AttentionContexts.metadata`。这意味着 runtime 不再把 rich room/terminal detail 直接塞进 bootstrap，而是要求 AI 在需要时自己走 CLI/skills 路径展开。

真实 delivery 走查暴露了两个尾部问题：

1. runtime 内部的 lifecycle bookkeeping 仍会产生 active attention，例如 terminal create / config update 之后留下一个分数为 `1` 的 terminal context；
2. focused terminal source 自身的观察结果也会残留为 active debt；对于长期服务 terminal，这意味着 request log 之类被动输出会持续占用 attention；
3. room 任务的最终收尾仍然依赖显式 `attention commit --done`，但当前 `skills.list` 的一句话摘要还不够直接，真实模型在 debt-only wake 上偶尔会继续空转，而不是先查 attention 再收尾。

这里必须坚持单一信源：

- 可见 room message 只是共享事实，不自动等于 completion；
- completion 仍然只以 attention score 归零为准；
- runtime 自己产生的 bookkeeping 不应该伪装成新的用户 obligation。

## Goals / Non-Goals

**Goals:**
- 让 runtime 自己产生的 lifecycle commits 默认只保留为历史事实，不再制造无意义 active debt
- 让 focused terminal observation 默认只保留为 queryable history，不再把长期服务日志伪装成未完成任务
- 保持 room completion 的显式 settle 语义不变，同时让这条路径在 `skills.list` 下更容易被真实模型发现
- 用单测 + 真实 AI debug/delivery 场景证明交付后 attention 能收敛

**Non-Goals:**
- 不把 `message send` 自动推断为任务完成
- 不重新把 rich system guide 或大段 usage example 塞回 bootstrap
- 不引入新的 direct tools；仍然保持 `root_workspace_list` / `root_workspace_bash` 两个模型直接工具

## Decisions

### 1. 通用 lifecycle commits 与 focused terminal observations 一律优先视为 passive history，只有显式 actionable 事件才保留 active score

`terminal_create`、`terminal_delete`、focus/unfocus、config update、channel lifecycle 这类 runtime 内部记账，本质上是“平台已经完成的状态变化事实”。它们可以保留在 attention history 里给 AI 和 inspector 查询，但不应继续占用 unresolved score。

focused terminal 的 snapshot/diff observation 也是类似道理：它们对于当前轮推理和事后回看都重要，但默认只是“发生过的终端事实”，不自动等于新的 obligation。否则长期服务 terminal 的被动日志会持续制造 active debt。

实现上保留 commit 记录本身，但把通用 lifecycle score 与 focused terminal observation score 统一降为 `0`。像后台 terminal 从 `BUSY -> IDLE` 这种真正需要 AI 继续处理的事件，继续通过显式 `score: 100` 路径保留为 active debt。

为什么不是“保留分数，等待 AI 自己去清”：
- 这会让平台内部 bookkeeping 和真实用户 obligation 混在一起
- AI 已经在同一轮工具结果里拿到了 terminal/channel mutation 的成功事实，没有必要再被 runtime 重新制造一次 debt

### 2. 显式 settle 语义保持不变，不从 room reply 反推 completion

room reply 仍然只是共享事实，不是 completion 的单一信源。真正的完成必须继续通过 `attention commit --done` 或 `--score 0` 来落地，否则 relay room、纠错消息、阶段性 ACK 都会被错误地当成最终完成。

因此本次不改 `message send` 的 completion 语义，只修“如何让 AI 更稳定地发现这条显式 settle 路径”。

### 3. 把 debt-only wake 的操作提示放进 `skills.list` 摘要，而不是恢复旧式 bootstrap guide

最小 bootstrap 的前提不能回退。要解决 discoverability，优先改 `skills.list` header 和内置 `agenter-attention` / `agenter-runtime` 的摘要与正文：

- 当一轮只有 `AttentionContexts.metadata` 时，先用 `attention list/query` 看清 context
- 当真实副作用和最终 room 报告都已经完成时，下一步应该是 `attention commit --done`

这样做的好处是：
- 仍然符合 skills 渐进展开哲学
- 关键 law 在每轮可见的 `skills.list` 里就有，不要求模型一定先执行 `ccski info`
- 不会重新把 message/terminal/workspace 的大段说明塞回 system prompt

## Risks / Trade-offs

- [Risk] 将 lifecycle commits 改成 passive 可能让某些依赖“config/channel change 会主动唤醒 AI”的旧路径失效
  → Mitigation: 只保留真正显式 scored 的 actionable lifecycle（如 background terminal idle-ready）；并补回归测试锁定这个边界

- [Risk] 仅靠 skills.list 摘要提升，真实模型仍可能偶发漏掉 settle
  → Mitigation: 同时增强 `skills.list` header、`agenter-attention` 正文和 real AI debug 验证；如果仍有明显波动，再另起 change 讨论更强的 skills/example 组织方式

- [Risk] 修改生命周期分数可能影响既有 attention tests
  → Mitigation: 同步把测试从“是否 active”改成“是否记录 history + 不制造 debt”，确保 law 明确

## Migration Plan

1. 先补 OpenSpec proposal/spec/design/tasks，锁定“不从 room reply 反推 completion”的边界
2. 调整 lifecycle 与 focused terminal observation 的 score 逻辑，让 runtime-owned bookkeeping / passive observation 默认变成 passive history
3. 更新 `skills.list` / builtin runtime skills 文案，补充 debt-only wake 与 explicit settle 指引
4. 更新单测，覆盖 passive lifecycle 与 skills discoverability
5. 重新跑 targeted tests + 真实 AI delivery/debug 场景

回滚策略：
- 如果真实 AI 验证仍不稳定，保留 change 不归档，并继续把剩余问题拆成新的 follow-up change

## Open Questions

- 如果这轮之后真实模型仍偶发不 settle，下一步是继续增强 `skills.list` 摘要，还是引入更明确的 skill example loading 机制
