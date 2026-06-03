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
- AttentionSystem 是独立 durable truth owner：它拥有 `AttentionContext` / `AttentionItem` 的持久化、commit 语义与恢复法则。`SessionRuntime` 可以消费、调度、推进 attention，但不得成为外部系统写入 durable attention truth 的唯一入口。
- `*System` 必须面向 Attention 编程：当系统观察到新的事实、未完成义务、或 AI 行为方式不符合预期时，优先通过 attention commit 把这些事实与 obligation 显式化，而不是把“下一步该怎么做”硬编码进内核分支。
- LoopBus 是持续存在的 runtime core。它负责等待输入、收集输入、持久化 cycle、调用模型与协调 adapter side-effects，但不拥有 source-specific 业务语义。
- Session DB 只存事实，不存可推导快照。projection、view model、UI 结构都属于派生层。
- Heartbeat compact boundary 是 durable ledger fact：prompt-window compaction 发生时，session ledger 必须追加 `scope=heartbeat_part` 的 `partType=compact` 边界消息，UI 不得再从 cycles 或 assistant prose 猜测上下文重开位置。
- Heartbeat inspection 的 durable truth 是一条 merged `message_part` stream：`scope=heartbeat_part` 负责 AI-visible request/response 与 compact boundary，`scope=request_aux` 负责 deduplicated `systemPrompt / tools / config`；客户端与 Studio 不得再把 chat / request-aux / model-call 三条投影重新拼成“主 Heartbeat 时间线”。
- AvatarRuntime identity 是 avatar-first 的：一个 Avatar 只有一个 canonical runtime/session id；workspace membership 只能通过 WorkspaceSystem mount 附着，不能再成为 runtime identity 的一部分。
- Session/runtime 的硬锚点是 `attentionSystem` 与 `workspaceSystem`；`messageSystem`、`terminalSystem`、`taskSystem` 等都作为外部系统通过 `attentionContext -> source` 投影进入运行时，session durability 不得再持久化 `primaryRoomId` 这类内建默认 room 字段。
- App-owned assistant prompt 是 avatar-first 的：`AGENTER.mdx` 必须按 global Avatar principal root 寻址；app-owned prompt body 必须作为 app package resource 通过 MDX Slot 引入（例如 `app:shell/ShellAssistant.mdx`），而不是在启动代码里硬编码完整提示词。raw recording 默认通过 NoteSystem 写入 active `AVATAR_HOME` 下的 note facts。NoteSystem 由独立 `@agenter/note-system` 包拥有；它的 identity/query authority 是 SQLite-backed notebook -> section -> page model，文件 artifact 只作为人类可读存储。legacy memory files 只是用户资产或未来 derivation 输入，不再作为 app-shell 默认记录 API；project workspace 只能作为 cwd/mount/grant/workbench/exec/tool surface 或显式 workspace-private overlay，不能成为默认人格/关系记录 owner。
- `*-old` 与 `*-bak` 目录只作为参考代码或迁移快照，不属于 active workspace package/project set；根 workspace discovery、typecheck、test 与 release project 集合不得通过宽泛 glob 把它们重新纳入。
- Room durability 的 durable truth 属于 `room-management` 边界；`message-system` 是 superadmin-bound authority/runtime，负责 Contact、source subscription、signature/proof 与对 room-management 的授权调用，不再被视为私有 room 数据库 owner。
- 可见 room transcript truth 与 runtime cycle truth 必须分面呈现：room/message surface 拥有 transcript truth，runtime/heartbeat/cycle surface 只表达 projection truth；top-level `chat.*` 不再是 durable public truth vocabulary。
- Room transcript 同步必须使用 room-management 拥有的 revision 坐标：`roomRevision` 表达 room metadata/grant/read/presence 等 surface 变化，`transcriptRevision` 表达 transcript 行变化，snapshot、reverse page、transport message 与 app-server realtime `message.room.updated` 都必须携带同一套坐标；客户端收到“有变化”后必须基于该坐标重新拉取 page/snapshot，不能再依赖无版本的 room id invalidation。
- Room 文本消息对人类 transcript 默认立即可见；`attentionState=queued` 只表示它仍欠 AI/automation attention，不再表示“先隐藏，等 attention 后再显示”。
- Room 级 read progress / read receipt 的 durable truth 属于 room-management，并以消息级冻结成员数组 `readContactIds` / `unreadContactIds` 维护，而不是退化成 session unread badge 或可变 seat cursor。
- Room transcript/history 与 active scheduler/readiness projection 必须分离：recalled row 可以继续存在于 room-management 历史 transcript 与冻结 read/unread 数组中，但 unread counters、runtime readiness、active latest、watch predicates 与 scheduler summaries 只能基于 active-visible rows（`visible_at is not null` 且未 recalled）计算。
- Terminal truth、grant、approval、lease、activity history 的 durable truth 属于全局 `terminal-system`；session 只保留 terminal binding、focus refs、approval subscription 与推理所需 projection facts，不复制 terminal history 当作自己的真源。
- Terminal live/history/archive 必须是同一张 `terminal_instance` durable truth 的投影：`terminal list` 只返回 live terminals；killed terminals 离开 live registry 并进入 explicit history；archive 只是把 killed evidence 进一步移出默认 history work queue，不能重新发明第二张 history 真表。
- Terminal 长时观察必须通过独立的 `terminal await` 原语表达；它等待 TerminalSystem 拥有的稳定 snapshot / status / commit truth，返回 bounded clean lines 与 post-mortem evidence，不把等待、匹配或 debounce 语义塞进 `terminal read`。
- Terminal focus truth 属于 actor-scoped seat state；inspection tab、UI 选中态、以及别的 actor 的 focus 都不能被错误投影成当前 session actor 的 terminal attention 输入。
- Terminal profile 的 renderer/theme/cursor truth 属于 `terminal-system` 的 declarative durable config：后端只发布 `rendererPreference + theme + cursor`，前端按环境把 `auto` 解析成 `resolvedRenderer`；AI-facing terminal config mutation 不得拥有 renderer/theme 改写权。
- WorkspaceSystem 是独立平台系统，拥有 workspace mount、path grant、public assets、avatar-private assets 与 non-interactive workspace exec；workspace 不拥有 room 或 terminal truth。
- Workspace path grant 的 durable law 是“workspace-root-relative ordered glob rules”: 规则默认拒绝、last-match-wins，并由共享的 overlay-rule filesystem evaluator 驱动 workspace bash、root workspace bash、terminal cwd 校验与 workbench explorer/preview。
- Avatar private runtime home 是固定原语：每个 runtime 都必须拥有一个按 principal address 定位的 root workspace，dynamic workspace mounts 只是在此基础上的额外授权。
- shell surface 必须显式区分 `root-workspace` 与 `public-workspace` 语义，但 avatar-private 能力的 authority 是 workspace instance env：fixed root-workspace 只是默认携带 `AVATAR_HOME` / `SKILLS_HOME` 的 workspace instance；mounted public-workspace 与 shared terminal 默认保持 collaboration semantics，只有显式 env/capability projection 才能获得 private CLI。
- AttentionContext 拥有 durable focus state（`focused | background | muted`）与 ingress semantics（`commit | push`）；`focused` 与 `background` 的未清 score 都可以继续激活 LoopBus，`muted` 默认不激活，notification-class push 可以忽略 focus 抑制强制唤醒；notification 仍然只是 attention push 的投影，不得再引入第二套 unread truth。
- AttentionContext 与 AttentionItems 是两条正交输入平面：Context 在 compact / cold start / focus projection 这类边界注入，用 metadata + scores + snapshot/diff 重建当前投影；Items 只在运行中的当前 commit delta 注入，用来主动提醒 AI “刚刚有新义务”。历史 items、focus 切换、AI 自己的 `attention commit` 都不得被当成新提醒回放。
- Attention durable fact 必须显式分层为 provenance / body 两个平面：`meta` 只描述来源，`summary + change` 承载 AI 可见内容；可见外部效果必须走显式 system mutation 或 dispatch/receipt 事实，不得再把 reply target、私有 blob、快捷动作塞回 metadata。
- LoopBus / source adapter 的 transport metadata 只允许承载调度、协议、持久化回溯所需的 facts；AI 需要理解的内容必须进 attention body 或 typed tool/query，不能靠 hidden metadata side channel。
- LoopBus built-in source ref / read result contract 必须保持 protocol-native `src` law：message / terminal / task 都通过各自 namespace 的 typed `src` 寻址；message namespace 至少支持 room-scope `msg:<chatId>` 与 row-scope `msg:<chatId>/<messageId>`，其中可读的 room message source ref 仍使用 row-scope 形态；不得重新打开 `meta` 逃逸口。
- 同轮 tool-result 边界的追加输入必须通过统一 attention commit API 完成：hook 只暴露“现在可 commit”的时机与 `ctx.commit...()` 能力，不得通过 hook return、provider adapter 私有字段或其它额外渠道把 user/attention payload 直接塞进模型请求；MessageRoom read ack、Terminal/Task consume 标记、trace 与 projection 必须和该 commit 同步发生。
- Studio actor-private preference persistence 属于独立的 auth-scoped KV plane，而不是 settings graph、runtime snapshot 或 runtime event stream 的附属字段；后端只理解 opaque key + `keys[] | prefix` filter，不理解 avatar/workspace 等业务 scope。
- Studio 中需要 resume / discard / complete lifecycle 的长寿命 create/edit draft 不得退化成 opaque KV；它们必须升级为 auth-scoped typed draft resources，并与 device-local workbench tabs 解耦。
- Studio 的用户可见滚动所有权必须统一委托给共享 scroll primitive：标准 surface 走 `ScrollView`，bottom-anchored conversation / timeline surface 走 `BottomAnchoredTimeline`；feature code 不得再直接以 raw `overflow-auto/scroll` 充当主滚动 owner。
- 共享 workbench chrome 的 `page_content` body 必须是页面级唯一 scroll owner：`tabs` 与 `page_toolbar` 永远固定在外层 chrome，route-root wrapper 只能用 `min-h-full` 等 stretch 语义填满 body，不能再用 `h-full`、raw clipping 或隐式 overflow 把 shared window body 锁死成不可滚动。
- bottom-anchored transcript / timeline 的语义滚动法则固定为 `ScrollController + Named Trigger + Query + tx`：feature code 只能通过 installed program 读取 `query.<name>.*` 并在 `tx(...)` 中表达 scroll semantics，不得再持有第二套 `scrollTop` / `request(...)` / local observer graph ownership。
- Search / FTS index 只能是可重建 projection，不能升级成 durable truth；删除索引后系统仍必须能从事实库或 attention durable state 重建搜索能力。
- `message query` 是 `message-system` 内部的消息专用查询原语，不引入跨 system 的泛化 search 抽象；它固定使用 `chatId + mode(match|query|sql) + query` contract，并且必须先解析 caller 当前持有的 room scope，再运行 match / FTS / SQL。
- `message query` 的 `sql` mode 只能运行在预授权房间消息的临时只读投影上，不能直接暴露 raw room SQLite truth、全局 sidecar catalog 或可变连接状态。
- Attention search 的默认面向未完成工作，但显式 `score/hash` 查询属于历史事实定位：普通文本默认 active-only，`score:` / `hash:` 若未显式提供 `minscore`，默认应包含历史提交。
- Cancellation、stop、abort、timeout 必须共享同一套显式语义，并持久化为事实。
- Provider 请求保持纯度。HTTP/model body 只表达真实 provider 参数；调度、cycle、trace identity 等运行事实只能进入 `ai_call.requestBody.meta` 与 runtime publication contract，不能重新落回独立 `session_cycle` 或 session-db telemetry 表。
- provider continuation 可以在 TanStack/adapter 的同步 loop strategy 中追加已提交 attention projection，但该 strategy 只能消费已经由统一 commit API 产出的 projection，不能在同步 provider loop 内执行 source drain、read ack 或 attention commit。
- LoopBus 的模型表面必须保持极小：稳定 attention law、attention-backed `skills.list` 摘要、以及 `workspace_list` / `root_bash` / `workspace_bash` 三个显式 workspace 原语。message / workspace / terminal / future systems 的操作统一经由 runtime-local CLI/API 自助发现，不再直接注入成 model tools。
- runtime-local CLI/API 的 tool surface 必须遵守单一信源：`attention` / `message` / `workspace` / `terminal` 的 route、description、`inputSchema`、`--help` 与 canonical examples 都由共享 descriptor registry 派生；AI-facing shell 不再接受 positional/natural-form 参数，只接受空输入、单个 JSON argv 或 JSON stdin，且当前唯一的特殊非 JSON 标记就是 `--help`。
- MCP system 是 root-workspace runtime atom，不是 provider-side hidden tool injection：MCP 全局配置、项目启用、实例生命周期、project-local discovery snapshot、SQL 查询与 tool 调用都由 mcpSystem 统一拥有；模型只通过 root-workspace `mcp` CLI/API 和 `agenter-mcp` skill 渐进发现并显式调用。
- MCP global config 与 project enablement 必须分离：`mcp add/remove` 只管理 global，`mcp enable/disable/list/start/stop/restart/call` 都要求显式 exact project path；新增 global 在所有 project 中默认 disabled，project 之间不继承 enablement、live instance 或 snapshot。
- `mcp query` 是只读 SQL 投影面，只暴露 `mcp_installed` 与 `mcp_enabled` 两张临时表并永远返回 JSON rows；能力信息只能作为 project-local snapshot JSON 出现在 `mcp_enabled` 行上，不能另建 capability truth 或跨 project 共享。
- Studio 是 descriptor-driven app package，而不是 core CLI 的内置 web mode：`agenter studio` 通过 app descriptor 启动 `agenter-app-studio`，Studio 自己拥有 static/dev serving 与 app argv；core CLI 不再保留 `agenter web`、WebUI static-root 或 asset-copy 特权路径。
- 当某个系统需要把 authority 共享给别的 runtime/client 时，平台优先复用 `system backend + endpoint/token/proof client frontend` 法则：
  - durable truth 与 lifecycle mutation 继续留在 owning backend system
  - frontend client 只负责 transport projection、proof submission 与 accepted seat 的本地投影缓存
  - HTTP link、deep link、raw token 都只是 invitation token 的投影，不得升级成新的 authority owner
  - resource-specific authority grammar 必须继续由 adapter 自己定义，不得为了共享 transport 强行抽象成 universal role model
