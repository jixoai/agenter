# app-server SPEC

> 本文档只记录 `@agenter/app-server` 的长期后端职责与公共 contract。

## 1. 组合根职责

- `app-server` 是 AvatarRuntime lifecycle、WorkspaceSystem、attention-derived notification projection 的组合根。
- `app-server` 可以持有 session catalog、runtime lifecycle、tRPC surface 与 projection cache，但不能成为 `message-system` 或 `terminal-system` 的 durable truth owner。
- stopped / cold sessions 的 attention、notification、history inspection 必须回到磁盘事实，而不是依赖残留内存对象。

## 2. AvatarRuntime 与 WorkspaceSystem Contract

- runtime identity 由 Avatar identity 单独决定；`session.id` 就是 canonical AvatarRuntime id。
- `session.workspacePath` 只表达创建时的 bootstrap workspace，不代表 runtime 当前完整 mount 列表。
- `session.create` / `session.start` 的 cold boot 不会自动挂 workspace、room、terminal；这些 authority 必须来自显式 durable facts。
- 每个 runtime 固定拥有一个 principal-address root workspace：`~/.agenter/avatars/by-principal/<principalId>`。它是 avatar 的 canonical private home，不替代 dynamic workspace mounts。
- 前端或其他调用方如果要知道 runtime 当前可访问哪些 workspace，必须查询 `workspace.runtimeMounts(runtimeId)`。
- WorkspaceSystem 是 workspace access 的唯一 authority，负责：
  - mount / detach
  - path-level `ro | rw` grants
  - shared public asset roots
  - avatar-private asset roots
  - non-interactive workspace exec
- root workspace bash 与 workspace bash 必须共享同一套 overlay-rule filesystem authority；ordered glob grants、dynamic rule refresh 与 avatar-private sibling isolation 都在这层执行，不能由上层 route 或 shell surface 各自猜测。
- shell profile law 必须显式区分 fixed `root-workspace` 与 mounted `public-workspace`：`root_bash` 允许 rewrite `HOME` 并携带 avatar-private runtime CLI/env；`workspace_bash` 只保留 public-workspace collaboration semantics，不得继承 root-workspace-exclusive env/CLI。
- Workspace asset roots 分为：
  - public: `<workspace>/.agenter/workspace/{skills,memory,tools,archive}`
  - private: `<workspace>/.agenter/avatars/by-principal/<principalId>/{skills,memory,tools,archive}`
- nickname alias 只用于 discoverability：
  - global: `~/.agenter/avatars/by-nickname/<nickname> -> ../by-principal/<principalId>`
  - workspace: `<workspace>/.agenter/avatars/by-nickname/<nickname> -> ../by-principal/<principalId>`
- Avatar seat credential 也属于 avatar-private workspace state，必须落在对应 avatar-private path，而不是 workspace root settings。

## 3. Attention 与 Notification Contract

- runtime-system boundary law 固定使用五类 durable vocabulary：
  - `WorldFact`：真实发生过的世界事实
  - `CapabilityProjection`：基于 durable facts 派生、可显式查询的投影视图
  - `SchedulerSignal`：wake、focus、score、timer、backoff、idle 这类调度事实
  - `AgentAction`：模型或操作员显式发起的动作
  - `EffectLedger`：显式动作造成的 durable 外部效果
- Message、Terminal、Skill、Watch 以及未来 system 都必须先分类到上述 vocabulary，再进入 shared runtime kernel；`app-server` 不得重新引入 source-specific hidden branches 去解释“这是不是该回复”“这是不是已经完成”。
- running session 的 attention/notification projection 读取 live runtime。
- stopped 或 cold session 的 attention/notification projection 读取 `sessionRoot/attention-system` 下的 persisted facts。
- notification 不是独立 registry；它只是 unconsumed attention push 的投影。
- attention commit 对外必须遵守二分法：`meta` 只暴露 provenance，`summary + change` 承载 AI/inspection 可读主体；可见外部效果必须走显式 system mutation 或 dispatch/receipt 事实，调用方不得再依赖开放 metadata bag。
- `EffectLedger` 是 visible external mutation 的唯一可追责面。至少要能把 `actionId`、`actorId`、`target`、`effectRecordId`、`timestamp` 以及可用时的 `cycle/model-call refs` 串起来；room message creation 这类外部效果不得再通过隐式 fallback 或 transport side channel 解释。
- `notification.snapshot`、`notification.setChatVisibility`、`notification.setTerminalVisibility`、`notification.consume` 都必须遵守同一条法则：有 runtime 读 runtime，无 runtime 读 persisted attention。
- `session.stop` 与 `session.abort` 都必须让 runtime 从 kernel ownership 中消失；`snapshot.runtimes[sessionId]` 对 stopped session 返回空是正确行为，不是数据丢失。

