## Context

现在的 terminal 能力有两个根问题：

- 后端：terminal 是 session-local 的，没有独立身份、grant、approval、lease 这些控制面概念。
- 前端：`Terminals` 还不是一个正式定义过的全局页面，很多画面感只存在在 draft 里。

另外，`openspecui` 已经证明 terminal UI 不是简单的一个 xterm 容器，它天然包含：

- terminal title/status
- shared terminal controller
- renderer engine 选择
- 长生命周期的 terminal session catalog

## Goals / Non-Goals

**Goals:**
- 把 terminal 拆成正交的 `terminal-core` 和 `terminal-system`。
- 让 terminal 成为全局共享资源，而不是 session 私有资源。
- 定义写入审批、基于时间的 lease，以及 superadmin / local admin 的分层。
- 定义“单一当前管理员 + 候选管理员组”的接管法则。
- 把 `Terminals` 页面画面感写成正式 UI contract。

**Non-Goals:**
- 不在这个 change 里重写 QuickStart 的启动编排器。
- 不在这个 change 里处理 room/message 的 durable contract。
- 不在这个 change 里引入未来的 sandbox 能力，只预留与 lease 协同的方向。

## Decisions

### 1. terminal 拆成 core 与 collaboration system

- `terminal-core` 只关心 PTY 生命周期、读写、snapshot/diff、title/status、renderer abstraction。
- `terminal-system` 只关心全局 catalog、grant、approval、lease、focus、presence、transport。

为什么：
- PTY 机械层和多人协作治理层是两个不同原子，不能继续揉在一起。
- 否则 write hook、transport、ACL 会继续互相污染。

### 2. 所有写路径必须经过同一 policy gate

- 提交式写入要经过 gate。
- `writeRaw` 也要经过 gate。
- websocket transport 输入一样要经过 gate。

为什么：
- 用户已经明确指出连续交互场景要靠时间授权，而不是只拦截回车。
- 只拦截某一类入口会留下明显绕过路径。

### 3. grant 固定四级：`admin | writer | requester | readonly`

- `admin`：可写、可授权、可配置。
- `writer`：可连续写，但不可授权他人。
- `requester`：默认只读，写入前要申请 lease。
- `readonly`：绝对只读禁写。

为什么：
- 这正好对应 draft 里的四色边框语义。
- 比仅有 `admin/member/readonly` 更贴近 terminal 的协作模型。

### 4. terminal local admin 是单一席位，不是并行多人

- 每个 terminal 同时只有一个 current admin。
- 可以配置一个按优先级排序的 admin-group candidate list。
- current admin 下线时，按顺序把下一个 eligible candidate 升格成 current admin。
- 若更高优先级 candidate 上线，会立即抢占 current admin 席位。
- 未处理的 approval request 必须随 current admin 切换而重新转交。

为什么：
- 用户已经明确要求管理员只能有一个，但允许有候选管理员组和自动接管。
- 若保持多个并行 admin，approval request 的路由和责任会持续模糊。

### 5. approval request 与 attention-item 分层

- terminal 写入申请本身有自己的可配置超时，默认 90s。
- 如果管理员是某个 Avatar session，session 可以把该申请转成 attention-item 来处理。
- attention-item 只是“通知与处理入口”，不拥有 approval request 的状态机。

为什么：
- 用户已经明确纠正过这一点：超时属于授权请求，不属于 attention item。
- 管理员离线时，也只是等到这个授权请求自己的超时窗口结束，然后默认拒绝。

### 6. admin-group 升格不自动改写基础写权限

- 候选管理员可以同时带有 `readonly` 或 `requester` 风格的基础写语义。
- `readonly` 候选被升格后，仍然是 grant-routing admin，但自己的 PTY 写权限仍保持只读。
- `requester` 候选被升格后，等价于不再需要给自己走审批回路，可直接写入。

为什么：
- 这是用户明确给出的边界条件，不写进 spec 后面实现必然会走偏。
- 这样能把“管理权限”和“基础写能力”拆成两个正交维度。

### 7. `Terminals` 页面的画面感升格为 UI contract

- 页面顶部必须有 Tabs。
- Tabs 之上或同层必须有 toolbar。
- toolbar 左侧是主题、快捷键等 terminal-local 操作。
- toolbar 右侧是 AvatarGroup。
- AvatarBadge 状态色：
  - 灰色：离线
  - 靛蓝：在线未聚焦
  - 深蓝：在线且聚焦
- Avatar border 权限色：
  - 红色：readonly
  - 浅绿：requester
  - 深绿：writer
  - 金色：admin
- 当前端把多个 actor 配成 `writer` 时，必须弹出降级提示，把其他 writer 改成 `requester`。

为什么：
- 这些不是皮肤细节，而是用户理解权限与在线状态的主语言。
- 不写进 spec，后面实现时一定会漂。

### 6. `openspecui` 的 title/status/renderer engine 进入正式 contract

- terminal session 有 display title。
- terminal session 有运行状态/输出活跃状态。
- renderer engine 至少需要被定义成明确配置项，而不是实现内部细节。

为什么：
- 这些能力已经在 `openspecui` 中被证明是必要抽象。
- 迁移目标应该是 contract，而不是“实现时再借鉴一下”。

## Risks / Trade-offs

- [terminal 页面 UI contract 变多] → 把 badge/border/tabs/toolbar 明确成少数高价值规则，不把像素级样式写死。
- [admin-group 切换时 approval request 丢失] → pending request 必须跟随 current admin 切换而重新转交。
- [write gate 太严格可能影响交互性能] → lease 设计专门用于 `vim/nano` 这类连续写入场景，避免每个按键都审批。
- [global terminal catalog 与 session focus 容易混淆] → spec 明确 terminal truth 是全局的，session 只发布 attachment/projection。
- [renderer engine 过早进入 spec] → spec 只要求 engine 是正式可选 contract，不要求第一版必须具备所有实现细节。

## Migration Plan

1. 先写清 terminal-core / terminal-system 的分层与 grant/lease contract。
2. 再把 transport 与 runtime publication 改成 global terminal 视角。
3. 最后再把 `Terminals` 页面的 UI contract 与 `openspecui` 迁移目标补齐到实现任务里。

## Open Questions

- 这轮默认把 renderer engine 作为正式配置 contract 写入 spec，但具体 engine 名称仍以现有实现和迁移结果为准，不在 spec 里写死厂牌。