- `workspace-manage` 不自动继承这套法则。是否让 workspace 进入 managed-seat handshake，必须等 workspace 自身的 authority/object model 先证明值得承担这层解耦成本，再另立 change。
- runtime-local CLI/API 的长时命令必须共享 cancellation law：shell/process abort、HTTP request abort 与 system 内部 wait resources 必须串联到同一个 `AbortSignal` 语义；当外部 `timeout` 杀掉 CLI 时，server-side waiter/listener/timer 仍然必须释放。
- skill system 也是 attention-first 平台原子：它的 durable truth 来自 on-disk skill files，默认 live truth 只观察 `SKILL.md + ccski.config.json`，额外 watched files 只能由 skill 自己声明；watcher 只是 live hint，session-local fingerprint manifest 负责补齐进程未运行期间的变更检测；skill 变更通过 attention reminder 发布，而不是重新回流到 prompt glue。
- skill system 的 facade 可以保持单一入口，但内部法则必须保持原子化：catalog discovery、truth snapshot、diff、baseline store、watch dirtiness 与 attention publishing 是独立职责；diff / override identity 固定只使用 `skill.name`。

## 3. 正交设计边界

- `message-system`、`terminal-system`、`task-system`、未来的 `browser-system` / `os-system` 都是 source adapter，不得把自己的私有语义硬编码进 LoopBus core。
- `AgenterAI` 是 attention-first decision engine，不应直接绑定 terminal/task 等 source-specific gateway、payload 结构或 stage 语义。
- source adapter 与内核只通过协议、hook、tool provider、attention commit、message dispatch 这类明确边界协作，不能跨层偷写规则。
- 当 source adapter 希望强化某类后续行为时，应优先提交额外的 typed attention items，并由该 system 自己的 skill 教 AI 如何理解和处理这些 items；不要把这类行为期待偷塞进全局 prompt 或内核特判。
- source ref / read result 如果只承担 lookup hint，就只能服务 adapter 自身寻址；一旦某事实要进入 durable attention、prompt payload 或外部 UI 契约，就必须先提升为 typed draft field 或 attention body。
- `@agenter/web-chat-view` 是 room transcript 的共享 transport surface，必须保持对 `agenter-app-studio` 的包级正交；operator route 消费它，而不是重新发明一套 route-local transcript renderer。
- `Heartbeat` 与 `@agenter/web-chat-view` 这类 latest-anchored transcript surface 的 durable law 是“chronological storage, reverse-flow view boundary”: store / transport 仍保持时间正序 truth，reverse 映射只允许发生在共享 timeline primitive 边界，不得泄漏回 durable merge / pagination contract。
- Auth identity 与 Avatar/business role 永远分层：auth 只表达“谁可以认证并持有授权声明”，Avatar 只表达 workspace/session 的业务角色与提示词行为。
- `auth-service` 是 durable auth identity、profile projection、proof-bearing auth 与 icon/media fallback 的 canonical owner；`profile-service` 只保留为兼容别名。`app-server` 只负责 child-runtime 生命周期与 endpoint 发现，`client-sdk`、Studio 必须直连该 service 的公开接口，不能重新引入第二套本地 authority。
- room / terminal seat credential 属于 Avatar seat 的本地状态，而不是 workspace root state；它们必须落在目标 Avatar 自己的 `settings.local.json` 中。
- `app-server` 是 WorkspaceSystem、AvatarRuntime lifecycle 与 attention-derived notification projection 的组合根，但它不能偷当 room/terminal durable truth owner。
- runtime shell surface 采用“固定原语 + 渐进发现”法则：模型先看到 root workspace 与 skills 索引，需要细节时再通过 `skill` 和各 system CLI 展开，而不是把 system guide 预注入到 bootstrap prompt。
- 新能力优先以“新增原子 + 复用平台法则”的方式接入；当现有法则无法优雅容纳时，应优先升级法则，而不是补 source-specific glue。

