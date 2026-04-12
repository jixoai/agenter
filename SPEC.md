# Agenter SPEC

> 本文档只记录仓库级长期有效的系统法则、正交边界与 durable contract。
> 进行中的变更看 `openspec/changes/*`，能力级规格看 `openspec/specs/*`，包级长期细节看 `packages/*/SPEC.md`。

## 0. 文档角色

- `SPEC.md`：项目级 durable spec，只保留长期成立的规则。
- `packages/*/SPEC.md`：对应包的长期职责与公共契约。
- `openspec/changes/*`：进行中的 change proposal / design / tasks / delta specs。
- `openspec/specs/*`：已经沉淀出的 capability spec。
- `TASKS.md`：已退役，不再作为真源。

## 1. 项目定位

Agenter 是一个 attention-first 的 Agent runtime platform。

它的目标不是把更多业务规则硬编码进单个 agent 类，而是提供一套稳定的底层法则，让 message、terminal、task、future browser/os 等 source adapter 都能在统一 runtime 中演化，并最终通过 attention 驱动模型决策、工具执行与状态收敛。

## 2. 平台法则

- Attention 是内核语义货币。外部熵增必须先被表达为 attention debt，再决定是否进入下一轮模型调用。
- `*System` 必须面向 Attention 编程：当系统观察到新的事实、未完成义务、或 AI 行为方式不符合预期时，优先通过 attention commit 把这些事实与 obligation 显式化，而不是把“下一步该怎么做”硬编码进内核分支。
- LoopBus 是持续存在的 runtime core。它负责等待输入、收集输入、持久化 cycle、调用模型与协调 adapter side-effects，但不拥有 source-specific 业务语义。
- Session DB 只存事实，不存可推导快照。projection、view model、UI 结构都属于派生层。
- AvatarRuntime identity 是 avatar-first 的：一个 Avatar 只有一个 canonical runtime/session id；workspace membership 只能通过 WorkspaceSystem mount 附着，不能再成为 runtime identity 的一部分。
- Room 历史的 durable truth 属于全局 `message-system`；session 只保留 room binding、message refs 与推理所需 projection facts，不复制 room history 当作自己的真源。
- Room 文本消息对人类 transcript 默认立即可见；`attentionState=queued` 只表示它仍欠 AI/automation attention，不再表示“先隐藏，等 attention 后再显示”。
- Room 级 read progress / read receipt 的 durable truth 属于全局 `message-system`，并以消息级冻结成员数组 `readActorIds` / `unreadActorIds` 维护，而不是退化成 session unread badge 或可变 seat cursor。
- Terminal truth、grant、approval、lease、activity history 的 durable truth 属于全局 `terminal-system`；session 只保留 terminal binding、focus refs、approval subscription 与推理所需 projection facts，不复制 terminal history 当作自己的真源。
- Terminal focus truth 属于 actor-scoped seat state；inspection tab、UI 选中态、以及别的 actor 的 focus 都不能被错误投影成当前 session actor 的 terminal attention 输入。
- WorkspaceSystem 是独立平台系统，拥有 workspace mount、path grant、public assets、avatar-private assets 与 non-interactive workspace exec；workspace 不拥有 room 或 terminal truth。
- Avatar private runtime home 是固定原语：每个 runtime 都必须拥有一个按 principal address 定位的 root workspace，dynamic workspace mounts 只是在此基础上的额外授权。
- AttentionContext 拥有 durable focus state（`focused | background | muted`）与 ingress semantics（`commit | push`）；notification 只是 attention push 的投影，不得再引入第二套 unread truth。
- Attention durable fact 必须显式分层为 provenance / body / egress 三个平面：`meta` 只描述来源，`summary + change` 承载 AI 可见内容，外部路由意图走 typed `egress`；不得再把 reply target、私有 blob、快捷动作塞回 metadata。
- LoopBus / source adapter 的 transport metadata 只允许承载调度、协议、持久化回溯所需的 facts；AI 需要理解的内容必须进 attention body 或 typed tool/query，不能靠 hidden metadata side channel。
- LoopBus built-in source ref / read result contract 必须保持 typed coordinate law：message 依赖 `channelId + subjectId`，terminal/task 依赖最小寻址字段；不得重新打开 `meta` 逃逸口。
- WebUI 的用户可见滚动所有权必须统一委托给共享 `ScrollView` 原语；feature code 不得再直接以 raw `overflow-auto/scroll` 充当主滚动 owner。
- Search / FTS index 只能是可重建 projection，不能升级成 durable truth；删除索引后系统仍必须能从事实库或 attention durable state 重建搜索能力。
- Attention search 的默认面向未完成工作，但显式 `score/hash` 查询属于历史事实定位：普通文本默认 active-only，`score:` / `hash:` 若未显式提供 `minscore`，默认应包含历史提交。
- Cancellation、stop、abort、timeout 必须共享同一套显式语义，并持久化为事实。
- Provider 请求保持纯度。HTTP/model body 只表达真实 provider 参数；调度、cycle、trace identity 等运行事实只能进入 `ai_call.requestBody.meta` 与 runtime publication contract，不能重新落回独立 `session_cycle` 或 session-db telemetry 表。
- LoopBus 的模型表面必须保持极小：稳定 attention law、`skills.list`、以及 `root_workspace_list` / `root_workspace_bash` 两个 root workspace 原语。message / workspace / terminal / future systems 的操作统一经由 runtime-local CLI/API 自助发现，不再直接注入成 model tools。
- runtime-local CLI/API 的 tool surface 必须遵守单一信源：`attention` / `message` / `workspace` / `terminal` 的 route、description、`inputSchema`、`--help` 与 canonical examples 都由共享 descriptor registry 派生；AI-facing shell 不再接受 positional/natural-form 参数，只接受空输入、单个 JSON argv 或 JSON stdin。