## 4. LoopBus 与 Prompt Assembly Contract

- stopped / cold session 的模型检查、Heartbeat 历史和 prompt reconstruction，必须从 `@agenter/session-system` 的 `message_parts + ai_call` ledger 重建；session-db 不再拥有独立 `session_cycle` / telemetry durable truth。
- `session.db/ai_call` 只保留近轮次的可恢复运行事实；跨轮次、长时间窗口的 token usage 统计必须投影到 avatar-root 下独立的 analytics DB，不能把价格估算或当前 settings 伪装成 durable truth。
- analytics durable truth 只记录客观 token facts（如 input/output/total/cached/reasoning/uncached 以及 provider snapshot）；价格、缓存命中推断和计费估算都属于上层派生视图，不得回写成历史真相。
- runtime Heartbeat inspection 固定读取一条 merged message-parts stream：`scope=heartbeat_part` 持久化 AI-visible request/response 与 compact boundary，`scope=request_aux` 持久化去重后的 `systemPrompt / tools / config`；app-server 必须通过统一 page API 与 realtime event 发布这条流，不能要求客户端再拼 chat / request-aux / model-call 三套时间线。
- session-db 的 reverse page helpers（尤其是 `ai_call` 与 message-head 分页）必须在 SQL 边界先应用 `before + limit`，禁止再出现 `select all -> JS sort/filter/slice` 这类假分页。
- Heartbeat 路由的 cold-start data plane 只允许请求 Heartbeat 自身的 grouped inspection facts 与最小 model-call context；scheduler logs、trace timeline、API call timeline、request-aux raw page、chat transcript 这类重型历史必须保持按需加载，不能再作为 Heartbeat 路由的隐式预取。
- fresh session 的空 prompt window 也必须在 ledger 中拥有可解析的 durable fact；不能只在 `session_head.current_prompt_window_id` 中留下一个没有对应 `message_part` 实体的悬空 id。
- LoopBus transport metadata 只允许表达调度、协议、refs、compact/wake/debug 之类 orchestration facts，不得成为 AI-visible payload 的隐藏通道。
- built-in LoopBus source ref/read result contract 必须保持 protocol-native `src` typed：message namespace 同时支持 room-scope `msg:<chatId>` 与 row-scope `msg:<chatId>/<messageId>`，其中真正可读的 room message source ref 仍使用 row-scope；terminal 用 `tty:<terminalId>/<eventId?>`，task 用 `task:<subjectId>`；不得重新引入 `LoopSourceRef.meta` 或 `LoopSourceReadResult.meta` 这类开放逃逸口。
- source adapter 如果需要给模型更多上下文，必须在 `AttentionDraft.presentation` 或最终 `summary + change` 中补足，而不是把信息塞进 source ref/read result metadata。
- Attention protocol payload 不属于 bounded prompt-window 记忆：`AttentionContexts.metadata` / context snapshot 是边界投影输入，`AttentionItems` 是当前 commit delta 输入；二者可以进入当前 provider request 与 `ai_call.request.messages`，但不得被写入 prompt window 后跨轮 replay。
- compact / cold start 这类边界只能刷新 AttentionContext projection，不能把历史 AttentionItems 重新注入；AI 通过 runtime-local `attention commit` 自己写入的上下文更新也不能再反向唤醒成 item reminder。
- `attentionContextSnapshot` 表示“模型已经见过的 AI-visible context 视图”，不是最新 raw context。`ai-messages` 被 clear 或 compact 清空时，这个 snapshot 也必须同步清空。
- commit attention item 注入固定使用 current-state per-context law：
  - 先按 focus state seed `AttentionContext`
  - 只有 `focused` context 可注入 committed items
  - 对每个 focused context 比较 `AttentionContextUserRoleMessageLength * 1.5` 与 `AttentionItemsUserRoleMessageLength`
  - 可混合选择 context path 与 items path
  - first-wave 不依赖 diff/patch-style context injection
