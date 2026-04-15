# Workspace + Attention Backend 接口对接说明

> 面向前端开发者。这里只记录当前后端已经稳定的接口法则和响应式注意事项，不讨论旧 UI 的兼容层。

## 1. 大白话先说结论

- 一个 Avatar 现在只有一个 runtime id。不要再把 `workspace + avatar` 当成一个 runtime key。
- workspace 现在是挂到 runtime 上的“工位”。一个 runtime 可以同时挂多个 workspace。
- notification 不再有独立真相源，它只是 attention 里 `push` 的投影。
- session 停止以后，前端看不到 live runtime 是正常的；这时候要读磁盘恢复出来的 attention / notification，而不是等一个“暂停中的 runtime”。
- LoopBus source contract 也已经收口了：后端不会再靠 source-ref/read-result 的开放 metadata bag 传业务信息。

## 2. 单一信源法则

### 2.1 Runtime identity

- 真相：`session.id === canonical AvatarRuntime id`
- 不要再用：
  - `workspacePath + avatar`
  - route 上临时拼出来的 pair key
- 要用：
  - `session.id`
  - `workspace.runtimeMounts({ runtimeId })`

### 2.2 Workspace access

- 真相：WorkspaceSystem
- 不要从 `session.workspacePath` 推断“这个 runtime 现在只属于这个 workspace”
- `session.workspacePath` 只是创建时的 bootstrap path
- 当前真实挂载列表必须查询：
  - `workspace.runtimeMounts`
  - `workspace.runtimeGrants`

### 2.3 Notification

- 真相：attention push projection
- 不要在前端自己维护第二套 unread ledger
- 不要假设“有 unread 就一定有 live runtime”
- stopped/cold session 的 unread 依然可能存在，因为它来自 persisted attention

## 3. 关键接口

### 3.1 Session lifecycle

- `session.create({ cwd, avatar, name, autoStart })`
  - 语义：按 Avatar 解析 canonical runtime/session id；只写 bootstrap metadata，不会自动挂 workspace / room / terminal
- `session.start({ sessionId })`
  - 语义：如果 runtime 不在内存里，就从 persisted facts 重建；没有 durable attachment 时，冷启动就是空 runtime
  - 目前后端已经有真实 AI 验收，验证过 `session.stop -> kernel restart -> session.start` 后，同一个 Avatar 仍能继续同一个 room 里的交付任务
- `session.stop({ sessionId })`
  - 语义：runtime 从内存里脱离；后续 projection 走 persisted attention
- `session.abort({ sessionId })`
  - 语义：同样脱离 runtime，但用于更强的中断/销毁语义

前端注意：

- `session.create/start` 之后看到 `workspace.runtimeMounts([])`、`message.listChannels([])`、`runtime.terminals([])` 都可能是正确结果
- workspace、room、terminal 都必须通过各自的显式挂载 / grant / create / focus 流程获得
- `stop` 后 `runtime.snapshot.runtimes[sessionId]` 为空是正确结果
- 不要把 “runtime 消失” 误判成 session 被删了

### 3.2 WorkspaceSystem

- `workspace.runtimeMounts({ runtimeId })`
  - 返回 runtime 当前挂载的 workspace 列表
- `workspace.runtimeGrants({ runtimeId, workspacePath })`
  - 返回该 mount 下的 path grants
- `workspace.grantRuntime({ runtimeId, workspacePath, grants })`
  - 变更 grant，`grants` 形如 `{ relativePath, mode: "ro" | "rw" }`
  - 同时也是当前后端公开的显式 workspace attach 入口
- `workspace.detachRuntime({ runtimeId, workspacePath })`
  - 从 runtime 上卸载某个 workspace
- `workspace.assetRoots({ workspacePath, avatar })`
  - 返回 public/private 四类目录根
  - private roots 现在会指向 principal-keyed canonical path；nickname 只存在于 `by-nickname` alias 层
- `workspace.exec({ runtimeId, workspacePath, avatar, command, cwd?, env?, stdin? })`
  - 非交互 shell；返回 `{ stdout, stderr, exitCode, cwd }`

前端注意：

- `workspace.exec` 不是 terminal。它不会保留交互 session，也不会流式追加 terminal buffer
- shell 失败看 `exitCode/stderr`，不是靠 transport error 判断
- `assetRoots` 返回的是 durable path metadata，不表示前端应该直接把它当作 UI tree cache 真相
- 如果你在 UI 上展示 avatar 路径，不要把 nickname path 当真源；真实目录在 `by-principal/<principalId>`，nickname 只是 alias
- 不要假设 `session.create/start` 后已经自动拥有某个 workspace 的 root grant

### 3.3 Attention / notification

- `runtime.attentionState({ sessionId })`
  - 读取当前 attention snapshot / active / cycleFrames / hooks
- `notification.snapshot()`
  - 读取全局 notification projection
- `notification.setChatVisibility({ sessionId, chatId?, visible, focused })`
- `notification.setTerminalVisibility({ sessionId, terminalId?, visible, focused })`
- `notification.consume({ sessionId, chatId?, terminalId?, upToMessageId? })`

前端注意：