## 3. 正交设计边界

- `message-system`、`terminal-system`、`task-system`、未来的 `browser-system` / `os-system` 都是 source adapter，不得把自己的私有语义硬编码进 LoopBus core。
- `AgenterAI` 是 attention-first decision engine，不应直接绑定 terminal/task 等 source-specific gateway、payload 结构或 stage 语义。
- source adapter 与内核只通过协议、hook、tool provider、attention commit、message dispatch 这类明确边界协作，不能跨层偷写规则。
- 当 source adapter 希望强化某类后续行为时，应优先提交额外的 typed attention items，并由该 system 自己的 skill 教 AI 如何理解和处理这些 items；不要把这类行为期待偷塞进全局 prompt 或内核特判。
- source ref / read result 如果只承担 lookup hint，就只能服务 adapter 自身寻址；一旦某事实要进入 durable attention、prompt payload 或外部 UI 契约，就必须先提升为 typed draft field 或 attention body。
- `@agenter/web-chat-view` 是 room transcript 的共享 transport surface，必须保持对 `@agenter/webui` 的包级正交；operator route 消费它，而不是重新发明一套 route-local transcript renderer。
- Auth identity 与 Avatar/business role 永远分层：auth 只表达“谁可以认证并持有授权声明”，Avatar 只表达 workspace/session 的业务角色与提示词行为。
- `profile-service` 是 durable profile identity、proof-bearing auth 与 icon/media fallback 的 canonical owner；`app-server` 只负责 child-runtime 生命周期与 endpoint 发现，`client-sdk`、`webui` 必须直连该 service 的公开接口，不能重新引入第二套本地 authority。
- room / terminal seat credential 属于 Avatar seat 的本地状态，而不是 workspace root state；它们必须落在目标 Avatar 自己的 `settings.local.json` 中。
- `app-server` 是 WorkspaceSystem、AvatarRuntime lifecycle 与 attention-derived notification projection 的组合根，但它不能偷当 room/terminal durable truth owner。
- runtime shell surface 采用“固定原语 + 渐进发现”法则：模型先看到 root workspace 与 skills 索引，需要细节时再通过 `ccski` 和各 system CLI 展开，而不是把 system guide 预注入到 bootstrap prompt。
- 新能力优先以“新增原子 + 复用平台法则”的方式接入；当现有法则无法优雅容纳时，应优先升级法则，而不是补 source-specific glue。

## 4. Durable Runtime Contract

- LoopBus phase 固定为：`waiting_commits -> collecting_inputs -> persisting_cycle -> calling_model -> stopped`。
- `waitCommitted(fromHash)` 风格的等待必须清理 race losers，避免 waiter / listener 泄漏。
- `score > 0` 只表示义务仍然存在，不表示允许无限重试；重复等价失败必须进入 containment / backoff，直到新证据或人工干预。
- Context compact 是强制的内核能力；它只重写 bounded `promptWindow`，可以丢弃已完成噪音，但不得丢弃未完成 attention debt 或 durable facts。
- 用户可见回复与内部推进必须分离：attention/internal activity 不自动等于 user-visible reply。
- `session.stop` 的 durable 语义是“runtime 脱离 kernel ownership”；之后的 `session.start` 必须从 persisted session/attention facts 重建 runtime，而不是恢复隐藏的 paused in-memory runtime。
- 真正的冷重启恢复必须经得起 real-provider 验收：在 room 可见交付之后，经过 `session.stop -> kernel restart -> session.start`，同一 session 仍能继续完成后续反馈。

## 5. 产品表面长期法则