- successful injection boundary 复用 delivery acceptance law：只有当 response stream 已开始且第一个 returned stream event 不是 error 时，runtime 才能推进 `attentionContextSnapshot` 并清理本次真正注入成功的 staged keyed attention items；后续 stream interruption 不回滚这一决定。
- staged `CommitAttentionItems` 必须是 keyed map 语义，而不是 append-only noise；failed request 不得清空 staged keys，successful request 也只能清除本次实际注入的 key。
- `Notify` 是 item-path 例外：它仍然走 serialized attention-item payload，但要 obey 同一套 context seeding law，并服从 queryable quota contract。
- tool-result 边界的 interleaved attention 提交必须走同一个 runtime commit API：`onCanCommitAttentionItems(ctx)` 只能调用 `ctx.commitAttentionItems()` 这类直接接口，不能通过 return payload 绕开 runtime；MessageRoom unread read ack、adapter consume 标记、AttentionSystem commit、projection staging 与 trace/ledger 更新属于同一次提交边界。
- ModelClient 的 provider loop strategy 只允许同步消费已经 staged 的 committed attention projection，并把它追加到下一次 continuation request；它不得直接 drain MessageRoom/Terminal/Task，也不得执行 attention commit 或 read ack。
- message attention body 必须直接携带消息级客观事实与必要附件 facts，不得再默认内联 room social envelope；participants / presence / visibleRooms 这类 room projection 必须通过显式 room snapshot、`message read`、`message query` 等既有 query surface 获取；terminal / task 也必须各自通过自己的 presentation builder 提供足够的 AI-visible detail。
- app-server 不得从 raw room transcript rows 重新推导 message unread truth 或 runtime readiness；它只能消费 `message-system` 提供的 active unread / active-visible projection，并在需要历史分页时另行保持 recalled transcript rows 的历史身份。
- focused terminal source observations 默认只保留为 queryable attention history；terminal idle/focus/unfocus 这类 lifecycle coordination 默认属于 scheduler signal / wake-rank truth，不得再作为 source-authored unresolved debt 直接进入 AI-visible task 语义。
- real-provider backend 验收至少要能证明：同一 session 在 room-visible 交付之后，经过 `session.stop -> kernel cold restart -> session.start` 仍能靠磁盘事实继续工作，而不是依赖残留内存对象。
- 需要真实语义判断的 backend 验收必须通过专用 semantic judge 层完成，而不是在测试里散落 prompt-specific 字符串 hack。
- semantic judge real validation 固定使用 provider id `jixoai/agenter/test`，并通过现有 settings cascade 从 workspace `.agenter/settings.json` 或 `~/.agenter/settings.json` 解析；不得静默回退到 active runtime provider。
- semantic judge 采用双层 contract：底层提供 boolean / span / completion / structured 通用判断原语，并支持 `2~3` 次并行冗余尝试、quorum 收敛与按需 structured fallback；上层 helper 先做 cheap lexical pre-check，再决定是否触发模型调用。
- semantic judge 如果出现 empty / malformed / disagreeing outputs，必须暴露 per-attempt diagnostics；单次低 token judge 的脆弱输出不能直接成为最终验收真相。
- real-AI integration tests 对 meaning-level 行为必须优先使用 semantic-judge-backed checks 或结构化行为提取；只有 deliberate protocol literal 才允许继续使用 exact-string assertions。
- runtime model call 只暴露三个 direct tools：`workspace_list`、`root_bash`、`workspace_bash`。message / workspace / terminal / attention 的操作都必须通过 `root_bash` 中的 runtime-local CLI 命令或 `workspace_bash` 的纯工作区 shell 完成。
- runtime `systemPrompt` 只保留稳定 attention law 与共享身份槽位；runtime-generated `skills.list` 必须通过 attention-backed readonly slot 注入，而不是重新拼回 `systemPrompt`；`SYSTEMS_GUIDE` 一类 provider-owned bootstrap guide 必须保持为空。
- runtime 必须为 root workspace shell 注入 loopback-local API 环境：CLI 通过 runtime-local base URL + avatar private key 访问 attention / message / workspace / terminal contract。private key 就是 runtime identity。
- shared terminal 不是 root-workspace shell：runtime-created 与 recovery-created terminal 默认都保持 real-home collaboration semantics，不得因为 `cwd` 在 avatar root workspace 就注入 root-workspace-exclusive env/CLI。
- `terminal.surface.updated` 的 `catalogChanged` 只允许表达 catalog-facing mutation（如 created/updated/deleted/focus/presence）；terminal `snapshot/status` 这类 live render ticks 必须留在 render/resource 层，不能升级成 browser `terminal.globalList` refetch 信号。
- runtime-local shell/API 必须由共享 tool descriptor registry 驱动：route、description、`inputSchema`、`--help` 和 canonical JSON examples 不能各写一份。
- workspace/root shell privilege 是本项目有意保留的 authority，不属于本轮 pollution cleanup 范围；本轮只清理 Message/Terminal/Skill/Attention 的语义污染，不削弱 `root_bash`、`workspace_bash`、runtime-local API、workspace grants、root-workspace shell world。
- runtime-local terminal contract 固定拆成两个命令：
  - `terminal write` = raw mode，只接收 literal text，并要求调用方自己编码 Enter / control chars
  - `terminal input` = mixed mode，支持 `<key .../>`、`<wait .../>`、`<raw>...</raw>`
