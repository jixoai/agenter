## Context

Heartbeat 是 Avatar runtime 的主时间线。compact 虽然不是 user-visible reply，但它是一个关键的 runtime 边界事实：bounded prompt window 在这里被重写，之后的模型请求已经不再处于同一上下文连续面。

如果这个事实只留在 cycle / ai_call inspect 里，Heartbeat 就缺少“运行连续性断点”的表达。

## Goals / Non-Goals

**Goals**
- 把 compact 边界记录成 durable ledger fact，而不是 UI 侧推断
- Heartbeat 历史与 live event 使用同一行模型
- 保持现有 user / assistant bubble contract，不把 separator 伪装成普通消息气泡

**Non-Goals**
- 不在本轮重做整个 Heartbeat 数据源为原始 `message_parts` 表格
- 不把 compact summary 全量展开到 Heartbeat 主流中
- 不把 compact separator 绑定到 cycles 面板的展示逻辑

## Decisions

### 1. Compact boundary 作为 heartbeat scope 的 system message 持久化

每次 compact cycle 完成时，额外写入一条 heartbeat message：

- `scope = "heartbeat"`
- `role = "system"`
- `partType = "compact"`
- `aiCallId = compact ai_call id`
- payload 包含：
  - `heartbeatKind = "compact_separator"`
  - `text`
  - `compactTrigger`
  - `callRoundIndex`
  - `currentRoundIndex`

这样做的原因：

- 复用现有 `message_part` / `pageMessagesByScope("heartbeat")` 基础设施
- 保持 compact separator 具备和普通 Heartbeat 消息相同的恢复 / 分页 / live publication 行为
- 避免 UI 再去横向 join cycles / ai_call 做猜测

### 2. Heartbeat projection 升级为 mixed row stream

`projectHeartbeatMessageToChatMessage` 升级为可识别 `partType=compact`：

- 普通 `partType=message` 继续投影为 user / assistant row
- `partType=compact` 投影为 system separator row

separator row 不进入 cycle outputs，只服务 Heartbeat surface。

### 3. WebUI 使用专用 separator primitive

Heartbeat 虚拟列表继续拥有滚动与排序，但 item renderer 分流：

- 普通 row -> `RuntimeHeartbeatMessage`
- compact separator -> `RuntimeHeartbeatCompactSeparator`

separator 呈现为居中、低噪音、可扫描的上下文边界，不抢主内容层级。

## Risks / Trade-offs

- [Risk] runtime snapshot 里的 `chatMessages` 不再是纯 user/assistant 集合
  - Mitigation: 用显式 `heartbeatKind` 区分 row 语义，UI 不靠 role 猜测

- [Risk] compact cycle 完成时多写一条 heartbeat fact，可能影响旧 merge 逻辑
  - Mitigation: 让 row id 稳定绑定 `aiCallId`，并补 client-sdk merge regression

- [Risk] 旧 Heartbeat 组件把 system row 当成普通消息显示
  - Mitigation: 先抽 separator primitive，再补 Storybook DOM contract

## Validation Plan

1. app-server：测试 compact cycle 行会追加 `partType=compact` heartbeat fact，并可从 ledger 投影恢复
2. client/webui：测试 mixed row merge 仍保持时间序与 load-older 行为
3. Storybook DOM：测试 compact separator 在 Heartbeat stage 中可见，且不破坏现有 message primitive