- 一级导航固定为 `Avatars`、`Workspaces`、`Messages`、`Terminals`。
- 三个一级 workbench 统一渲染为共享 browser-style workbench window：上层是 tabs，下层是响应式 toolbar，body 也属于同一窗口外轮廓。页面级标题、metadata、局部 actions 与 body 边界都必须挂载到这套共享 chrome 中，而不是在 route 内再手搓第二层 header 或独立外壳。
- 进入这套 window 之后，route 根 surface 只能使用共享的 integrated `page/pane` 法则：`page` 负责窗口内整页，`pane` 负责 split-view 次级面板。禁止在 primary workbench route 内再包一层 detached outer card。
- WebUI 的 redirect-only route entry（如 `/`、`/avatars`、`/avatars/runtime/{sessionId}`）必须通过 route-layer canonical redirect 在 feature 渲染前收敛；禁止再用 mount-time `goto()` 或 feature glue 补入口跳转。
- `Avatars` 是统一的全局 avatar catalog workbench；运行中的 avatar session 以动态 runtime tabs 追加在同一层，不再复用旧的 workspace/history/settings 子页心智。
- `Workspaces` 是独立的全局 WorkspaceSystem workbench；每个 workspace 只对应一个目录根，并通过共享 content header 暴露 `View as` avatar lens 与 `Explorer / Rules / Private` 三个 peer modes。
- `Messages` 是 `message-system` 的全局 workbench；每个 room 对应一个 tab，并固定保留一个 `new room` tab。`room` 是当前聊天 channel 的承载概念，不能把 `room` 与 `chat`、`message-system` 混为一个概念。
- `Terminals` 是 `terminal-system` 的全局 workbench；每个 terminal 对应一个 tab，并固定保留一个 `new terminal` tab。创建成功后，workbench 必须自动聚焦到新 terminal 的 canonical route。terminal surface 内右侧固定表达 `Actions + Users` 两类事实，focus 永远属于 seat，而不是 terminal 对象本身。
- `settings` 不再作为一级入口；超级管理员入口、root key 绑定、profile 编辑和全局身份管理统一收拢到辅助路由 `/admin`，并通过 shell footer 的 `super admin` 入口进入。
- `~/` 是 special global workspace。canonical avatar catalog 与用户级默认配置通过它暴露，但 room / terminal 自身不从属于 workspace。
- Avatar durable storage root 必须按 principal address 建模；`nickname` 只是 discoverability alias，不得再成为 canonical folder name。
- `Quick Start` 是 Avatar 启动编排器，而不是“发第一条消息”的快捷页；它持有 workspace、avatar 与未来可扩展的全局系统引用，并在用户 detour 到 `Messages` / `Terminals` 后继续保留当前草稿。
- 运行中的 avatar discoverability 统一通过 `Avatars` 顶部的动态 runtime tabs 表达，不再保留单独的 `Running Avatars` 次级导航卡片。进入单个 avatar 后，默认页固定为 `Heartbeat`，runtime tabs 为 `Heartbeat / Attention / Settings`。
- Avatar 是 durable active-session identity；再次启动同一 Avatar 时必须复用同一个稳定 runtime/session id，额外 workspace 通过 mount 追加，而不是创建第二个 `workspace + avatar` pair runtime。
- `default` 是默认 avatar nickname，也是永远可见的空白起点；regular workspace 修改 global-source avatar 时，先完整复制再修改，不做 overlay 式局部覆盖。
- Chat 是 conversation-first surface；cycle、tool trace、attention runtime 属于 Devtools / inspector surface。
- Svelte WebUI feature code 只能使用 canonical shadcn-svelte multipart composition；`Card.Root/Header/Content`、`Tabs.Root/List/Trigger/Content` 这类显式 slot 是 durable contract，alias-style wrapper 不是。
- WebUI route panel 必须通过显式 shell primitive 声明 `header + primary ScrollView body` 的结构；feature code 不得继续用 `p-0/py-0/min-h-0` 之类补丁去修复错误的容器语义。
- `Terminals` 是 app-level global workbench，不是 session-private surface；session route 只允许链接或投影该工作台，不能重新定义第二套 terminal truth。
- Devtools 是技术事实的独立检查面板，不把技术结构反向污染主聊天流。
- regular workspace 与 global workspace 共用同一套 settings API shape：shared defaults 落到 `settings.json`，machine-local secret 落到 workspace/global `settings.local.json`，Avatar seat 的 room / terminal credential 落到 avatar-local `settings.local.json`。
- Session / room / profile-avatar icon 必须通过 profile-service 的 typed semantic URL family 消费；owner type 不能混入无类型 bucket。fallback 由服务端统一解析（uploaded asset > eligible external fallback > deterministic renderer），默认读返回服务端光栅化结果，前端不得再承担 fallback rasterization authority。
- 应用级品牌图标的 canonical source 固定在仓库根 `assets/source/master`；Web favicon、PWA、Apple、Android、macOS 等派生资产必须由统一脚本从该主源生成，`packages/webui/static` 只承载运行时消费副本，不得成为第二真源。
- 桌面端与移动端都是一等验收对象；能力必须双端可达，但导航结构可以不同。

## 6. 测试与验收法则

- 默认工程实践是 BDD-first；TDD 是落地手段，不是替代行为描述。
- 关键链路改动必须有 integration 或 e2e 证据；WebUI 复杂交互优先 Storybook DOM contract。
- 真实流程优先于主观推断；对模型、终端、runtime 的判断必须先跑证据链。
- durable 行为变化的完成标准包含：实现、测试、SPEC/AGENTS 同步，而不是只看代码通过。

## 7. 变更纪律

- 任何改变平台法则、系统边界、durable contract 的实现，在 archive OpenSpec change 之前必须同步更新 `SPEC.md` 或对应包级 `SPEC.md`。
- `SPEC.md` 保持精简，不记录短期任务、阶段性收口状态、执行流水账。
- 若 `openspec/changes/*` 与 durable spec 不一致，以“先补 durable spec，再 archive”为强制流程。
