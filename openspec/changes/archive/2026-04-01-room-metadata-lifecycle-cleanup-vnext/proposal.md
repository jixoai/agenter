## Why

旧 room 仍会带着 pre-actor 模型遗留的 participant id，例如 `avatar:*` 或裸 `user`，导致 metadata 面板持续显示 `Source unavailable`，而轮询刷新又会把用户刚改的 source 草稿覆盖回旧值。与此同时，Chats 仍把 focus 暴露成 room-global 动作，这违背了“focus 属于房间内某个 seat”的法则，也让坏房间难以治理或删除。

## What Changes

- **BREAKING** message-system 只持久化 canonical actor-backed participant id（`auth:` / `session:` / `system:`）；legacy participant id 在 room create / update / bootstrap repair 时直接剔除。
- app-server 的 room bootstrap / reattach 路径会对已有 built-in room 做前向修复，把旧 participant truth 清洗后再返回给 UI。
- Chat metadata disclosure 只在 durable room revision 变化时才重置本地草稿，避免全局轮询把未保存编辑冲掉。
- Chats 页面移除 room-global `Focus/Unfocus channel` 操作；seat focus 改挂到 Users 面板，由对应 seat 的 room token 驱动。
- Global room admin surface 不再把 `builtIn` 或 source provenance 当作前端删除锁，旧坏房间仍可被归档或解散。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `message-chat-control-plane`: room participant truth 需要 canonical actor normalization，并允许 legacy room 在 bootstrap repair 后回到合法状态。
- `chat-channel-metadata-admin`: metadata admin surface 需要稳定本地草稿，并把 lifecycle/admin 行为限定在真正的 room metadata 与 grants。
- `chatapp-surface`: Chats UI 需要把 focus 从 room-global chrome 挪回 per-seat Users panel。

## Impact

- Affected packages: `message-system`, `app-server`, `webui`.
- Affected behaviors: room participant persistence, global room repair, Chats metadata editing, room seat focus UI, legacy room cleanup.
- Verification: message-system tests, app-server room bootstrap tests, WebUI unit/story tests for metadata draft stability and per-seat focus actions.
