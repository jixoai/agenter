## Context

现在的 message-system 已经具备 token/grant/transport 的雏形，但它仍然被 `SessionRuntime` 当作 session-local 控制面来创建和持有。结果是：

- room 历史没有真正从 session 生命周期中独立出来，
- `chat` / `room` 两种 durable 语义并存，
- Chats 页面无法被定义成真正的全局资源页，
- 一个 room 被多个 session 共同协作时，truth ownership 会变得含糊。

## Goals / Non-Goals

**Goals:**
- 把 message-system 收口成 global room control plane。
- 去掉 `chat-*` durable 语义，只保留 `room-*`。
- 让 room 的 grant 绑定到 auth actor 或 session actor，而不是自由字符串用户。
- 让 session 只保留 room refs/projection，而不是复制 room history。

**Non-Goals:**
- 不在这个 change 里定义 QuickStart 的启动编排 UI。
- 不在这个 change 里解决 terminal grant / lease 问题。
- 不在这个 change 里重写整个 WebUI shell。

## Decisions

### 1. Room 是唯一 durable message 资源

- `chat-*` 不再作为 durable resource type 存在。
- 所有 message resource 一律使用 `room-*`。
- 过去 `chat-main` 这类 built-in 语义，后续改由 session 对 primary room 的绑定表达。

为什么：
- 用户已经明确要求“废弃 chat，只使用 room”。
- 继续保留两种 durable 语义，只会在 UI、transport、settings 里不断制造分叉。

### 2. Room 真源从 session root 提升到 `.message`

- room 定义、历史、grant、asset 真源都放到 `~/.agenter/.message`。
- app-server 可以在没有任何 session 运行时列出和读取 room。
- session 停止或删除不会自动删除 room 真源。

为什么：
- room 是多人协作资源，本来就不应该属于单一 session。
- 全局 Chats 页面必须能在 session 生命周期之外存在。

### 3. Room 参与者分两类：auth actor 与 session actor

- `auth:<id>` 表达认证主体。
- `session:<id>` 表达某个运行中的 Avatar 实例。
- room grant 绑定到这两类 actor，而不是 `user-123` 这种自由字符串。

为什么：
- 这样才能清楚地区分“人类管理员”和“运行中的 Avatar”。
- 后续 QuickStart 才能把“把某 Avatar 加入某 room”写成明确 contract。

### 4. superadmin 与 room-local admin 分层

- global superadmin 来自 auth 控制面。
- room-local admin 只管理该 room 的 metadata、grants 与核心聊天治理动作。
- 每个 room 同时只有一个 current room-local admin。
- room 可以配置一个按优先级排序的 admin-group candidate list。
- current admin 下线时，按顺序把下一个 eligible candidate 升格成 current admin。
- 若更高优先级 candidate 后续上线，会立即抢占 current admin 席位。
- 第一版所谓的 room admin work item，只包括核心聊天治理动作：
  - issue / revoke room credential；
  - 修改 participant actor 绑定；
  - 修改 room title 与 metadata。
- 这些未处理的 room admin work item 必须跟随 current admin 切换而重新转交。
- 第一版只把这套法则用于核心聊天功能、metadata 与 grant 治理；room 的更复杂扩展能力后续再叠加。
- superadmin 可以用于恢复失控 room，但不等于每个 room 默认 local admin。

为什么：
- 这是用户在 terminal 里明确强调的权限哲学，room 也要一致。
- 没有 superadmin 恢复能力，global room page 会有不可恢复的管理死角。
- room 比 terminal 更复杂，所以第一版只把 admin-group 法则收口到核心聊天治理，不把通用审批队列或所有未来 room 功能一次写死。

### 5. Session 只保存 room projection

- `session.db` 里只保存 room message refs 和对 cycle 的投影信息。
- room message 的 source of truth 仍然在 `.message`。
- app-server 负责 join room truth 与 session facts，生成 session-facing read model。

为什么：
- 这符合“session DB 只保存事实”的长期法则。
- 同一条 room 消息可能被多个 session 观察，不应该复制出多份真源。

### 6. credential 失效是显式 access state，不是静默未加入

- 过期、撤销、格式错误的 room credential 都应被识别为 `credential-invalid`。
- API 与 transport 在拒绝这类 credential 时，需要给调用方一个稳定、可区分的失败语义，而不是把它和“从未加入过”完全混为一谈。
- client/runtime shell 可以据此把 room 保留在列表中，并提示需要重新授权。

为什么：
- 用户已经明确要求“可以搞一个凭证失效的状态”。
- 若只有模糊的 unauthorized，Welcome/Chats 就无法把“真的没加入”和“曾经加入但凭证坏了”分层展示。

## Risks / Trade-offs

- [旧代码里大量使用 `chatId`] → 这一轮先把 durable 语义改写成 room-first，兼容字段和命名清理可后置到实现层。
- [session 停止后 room 仍存在，容易让用户误以为是孤儿资源] → 后续 UI 必须明确 room 的 owner / participant / attached session 信息。
- [room asset authority 上移会碰到现有 session asset 路径] → 本 change 明确 room asset 跟 room truth 一起迁移，不再挂在 session 目录下。
- [room admin-group 未来可能承载更多功能] → 第一版只把它绑定到核心聊天治理与 grant/metadata 流程，复杂 room feature 不在本 change 展开。

## Migration Plan

1. 先把 room-only 与 global room authority 写成 durable contract。
2. 再把 session -> room projection contract 固化，避免后续 app-server 双写。
3. 实现时先替换 message-system truth ownership，再接 Web chat view。

## Open Questions

- 无。当前 room change 对 truth ownership、actor model、admin-group 最小接管法则与 `credential-invalid` 语义都已有明确收口。
