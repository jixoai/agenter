## Context

当前 runtime shell 只有 `Heartbeat`、`Attention`、`Settings` 三个稳定 peer tabs，而 `Heartbeat` 底部 statusbar 同时承载状态摘要、compact 动作、quick config。与此同时，runtime 已经在 scheduler state 中持有 `retryCount`、`blockedReason`、`nextWakeAt`、`lastError` 一类 recovery 事实，但这些事实还没有形成一个正式的 operator recovery surface。

这意味着操作者遇到 runtime `error` / `backoff` / `blocked` 时，仍然只能依赖零散摘要、旧的 observability 卡片、或者 stop/start 这种不精确操作。继续扩张 Heartbeat quick config 会进一步混淆三层职责：

1. execution-scoped next-call knobs
2. durable settings / long-lived policy
3. live runtime recovery diagnostics and controls

这个 change 必须是非破坏性的，因此不能重构 settings schema，也不能重新定义 provider `maxRetries` 的语义。它只补 recovery 观测与控制能力。

## Goals / Non-Goals

**Goals:**
- 为现有 runtime shell 增加一个职责清晰的 live recovery surface。
- 让 operator 能在不离开 runtime shell 的情况下查看最近一次异常、backoff/blocking 状态与下一次唤醒信息。
- 增加正式的 `Retry now` 控制路径，而不是依赖 stop/start workaround。
- 保持 Heartbeat quick config 只编辑 next-call execution knobs。

**Non-Goals:**
- 不在这个阶段重构 settings schema。
- 不在这个阶段重新定义 provider `maxRetries` 与 runtime retry policy 的语义边界。
- 不新增一个新的 runtime primary tab。
- 不把 recovery incident 重新建模成一套新的 Heartbeat transcript facts。

## Decisions

### 1. Recovery 以独立 disclosure surface 挂在现有 runtime shell，而不是新增 primary tab

第一阶段只在既有 runtime shell 上增加 recovery surface，不新增 `Recovery` peer tab。这样可以在不改变主导航法则的前提下，补齐操作者最需要的 recovery 能力。

surface 的职责是：
- 显示 latest runtime error
- 显示 `retryCount`、`blockedReason`、`nextWakeAt`
- 提供 `Retry now`

Alternative considered:
- 新增 `Recovery` primary tab
  - Rejected，因为这会扩大 runtime shell 信息架构，超出非破坏性阶段的范围。

### 2. `Retry now` 走 runtime control plane，而不是 stop/start 或 settings save

manual retry 是 live control，不是 durable config。因此它必须通过正式 control mutation 进入 runtime，而不是：
- 通过 stop/start 侧面触发
- 通过修改 settings 来诱发下一轮 wake

Alternative considered:
- 复用 stop/start
  - Rejected，因为 stop/start 会混淆 lifecycle 与 recovery intent。
- 把 retry 做成 settings knob
  - Rejected，因为 retry-now 是一次性控制，不是 durable truth。

### 3. Heartbeat quick config 继续保持 execution-scoped

Heartbeat quick config 的职责必须收敛在：
- `temperature`
- `topK`
- `maxToken`
- `thinking`

它不承载：
- recovery diagnostics
- `Retry now`
- durable retry strategy
- provider transport policy

Alternative considered:
- 在 Heartbeat quick config 中补 recovery controls
  - Rejected，因为 quick config 会再次膨胀成混合职责面板。

### 4. 第一阶段不把 recovery incident 写进 Heartbeat transcript

虽然 recovery incident 也属于客观事实，但当前 Heartbeat 的 durable truth 仍然主要围绕 request/response/message-parts。第一阶段只建立 live recovery surface，不引入新的 recovery transcript fact model，避免同时改动 UI 与 persistence law。

Alternative considered:
- 把 recovery error 和 retry action 直接写进滚动历史
  - Rejected，因为目前缺少稳定的 durable incident contract，容易在第一阶段半途演化出错误模型。

## Risks / Trade-offs

- [Risk] recovery diagnostics 仍然部分依赖现有 scheduler/publication shape，表达力有限。 → Mitigation: 第一阶段明确只补现有事实的可见性与可操作性，第二阶段再升级内核与接口。
- [Risk] Heartbeat footer 增加 recovery trigger 后仍可能偏拥挤。 → Mitigation: 摘要信息保持克制，详细 diagnostics 只在 disclosure 打开时显示。
- [Risk] manual retry 可能与正在运行的 cycle 竞态。 → Mitigation: 仅在非 running 态允许触发，并在 control path 中返回客观的拒绝原因。

## Migration Plan

1. 更新 delta specs，明确 recovery diagnostics 与 manual retry 的 surface/control contract。
2. 为 runtime control plane 增加 manual retry action，并让 runtime publication 暴露 recovery 所需事实。
3. 在现有 runtime shell 中增加 recovery disclosure surface，并保持 Heartbeat quick config execution-scoped。
4. 补 focused tests，验证 error/backoff/blocked/manual retry 路径。

## Open Questions

- manual retry 的 wake cause 最终是否统一命名为 `manual_retry`，还是复用更通用的 recovery control cause。
- 第二阶段是否要把 recovery incident 进一步持久化成独立的 chronological runtime facts。