- runtime / global terminal `write` / `input` 必须忠实投影 terminal-core 的 pending 结果；如果 pending unit 被拒绝，不得回传伪造的 `written` success。
- runtime / global terminal approval 请求必须把 `requestedInput.mode` 作为 durable fact 持久化；不得再靠 `submit`、`submitKey` 之类旧字段推断真实语义。
- descriptor-backed runtime CLI 是 JSON-only contract：只接受空输入、单个 JSON argv、或 JSON stdin；不再提供 positional / natural-flag façade 兼容。
- runtime-facing prompt / skill / error guidance 必须保持 stateless：当命令参数不匹配时，只能客观说明当前 contract、并引导 AI 使用 `<command> --help` 或 `skill info <skill>` 获取详情；不得暗示“旧语法”“之前的规则”或“记忆残留”。
- runtime built-in skills 必须由 owning package 在 `skills/**/SKILL.md` 中维护，并通过 app-server build step 聚合成 generated catalog；runtime 不得再把这些 built-ins materialize 到 `<rootWorkspace>/skills`。
- runtime skill system 的 durable truth 是可见 skill 的 on-disk files，而不是 prompt glue：shared / global / avatar-private skills 直接读盘；indexed built-in skills 在 source path 存在时也必须优先读当前磁盘文件，generated catalog 只负责 discovery baseline。
- runtime built-in `SKILL.md` 必须保持 concise overview-first，并把 deeper material 下沉到同目录 `references/*.md`；attention-backed runtime skill snapshot 与全局提示必须把 `skills.list -> skill info <skill> -> 只读所需 reference file` 作为 canonical discovery path。
- `ccski.config.json` 是 skill watcher 的唯一扩展入口：默认 live truth 只包含 `SKILL.md + ccski.config.json`，额外 watched files 只能来自 config `files[]` 声明；未声明 sibling file 的 churn 不得升级成 skill change。
- watcher 事件只是 dirtiness hint；runtime 必须在下一次模型输入收集边界重新读盘并按 skill 聚合 attention reminder，空闲时再由 debounce fallback 触发同样的刷新；进程未运行期间发生的 skill 变更通过 `sessionRoot/skill-system/fingerprint-map.json` 的 session-local fingerprint baseline 在启动刷新时补齐 detection。
- runtime skill facade 背后的 catalog discovery、truth snapshot、diff、baseline store、watch dirtiness 与 attention publishing 必须保持正交；同名覆盖与 diff identity 只使用 `skill.name`，不引入 root-qualified identity。
- `skill get-config/set-config` 是受控 metadata surface：它只能暴露 config JSON、path metadata 与 resolved watch targets；built-in `set-config` 只有在 runtime 已拥有对应 package source path 的 workspace `rw` authority 时才允许写入。
- browser-facing skill browsing 必须走 read-only bounded surface，而不是让前端从 `skill.path` 猜 sibling files：`catalog` 只列可见 skill roots，`tree` 只返回单个 skill root 下的 objective files，`preview` 只返回 bounded preview payload。
- app-server 的 skill browser root model 固定分成四类 truth：
  - `shared / builtin / global`：一行一个 visible skill，顺序同时表达最低到更高的 generic inheritance
  - `avatars`：一行一个 avatar + workspace-grouped avatar-private skill roots
  - `Root workspace` 固定来自 global avatar root `skills`
  - 非 root workspace 只来自该 workspace 的 avatar-private `skills`，不使用 `effectivePath` 把 global skills 复制进每个 workspace group
