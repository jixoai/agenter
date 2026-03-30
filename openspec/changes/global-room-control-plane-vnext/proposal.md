## Why

当前 message-system 仍然带着明显的 session 私有色彩：channel 由 session 启动、历史由 session 目录托底、`chat` 和 `room` 语义并存。要把 `Chats` 做成真正的全局页面，必须先把 room 提升为独立的全局资源，而不是某个 session 的附属物。

## What Changes

- **BREAKING** message-system 只保留 `room` 这一种 durable 资源语义，不再保留 `chat-*` 的一等概念。
- **BREAKING** room 的定义、grant、历史和 asset 真源上移到 `~/.agenter/.message`，不再跟着 session root 走。
- room 参与者改为从 `auth` 身份和运行中的 `session` 里选择，而不是手填自由字符串。
- room 需要区分 global superadmin 和 room-local admin 两条权限线，并为 room-local admin 定义“单一当前管理员 + 有序候选管理员组”的最小接管法则。
- session 对 room 只保存绑定关系和 refs / projection，不复制全量 room history 进 `session.db`。
- Web chat view 的 transport 与 paging 语义同步改成 room-first。
- 失效、过期、撤销的 room credential 需要向客户端暴露明确的 `credential-invalid` 结果，而不是只给出模糊的未授权。

## Capabilities

### New Capabilities
- `room-session-projection`: session 消费 room 历史时，只保存 refs 与投影信息，不保存 room 真源。

### Modified Capabilities
- `message-chat-control-plane`: 多 channel 改写为全局 room 控制面。
- `chat-channel-access-control`: access subject 改成 auth actor / session actor，并引入 global superadmin 恢复能力。
- `chat-channel-metadata-admin`: admin 修改的对象从 session-local channel metadata 改成全局 room metadata 与 grant。
- `web-chat-view`: 视图连接的对象改成 room transport，而不是旧的 chat channel 语义。

## Impact

- Affected packages: `message-system`, `app-server`, `session-system`, `client-sdk`, `webui`.
- Affected storage: `~/.agenter/.message`, session-to-room projection facts, room asset authority.
- Verification: message-system tests, app-server room/projection tests, Web chat view hydration tests.