## 4. Durable Runtime Contract

- LoopBus phase 固定为：`waiting_commits -> collecting_inputs -> persisting_cycle -> calling_model -> stopped`。
- `waitCommitted(fromHash)` 风格的等待必须清理 race losers，避免 waiter / listener 泄漏。
- `score > 0` 只表示义务仍然存在，不表示允许无限重试；重复等价失败必须进入 containment / backoff，直到新证据或人工干预。
- Context compact 是强制的内核能力；它只重写 bounded `promptWindow`，可以丢弃已完成噪音，但不得丢弃未完成 attention debt 或 durable facts。
- 用户可见回复与内部推进必须分离：attention/internal activity 不自动等于 user-visible reply。
- `session.stop` 的 durable 语义是“runtime 脱离 kernel ownership”；之后的 `session.start` 必须从 persisted session/attention facts 重建 runtime，而不是恢复隐藏的 paused in-memory runtime。
- client-side stopped/paused session projection 必须保留最近一次已加载的 inspection truth（如 Heartbeat、observability、model calls、request aux、terminal snapshot/read）；runtime 缺席只表示 live ownership 消失，不得把这些 surface 退回空白 loading。
- 真正的冷重启恢复必须经得起 real-provider 验收：在 room 可见交付之后，经过 `session.stop -> kernel restart -> session.start`，同一 session 仍能继续完成后续反馈。