- skill browser preview classification 是 durable server contract：至少显式区分 `directory / text / image / audio / video / pdf / binary / unsupported`，由 server 给出，前端不得自行重猜 preview kind。
- `previewKind` 只表达 renderer kind，不表达 preview shell 所有权：WebUI 可以把所有 kind 都交给统一的 `filePreviewer` 壳层，再在壳层内部按 `text / image / audio / video / pdf / binary / unsupported` 选择具体 renderer。
- 外部事实型任务的人格偏好必须落在 `AGENTER.mdx`：当事实依赖当前世界或外部网络且可能变化时，Avatar 先做简短确认，再通过 shell 或其它可观察工具查证，最后只回复查证后的结果；这里表达的是 general shell-first bias，不得把某个天气/搜索 recipe 写成唯一 workflow。
- runtime shell guidance 必须把 `root_bash` 的 outbound network verification 明确成客观能力边界，而不是在 runtime skills 里塞满固定查询脚本。
- system-owned skill 必须只解释本 system 的义务语义与操作风格，尤其是如何理解和处理该 system 提交的 attention items；例如 message skill 应该教 AI 何时确认、何时回复、何时不要刷屏，而不是代替 terminal / workspace / network 系统承载底层可靠性细节。
- `skill list/info/search` 必须把 visible precedence 固化为 `shared < built-in < global < avatar-private`：`~/.agents/skills` 是最宽泛 baseline，built-in 只覆盖 shared，`~/.agenter/skills` 覆盖 built-in，而 runtime root-workspace 下的 avatar-private `skills` 最终覆盖前面所有同名层。
- real-provider 的外部事实验收必须使用测试专用 Avatar + 专用 `AGENTER.mdx`，并在失败时输出 durable diagnostics：room truth、recent model calls、tool trace，以及 Avatar / prompt source identity。

## 5. Reactive Contract