- focused context 的外部事件会变成 `commit`，一般不会出现在 unread notification 里
- background / muted context 的外部事件会变成 `push`，才会投影成 notification
- `consume` 清的是 projection，不是删 attention history
- runtime shell 里的 `attention commit` 现在支持两种稳定写法：
  - 简单收尾：`attention commit --context <contextId> --summary "..." --done`
  - AI 常见简写：`attention commit --context <contextId> --summary "..." --score 0`
- 这里的 `done` / `--score 0` 不是前端自己猜的语义
  - 真相在 runtime attention handler
  - 如果调用方没显式传 `scores`，后端会把当前 context 里还没清零的 score keys 全部归零

### 3.4 Attention payload contract

- attention commit 现在分三层：
  - `meta`
    - 只表示 provenance，也就是“这条 attention 是谁、从哪个 system、哪个 subject/channel 来的”
  - `summary + change`
    - 这才是主体内容，也是 AI 真正会读、前端真正应该展示的内容
  - `egress`
    - 这是 typed routing intent，比如当前的 `message_reply`
- 不要再依赖：
  - `meta.replyTarget`
  - 任意开放 metadata bag 里藏业务字段
- 要这样理解：
  - “来源是谁” 看 `meta`
  - “具体发生了什么” 看 `summary` 和 `change`
  - “后续要往外发到哪里” 看 `egress`
- 对 message attention：
  - body 已经会包含 room social envelope、latest-message perspective、presence、附件 facts
  - 前端不要再假设这些信息会另外散落在 metadata 里
- 对 terminal / task attention：
  - 语义 detail 也应该从 `change` 读
  - 如果未来某个 system 需要更多 AI/UI 可见细节，正确做法是扩充 body，不是往 metadata 里偷塞

### 3.5 LoopBus source contract

- 这是后端内部 contract，但前端做 Devtools / inspector 时要知道：
  - message source ref 现在靠 typed `channelId + subjectId`
  - terminal / task source ref 也只保留最小寻址字段
  - read result 只保留 `kind/fromHash/toHash/semanticHash/viewHash` 这种调度字段
- 结论就是：
  - 不要期待后端再从 source metadata bag 里吐出业务字段
  - 如果某个 system 的 detail 前端真要展示，那它就应该已经进了 attention body / change / typed tool result

## 4. 响应式消费注意事项

### 4.1 必看事件

- `session.updated`
- `runtime.attention`
- `notification.updated`

### 4.2 推荐处理方式

- `session.updated`
  - 用来更新 session status
  - 如果 status 进入 `stopped`，要接受 runtime snapshot 立即消失
- `runtime.attention`
  - 只代表 live runtime 的 attention 更新
  - stopped session 不保证继续收到
- `notification.updated`
  - 代表 unread projection 变化
  - 它可能来自 live runtime，也可能来自 stopped-session persisted mutation

### 4.3 常见坑

- 不要把 `notification.updated` 当成 message stream
  - 它只是 unread/projection 更新
- 不要在 `session.stop` 后继续依赖旧的 runtime object
  - 如果你缓存了 runtime-local UI state，要自己决定保留哪些 view state，不能再假设后端 runtime 还活着
- 不要把 mount 列表缓存成 `session.workspacePath`
  - mount 是动态的，必须按 runtime 查询
- 不要把 `runtime.attentionState` 里的 `meta` 当内容正文
  - `meta` 是 provenance，不是富文本正文，也不是私有扩展口
- 不要假设 attention projection 一定给你完整长文本
  - runtime preview 会截断 `context.content` 和 `change.value`
  - 做 inspector 时要接受“这是预览态，不是无损导出”
- 响应式列表不要靠对象引用判断 attention 是否变化
  - 稳定键优先用 `contextId`、`commitId`、`updatedAt`
  - `snapshot.contexts[].commits` 也可能是截断后的 recent window，不是完整历史

## 5. client-sdk 对应入口

`RuntimeStore` 已经有最小封装：

- `listRuntimeWorkspaceMounts(runtimeId)`
- `listRuntimeWorkspaceGrants({ runtimeId, workspacePath })`
- `grantRuntimeWorkspace({ runtimeId, workspacePath, grants })`
- `detachRuntimeWorkspace({ runtimeId, workspacePath })`
- `getRuntimeWorkspaceAssetRoots({ workspacePath, avatar })`
- `execRuntimeWorkspace({ runtimeId, workspacePath, avatar, command, cwd?, env?, stdin? })`
- `setChatVisibility(...)`
- `setTerminalVisibility(...)`
- `consumeNotifications(...)`
- `inspectAttentionState(sessionId)`

如果前端后面要做响应式 workspace sidebar / workspace inspector，优先复用这些入口，不要重新拼匿名 tRPC 调用。

## 6. 还没做的事

- 没有做旧 WebUI 的兼容层
- 没有做 mount/grant 的实时事件流
- 没有做前端最终 IA / 导航结构
- 没有做 terminal 权限系统的完整读写分离收口

所以前端现在要做的是：

- 按新 contract 接
- 不要倒逼后端保留旧 pair identity
- 不要自己发明第二套 notification / workspace truth