## 5. 产品表面长期法则

- 一级导航固定为 `Avatars`、`Skills`、`Notes`、`Messages`、`Workspaces`、`Terminals`。
- 一级系统 workbench 统一渲染为共享 browser-style workbench window：上层是 tabs，下层是响应式 toolbar，body 也属于同一窗口外轮廓。页面级标题、metadata、局部 actions 与 body 边界都必须挂载到这套共享 chrome 中，而不是在 route 内再手搓第二层 header 或独立外壳。
- 进入这套 window 之后，route 根 surface 只能使用共享的 integrated `page/pane` 法则：`page` 负责窗口内整页，`pane` 负责次级面板。禁止在 primary workbench route 内再包一层 detached outer card。
- 共享 workbench window body 负责页面级滚动；如果 route 内还需要独立 stage/pane 滚动，必须显式声明次级 `ScrollView`，而不是靠 route 根容器的固定高度或隐藏裁剪去“碰巧可用”。
- 当 route 需要 `main + right detail` 关系时，必须复用共享 split-detail law：desktop 以 ratio-driven resize handle 持久化，compact 以 container-width collapse 进入 right-sheet；禁止再用 route-local `detailMode + matchMedia + fixed drawer width` 自行拼装。
- compact right detail 打开时，`page-toolbar` 只允许接管为 close-only view affordance；detail-local 的 save / reload / apply / create 等功能动作继续留在 page content，通常留在 left-side `bottom-area`。
- Studio 的 redirect-only route entry（如 `/`、`/avatars`、`/avatars/runtime/{sessionId}`）必须通过 route-layer canonical redirect 在 feature 渲染前收敛；禁止再用 mount-time `goto()` 或 feature glue 补入口跳转。
- `Avatars` 是统一的全局 avatar catalog workbench；运行中的 avatar session 以动态 runtime tabs 追加在同一层，不再复用旧的 workspace/history/settings 子页心智。
- `Skills` 是统一的只读 skill workbench：固定保留一个 catalog tab，并在其 `page-tabs` 中表达 `SKILLS_HOME / built-in / avatars`；默认 `/skills` 落到 `SKILLS_HOME`，旧 `view=shared` / `view=global` 收敛为 `view=skills-home`，旧 `view=avatar` 入口必须在 route 层收敛为 `view=avatars`。从 `avatars` overview 打开的专属 avatar skill browser 以 closable workbench tab 追加在同一层。
- `Skills` 的 durable truth 永远来自 objective skill roots，而不是前端自行拼接 sibling path：`SKILLS_HOME / built-in` 一律是 skill-list-first 的 accordion list-detail browser，并显示产出该 visible skill 的 source env/path；`avatars` 一律是 avatar-list-first overview，detail 只预览 workspace-grouped avatar-private skill roots，真正的文件树浏览放进 dedicated avatar tab。
- `Skills` preview law 固定为一层 preview shell：所有 selected file 都走隔离的 `filePreviewer` iframe entry；`filePreviewer` 内部再按 kind 选择 renderer，其中 text-like files 默认使用 CodeMirror source preview，`pdf / image / audio / video` 使用对应成熟 renderer，不支持的类型也必须在同一 preview shell 中显式进入 unsupported 状态。
- `Notes` 是 NoteSystem 的 inspection workbench：它通过 client-sdk/runtime-store typed facades 读取 catalog/page/search/tags/read-only-SQL projection，显式展示 `AVATAR_HOME` capability state，并按 notebook -> section -> page 组织 raw note facts、stable IDs、MIME、tags 与 references；Studio 不得直接 import `@agenter/note-system` implementation internals、app-server host internals 或读取本地文件系统。
- `Workspaces` 是独立的全局 WorkspaceSystem workbench；每个 workspace 只对应一个目录根，并通过共享 page-toolbar 暴露 `View as` avatar lens 与 `Explorer / Rules / Private / CLI` 四个 peer modes，content header 只保留 workspace root 与 surface facts。
- Workspace CLI discovery 只展示 app/runtime truth：包含 `just-bash` builtins、descriptor-backed root runtime CLI、以及当前 workspace/avatar 的 public/private tool commands；不把任意 PATH binary 伪装成 workspace capability。
- Workspace shell dialog 只是 browser helpcenter 对 backend shell truth 的控制投影：catalog row 必须提供 `suggestedCommand`，必要时显式声明 `root-workspace | public-workspace` 执行面；browser 不得再本地实现第二套 shell，且 `root-workspace` shell dialog 在 runtime 未激活时必须直接报错而不是隐式拉起 authority。
- Workspace workbench 必须显式展示 `root-workspace` vs `public-workspace` 的 env/CLI 语义差异，但不得把这种差异表述成“root-workspace 不可共享”的所有权禁令。
- workspace detail 可以从 `/workspaces` 自己打开 workspace-centric 的管理对话框来做 Avatar mount / unmount；这类控制面不再回流到 Avatar detail。
- `Messages` 是 `message-system` 的全局 workbench；每个 room 对应一个 tab，并固定保留一个 `new room` tab。`room` 是当前聊天 channel 的承载概念，不能把 `room` 与 `chat`、`message-system` 混为一个概念。
- `Terminals` 是 `terminal-system` 的全局 workbench；每个 terminal 对应一个 tab，并固定保留一个 `new terminal` tab。创建成功后，workbench 必须自动聚焦到新 terminal 的 canonical route。terminal surface 内右侧固定表达 `Actions + Users` 两类事实，focus 永远属于 seat，而不是 terminal 对象本身。
- `settings` 不再作为一级入口；超级管理员入口、root key 绑定、profile 编辑和全局身份管理统一收拢到辅助路由 `/admin`，并通过 shell footer 的 `super admin` 入口进入。
- `~/` 是 special global workspace。canonical avatar catalog 与用户级默认配置通过它暴露，但 room / terminal 自身不从属于 workspace。
- Avatar durable storage root 必须按 principal address 建模；`nickname` 只是 discoverability alias，不得再成为 canonical folder name。
- `Quick Start` 是 Avatar 启动编排器，而不是“发第一条消息”的快捷页；它持有 workspace、avatar 与未来可扩展的全局系统引用，并在用户 detour 到 `Messages` / `Terminals` 后继续保留当前草稿。
- 运行中的 avatar discoverability 统一通过 `Avatars` 顶部的动态 runtime tabs 表达，不再保留单独的 `Running Avatars` 次级导航卡片。进入单个 avatar 后，默认页固定为 `Heartbeat`，runtime tabs 为 `Heartbeat / Attention / Settings`。
- `Heartbeat` 是运行时主时间线；它除了 user / assistant message 之外，还必须展示 compact boundary separator 这类 durable runtime boundary，而不是把 prompt-window 重开事实藏在 cycle inspector 里。
- `Heartbeat` 主视图的渲染真源固定为 runtime Heartbeat merged page API；`systemPrompt / tools / config / compact` 默认折叠，AI-visible request/response rows 直接展示 raw message-parts，不再依赖 model-call card 作为主叙事。
- Avatar 是 durable active-session identity；再次启动同一 Avatar 时必须复用同一个稳定 runtime/session id，额外 workspace 通过 mount 追加，而不是创建第二个 `workspace + avatar` pair runtime。
- `default` 是默认 avatar nickname，也是永远可见的空白起点；regular workspace 修改 global-source avatar 时，先完整复制再修改，不做 overlay 式局部覆盖。
- Chat 是 conversation-first surface；cycle、tool trace、attention runtime 属于 Devtools / inspector surface。
- Svelte Studio feature code 只能使用 canonical shadcn-svelte multipart composition；`Card.Root/Header/Content`、`Tabs.Root/List/Trigger/Content` 这类显式 slot 是 durable contract，alias-style wrapper 不是。
- Studio route panel 必须通过显式 shell primitive 声明 `header + primary ScrollView body` 的结构；feature code 不得继续用 `p-0/py-0/min-h-0` 之类补丁去修复错误的容器语义。
- `Terminals` 是 app-level global workbench，不是 session-private surface；session route 只允许链接或投影该工作台，不能重新定义第二套 terminal truth。
- Devtools 是技术事实的独立检查面板，不把技术结构反向污染主聊天流。
- regular workspace 与 global workspace 共用同一套 settings API shape：shared defaults 落到 `settings.json`，machine-local secret 落到 workspace/global `settings.local.json`，Avatar seat 的 room / terminal credential 落到 avatar-local `settings.local.json`。
- Session / room / profile-avatar icon 必须通过 auth-service 的 typed semantic URL family 消费；`profile` 在这里是 media owner 类型，不是服务包名。owner type 不能混入无类型 bucket。fallback 由服务端统一解析（uploaded asset > eligible external fallback > deterministic renderer），默认读返回服务端光栅化结果，前端不得再承担 fallback rasterization authority。
- 应用级品牌图标的 canonical source 固定在仓库根 `assets/source/master`；Web favicon、PWA、Apple、Android、macOS 等派生资产必须由统一脚本从该主源生成，`apps/studio/static` 只承载运行时消费副本，不得成为第二真源。
- 桌面端与移动端都是一等验收对象；能力必须双端可达，但导航结构可以不同。

