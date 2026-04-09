# app-server SPEC

> 本文档只记录 `@agenter/app-server` 的长期后端职责与公共 contract。

## 1. 组合根职责

- `app-server` 是 AvatarRuntime lifecycle、WorkspaceSystem、attention-derived notification projection 的组合根。
- `app-server` 可以持有 session catalog、runtime lifecycle、tRPC surface 与 projection cache，但不能成为 `message-system` 或 `terminal-system` 的 durable truth owner。
- stopped / cold sessions 的 attention、notification、history inspection 必须回到磁盘事实，而不是依赖残留内存对象。

## 2. AvatarRuntime 与 WorkspaceSystem Contract

- runtime identity 由 Avatar identity 单独决定；`session.id` 就是 canonical AvatarRuntime id。
- `session.workspacePath` 只表达创建时的 bootstrap workspace，不代表 runtime 当前完整 mount 列表。
- 前端或其他调用方如果要知道 runtime 当前可访问哪些 workspace，必须查询 `workspace.runtimeMounts(runtimeId)`。
- WorkspaceSystem 是 workspace access 的唯一 authority，负责：
  - mount / detach
  - path-level `ro | rw` grants
  - shared public asset roots
  - avatar-private asset roots
  - non-interactive workspace exec
- Workspace asset roots 分为：
  - public: `<workspace>/.agenter/workspace/{skills,memory,tools,archive}`
  - private: `<workspace>/.agenter/avatars/<avatar>/{skills,memory,tools,archive}`
- Avatar seat credential 也属于 avatar-private workspace state，必须落在对应 avatar-private path，而不是 workspace root settings。

## 3. Attention 与 Notification Contract

- running session 的 attention/notification projection 读取 live runtime。
- stopped 或 cold session 的 attention/notification projection 读取 `sessionRoot/attention-system` 下的 persisted facts。
- notification 不是独立 registry；它只是 unconsumed attention push 的投影。
- `notification.snapshot`、`notification.setChatVisibility`、`notification.setTerminalVisibility`、`notification.consume` 都必须遵守同一条法则：有 runtime 读 runtime，无 runtime 读 persisted attention。
- `session.stop` 与 `session.abort` 都必须让 runtime 从 kernel ownership 中消失；`snapshot.runtimes[sessionId]` 对 stopped session 返回空是正确行为，不是数据丢失。

## 4. Reactive Contract

- `runtime.attention` 是运行态 attention 投影事件，不保证 stopped session 仍然持续发事件。
- `notification.updated` 是 shell unread/projection 事件；它可以由 runtime attention 更新触发，也可以由 stopped-session persisted mutation 触发。
- `session.updated` 进入 `stopped` 后，消费者必须接受：
  - `runtimes[sessionId]` 被移除
  - notification 仍然存在
  - attention 仍然可以通过 query API 读取
- workspace mounts / grants 当前以 query + mutation contract 为主；调用 `grantRuntime`、`detachRuntime`、`session.create/start` 后，调用方应主动刷新 mount/grant 视图。
