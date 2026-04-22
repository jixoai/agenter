## Context

这次缺陷暴露的不是“某一次 mark-read 没调用”，而是系统里同时存在两套 read 语义：

1. durable truth: 每条 room message 自己的 `readActorIds` / `unreadActorIds`
2. synthetic projection: 房间级 `readProgress` 和 seat 上的 `trackedByLatestVisible` / `hasReadLatestVisible`

runtime dispatch unread ingress 时，底层已经会在真实 provider request dispatch 边界把选中的 unread message 标记为已读；但 WebUI、client store、runtime tool views 又把房间“最新可见消息”的摘要当成第二套事实来传播，于是同一个房间里会出现：

- 消息事实上已读
- 房间摘要仍显示像“未读”或“进度未推进”
- 管理界面把 seat 呈现成 `Read / Unread / Joined later`

这违背了 “Session DB 只存事实 / 房间消息才是 durable truth” 的法则，也把 seat metadata 与 read truth 强耦合了。

## Goals / Non-Goals

**Goals:**

- 让 room read truth 只剩一套：message-level `readActorIds` / `unreadActorIds`
- 删除公开 `room progress` 概念，避免任何房间级 latest-visible 摘要再被当成事实
- 把房间级 seat 投影收敛为真正的 seat metadata，而不是伪读状态
- 让 room route 的 mark-read replay/ack 只依赖当前 snapshot message rows
- 保留 message-local read disclosure，不破坏现有每条消息上的 read affordance

**Non-Goals:**

- 不重写 message read durable schema
- 不新增新的 room unread table 或 room read cursor
- 不改变 runtime 在 model request dispatch 时 mark unread as read 的 law
- 不重做 transcript 视觉设计；这次只移除错误概念和相关投影

## Decisions

### 1. Message rows are the only read truth

`readActorIds` / `unreadActorIds` 继续作为唯一的 read truth。任何房间级投影都不再表达 “latest visible message 已读进度” 这种摘要事实。

Alternative considered:

- 保留 `readProgress` 但仅隐藏 UI。
  - Rejected，因为错误概念一旦继续存在，就还会被别的 surface 或 tool view 重新消费。

### 2. Room-level `readStates` becomes `seatStates`

房间级投影保留，但只保留 seat metadata：`actorId`、`role`、`label`、`currentAdmin`、`online`、`focused`、`invalidCredential`。同时把命名从 `readStates` 改成 `seatStates`，避免继续把 seat roster 伪装成读状态。

Alternative considered:

- 仅删除 `trackedByLatestVisible` / `hasReadLatestVisible`，保留 `readStates` 命名。
  - Rejected，因为命名本身已经是错误架构，会继续诱导 feature 层往里塞摘要读状态。

### 3. Client mark-read floor uses snapshot message rows only

room route 的 monotonic ack floor 只由当前 snapshot message rows 里 viewer 是否已经出现在 `readActorIds` 决定。首次 hydration 或 viewer switch 需要 replay 时，使用当前 snapshot 的最新消息行，而不是 `room.readProgress.latestVisibleMessageRowId`。

Alternative considered:

- 保留 projection floor 作为 “server hint”。
  - Rejected，因为 hint 本身就是第二套 read truth，会重新制造 “消息真相 vs 房间摘要” 漂移。

### 4. Room surfaces show seat metadata, not room progress

room manage users、room route 以及相关 story harness 不再展示 `Read / Unread / Joined later` 这类 latest-visible 摘要标签。read collaboration 只保留在 message row 的 read disclosure 上。

Alternative considered:

- 在 manage users 中保留 joined-later/read badge 作为辅助信息。
  - Rejected，因为这仍然是把某一条“最新消息”的状态冒充成整个 seat 的房间状态。

### 5. Runtime/public projections stop exporting room progress

app-server public room payload、runtime tool views、attention-facing channel projection 都不再导出 `readProgress`，并同步切换到 `seatStates`。这样 Heartbeat 或其他调试面板拿到的都是可解释的事实，而不是 room-progress 摘要。

Alternative considered:

- 只改 browser-facing message route，不动 runtime/public projection。
  - Rejected，因为用户这次就是从 Heartbeat 先看到错误投影，说明公共技术面也不能继续暴露这个概念。

## Risks / Trade-offs

- [Risk] 删除 `readProgress` 会让部分测试和 story harness 大面积失效。 -> Mitigation: 同步改成基于 message rows 的断言，避免再把摘要字段写回测试真源。
- [Risk] 初次 hydration 时如果 snapshot 还没拿到最新消息，viewer replay 可能晚一拍。 -> Mitigation: 只在当前 snapshot 已能解析出最新 durable message 时 replay；拿不到就等待真实 visible callback，而不是构造假的 room floor。
- [Risk] `seatStates` rename 会影响多层公共类型。 -> Mitigation: 一次性跨包重命名，避免留下兼容别名继续污染长期法则。

## Migration Plan

1. 更新 delta specs，明确删除 room progress 概念并引入 `seatStates` 命名。
2. 在 `message-system` 移除 `readProgress` / latest-visible read flags，并把 room-level roster projection 改为 `seatStates`。
3. 在 `app-server`、`client-sdk`、`webui` 去掉对 room progress 的消费和回灌逻辑，改为直接读取 snapshot message rows。
4. 更新测试与 stories，增加 “real model request dispatch 后，消息级已读事实可见” 的回归。

## Open Questions

- `seatStates` 是否需要继续由 room snapshot 默认携带，还是未来进一步拆成独立 seat roster 资源。
- runtime attention prompt 中是否还需要房间 seat metadata 的完整投影，还是可以只保留 presence summary。