## 6. 测试与验收法则

- 默认工程实践是 BDD-first；TDD 是落地手段，不是替代行为描述。
- 关键链路改动必须有 integration 或 e2e 证据；Studio 复杂交互优先 Storybook DOM contract。
- `agenter-app-studio` 的 Storybook DOM contract 与 `storybook:build` 属于同一条工具链合同；静态 Storybook 构建不得在 DOM tests 仍然通过时继续处于崩溃状态。
- 真实流程优先于主观推断；对模型、终端、runtime 的判断必须先跑证据链。
- durable 行为变化的完成标准包含：实现、测试、SPEC/AGENTS 同步，而不是只看代码通过。

## 7. 变更纪律

- 任何改变平台法则、系统边界、durable contract 的实现，在 archive OpenSpec change 之前必须同步更新 `SPEC.md` 或对应包级 `SPEC.md`。
- `SPEC.md` 保持精简，不记录短期任务、阶段性收口状态、执行流水账。
- 若 `openspec/changes/*` 与 durable spec 不一致，以“先补 durable spec，再 archive”为强制流程。
- 新的 OpenSpec change 默认使用 project-local `vision-driven` schema：先以 `plans/plan.md` 作为 Intent Document SSOT 收敛用户意图与最终可见效果，再生成 specs、BDD tasks、实现与 `review/self-review.md`。`review/self-review.md` 是宏观复盘与判断记录；`review/self-review.html` 是单独的截图、交互、结构化证据展示报告。`plans/plan.md` 发生实质修订前必须备份为 `plans/plan-vN.md`；连续 2 轮 self-review 未解决的问题必须回到 research-plan/specs 阶段，而不是在实现层继续打补丁。既有 `schema: spec-driven` change 保持原 schema 解析。