- auth-private WebUI preference persistence 由独立的 `kv` tRPC plane 提供，不并入 settings graph，也不复用 `runtime.snapshot` / `runtime.events`。
- `kv.snapshot({ keys?, prefix? })` 返回当前 authenticated actor 分区内的匹配条目和 `lastEventId`；`keys` 与 `prefix` 互斥，后端只按 opaque key namespace 过滤。
- `kv.set({ key, value, baseVersion? })` 与 `kv.delete({ key, baseVersion? })` 共享 optimistic concurrency law：`baseVersion` 缺省表示无条件写入，`baseVersion: null` 表示“要求 key 当前不存在”，版本冲突返回最新条目而不是隐式覆盖。
- `kv.set` 对语义等价的 JSON 值必须 no-op：不 bump version，不产生新 event。`kv.delete` 删除缺失 key 必须幂等成功且不产生 event；同一 key 跨 delete / recreate 的 version 仍需保持单调递增。
- `kv.events({ afterEventId?, keys?, prefix? })` 是 actor-private 的独立订阅面，支持从指定 event id 开始 replay；event filter 语义必须与 `snapshot` 保持一致。
- auth-private 的 WebUI create/edit draft 走独立的 `drafts` tRPC plane，而不是塞进 `kv` 或 settings graph。draft resource 拥有稳定 `draftId`、typed `kind/state`、`version`、`createdAt`、`updatedAt` 与显式 delete lifecycle。
- `drafts.create({ kind, state })` 为 authenticated actor mint 一个新的 typed draft resource；`drafts.get({ draftId })` 返回单个资源或 `null`；`drafts.list({ kind?, draftIds? })` 返回当前 actor 分区中的匹配资源与 `lastEventId`。
- `drafts.save({ draftId, kind, state, baseVersion? })` 更新已有 draft resource；它对语义等价 state 必须 no-op；draft 不存在返回 `not_found`，版本不匹配返回 `conflict` 与最新资源。
- `drafts.delete({ draftId, baseVersion? })` 只删除 durable draft resource，不表达 device-local tab close；删除缺失 draft 必须幂等成功且不产生 event。
- `drafts.events({ afterEventId?, kind?, draftIds? })` 是 actor-private draft replay/subscription 面；draft lifecycle 的 live sync 与 resume 一律通过该 plane，而不是通过 runtime snapshot。
- authenticated websocket subscription 必须接受 bearer token 的两条等价入口：标准 `Authorization` header，或 websocket `connectionParams.authorization`。
- browser-facing daemon control plane 默认先走 browser auth boundary：router procedure 必须显式分成 `public`、`auth`、`superadmin` 三类；除登录/bootstrap allowlist 外，浏览器不可再匿名访问 machine-local control plane。
- 匿名 browser allowlist 只允许 auth bootstrap surface：`auth.service`、`auth.challengeStart`、`auth.challengeVerify`、daemon-mediated `auth.autoLogin`、daemon-managed `auth.storeAutoLoginKey`；这些 surface 只返回 bootstrap 所需事实，不再把 raw root private key 暴露给浏览器。
- 浏览器侧的 global message / terminal control plane 必须先通过 authenticated operator 边界，再进入 room/terminal capability 解析；`accessToken` 只表达 room/terminal seat capability，不能充当匿名浏览器身份。
- browser-facing asset HTTP transport 必须服从同一 auth law：session asset upload/download 需要 superadmin browser auth，room asset upload/download 需要 authenticated browser auth；media GET 允许 `Authorization` bearer 或 browser-safe `authToken` query，用于 image/video/link surface 渲染，但不能恢复匿名访问。
- `runtime.attention` 是运行态 attention 投影事件，不保证 stopped session 仍然持续发事件。
- `notification.updated` 是 shell unread/projection 事件；它可以由 runtime attention 更新触发，也可以由 stopped-session persisted mutation 触发。
- `session.updated` 进入 `stopped` 后，消费者必须接受：
  - `runtimes[sessionId]` 被移除
  - notification 仍然存在
  - attention 仍然可以通过 query API 读取
- workspace mounts / grants 当前以 query + mutation contract 为主；调用 `grantRuntime`、`detachRuntime`、`session.create/start` 后，调用方应主动刷新 mount/grant 视图。
- `grantRuntime` 是公开的 workspace attach + grant mutation；`session.create/start` 只负责 runtime lifecycle，不负责隐式资源注入。

## 6. Auth Authority Discovery Contract

- `app-server` 在没有显式 `authService.endpoint` 时，必须先按目标 auth-service authority root 读取 runtime descriptor，再决定是否启动 child runtime
- 只有当 descriptor 指向的 endpoint 经过健康探测仍然可用时，`app-server` 才能把该 authority 视为可复用 single writer
- 若 child runtime 启动期间遭遇 single-writer 竞争，而同 authority root 此时已出现健康 descriptor，`app-server` 必须回退到 descriptor 复用，而不是让整个 boot 因“已存在 writer”失败
- 自动复用到的本地 auth-service 在语义上等价于 external authority：`app-server` 不拥有其生命周期，也不得暴露 root-auth private key reveal 能力