## 8. 发布法则

- npm release path 固定为 changesets + GitHub Actions trusted publishing：`.github/workflows/release.yml` 在 `main` push 或手动触发时创建 version PR 或发布。
- npm trusted publisher claim 必须保持：publisher `GitHub Actions`，repository `jixoai/agenter`，workflow filename `release.yml`，environment `npm-release`，并允许 `npm publish` 与 `npm stage publish`。
- release workflow 必须授予 `id-token: write`，并通过 `environment: npm-release` 匹配 npm OIDC claim；正常 CI 发布不得依赖长期 `NPM_TOKEN` secret。
- `scripts/npm/configure-trusted-publish.ts` 是 npm trusted publisher 的批量配置/检查工具；它只用于 operator 本地对 npm 包配置 trust，不把 token 带入 CI。
- `@jixo/ghostty-native` 的发布真源是 umbrella 包 + 显式平台包矩阵：`@jixo/ghostty-native-{darwin-(arm64|x64)|linux-(arm64|x64)-gnu|win32-(arm64|x64)-msvc}`。matrix truth 由 `scripts/binaries/artifacts.ts` 拥有；release workflow 必须先在对应 runner 上产出 `.node`，再 stage 回平台包目录后才允许 pack/publish。
- ghostty 平台包目录是 publish-time binary staging surface，不是源码真源；仓库保持 binary-free，CI/本地 release 只在 pack/publish 前把 `termless-ghostty-native.node` 注入这些 package dirs。
- 新 npm 包的初次 publish / trust 收口工具是 `scripts/npm/bootstrap-package.ts`；它允许 operator 在 package 还不存在时先做一次初次 publish，再配置 trusted publishing，随后常规发布重新回到 GitHub OIDC 路径。
- Agenter 可发布 npm 包集合的单一真源是 `scripts/release/release-manifest.ts` 的 `releasePublishablePackageJsonPaths`；trusted publish 配置、bundle build、publish 与发布校验都必须复用这份 manifest，不能另用 workspace glob 推导。
