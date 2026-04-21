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
- Workspace asset roots 分为：
  - public: `<workspace>/.agenter/workspace/{skills,memory,tools,archive}`
  - private: `<workspace>/.agenter/avatars/by-principal/<principalId>/{skills,memory,tools,archive}`
- nickname alias 只用于 discoverability：
  - global: `~/.agenter/avatars/by-nickname/<nickname> -> ../by-principal/<principalId>`
  - workspace: `<workspace>/.agenter/avatars/by-nickname/<nickname> -> ../by-principal/<principalId>`
- Avatar seat credential 也属于 avatar-private workspace state，必须落在对应 avatar-private path，而不是 workspace root settings。

## 3. Attention 与 Notification Contract

- running session 的 attention/notification projection 读取 live runtime。
- stopped 或 cold session 的 attention/notification projection 读取 `sessionRoot/attention-system` 下的 persisted facts。
- notification 不是独立 registry；它只是 unconsumed attention push 的投影。
- attention commit 对外必须遵守三分法：`meta` 只暴露 provenance，`summary + change` 承载 AI/inspection 可读主体，`egress` 承载 typed routing intent；调用方不得再依赖开放 metadata bag。
- `notification.snapshot`、`notification.setChatVisibility`、`notification.setTerminalVisibility`、`notification.consume` 都必须遵守同一条法则：有 runtime 读 runtime，无 runtime 读 persisted attention。
- `session.stop` 与 `session.abort` 都必须让 runtime 从 kernel ownership 中消失；`snapshot.runtimes[sessionId]` 对 stopped session 返回空是正确行为，不是数据丢失。

## 4. LoopBus 与 Prompt Assembly Contract

- stopped / cold session 的模型检查、Heartbeat 历史和 prompt reconstruction，必须从 `@agenter/session-system` 的 `message_parts + ai_call` ledger 重建；session-db 不再拥有独立 `session_cycle` / telemetry durable truth。
- `session.db/ai_call` 只保留近轮次的可恢复运行事实；跨轮次、长时间窗口的 token usage 统计必须投影到 avatar-root 下独立的 analytics DB，不能把价格估算或当前 settings 伪装成 durable truth。
- analytics durable truth 只记录客观 token facts（如 input/output/total/cached/reasoning/uncached 以及 provider snapshot）；价格、缓存命中推断和计费估算都属于上层派生视图，不得回写成历史真相。
- runtime Heartbeat inspection 固定读取一条 merged message-parts stream：`scope=heartbeat_part` 持久化 AI-visible request/response 与 compact boundary，`scope=request_aux` 持久化去重后的 `systemPrompt / tools / config`；app-server 必须通过统一 page API 与 realtime event 发布这条流，不能要求客户端再拼 chat / request-aux / model-call 三套时间线。
- fresh session 的空 prompt window 也必须在 ledger 中拥有可解析的 durable fact；不能只在 `session_head.current_prompt_window_id` 中留下一个没有对应 `message_part` 实体的悬空 id。
- LoopBus transport metadata 只允许表达调度、协议、refs、compact/wake/debug 之类 orchestration facts，不得成为 AI-visible payload 的隐藏通道。
- built-in LoopBus source ref/read result contract 必须保持 protocol-native `src` typed：message namespace 同时支持 room-scope `msg:<chatId>` 与 row-scope `msg:<chatId>/<messageId>`，其中真正可读的 room message source ref 仍使用 row-scope；terminal 用 `tty:<terminalId>/<eventId?>`，task 用 `task:<subjectId>`；不得重新引入 `LoopSourceRef.meta` 或 `LoopSourceReadResult.meta` 这类开放逃逸口。
- source adapter 如果需要给模型更多上下文，必须在 `AttentionDraft.presentation` 或最终 `summary + change` 中补足，而不是把信息塞进 source ref/read result metadata。
- message attention body 必须直接携带 room social envelope、latest-message perspective、以及附件 facts；terminal / task 也必须各自通过自己的 presentation builder 提供足够的 AI-visible detail。
- focused terminal source observations 默认只保留为 queryable attention history；只有显式 scored 的 terminal event（例如 background `terminal_idle_ready`）才继续形成 unresolved debt。
- real-provider backend 验收至少要能证明：同一 session 在 room-visible 交付之后，经过 `session.stop -> kernel cold restart -> session.start` 仍能靠磁盘事实继续工作，而不是依赖残留内存对象。
- 需要真实语义判断的 backend 验收必须通过专用 semantic judge 层完成，而不是在测试里散落 prompt-specific 字符串 hack。
- semantic judge real validation 固定使用 provider id `jixoai/agenter/test`，并通过现有 settings cascade 从 workspace `.agenter/settings.json` 或 `~/.agenter/settings.json` 解析；不得静默回退到 active runtime provider。
- semantic judge 采用双层 contract：底层提供 boolean / span / completion / structured 通用判断原语，并支持 `2~3` 次并行冗余尝试、quorum 收敛与按需 structured fallback；上层 helper 先做 cheap lexical pre-check，再决定是否触发模型调用。
- semantic judge 如果出现 empty / malformed / disagreeing outputs，必须暴露 per-attempt diagnostics；单次低 token judge 的脆弱输出不能直接成为最终验收真相。
- real-AI integration tests 对 meaning-level 行为必须优先使用 semantic-judge-backed checks 或结构化行为提取；只有 deliberate protocol literal 才允许继续使用 exact-string assertions。
- runtime model call 只暴露两个 direct tools：`root_workspace_list` 与 `root_workspace_bash`。message / workspace / terminal / attention 的操作都必须通过 root workspace shell 中的 CLI 命令完成。
- runtime `systemPrompt` 只保留稳定 attention law 与共享身份槽位；runtime-generated `skills.list` 必须通过 attention-backed readonly slot 注入，而不是重新拼回 `systemPrompt`；`SYSTEMS_GUIDE` 一类 provider-owned bootstrap guide 必须保持为空。
- runtime 必须为 root workspace shell 注入 loopback-local API 环境：CLI 通过 runtime-local base URL + avatar private key 访问 attention / message / workspace / terminal contract。private key 就是 runtime identity。
- runtime-local shell/API 必须由共享 tool descriptor registry 驱动：route、description、`inputSchema`、`--help` 和 canonical JSON examples 不能各写一份。
- descriptor-backed runtime CLI 是 JSON-only contract：只接受空输入、单个 JSON argv、或 JSON stdin；不再提供 positional / natural-flag façade 兼容。
- runtime-facing prompt / skill / error guidance 必须保持 stateless：当命令参数不匹配时，只能客观说明当前 contract、并引导 AI 使用 `<command> --help` 或 `skill info <skill>` 获取详情；不得暗示“旧语法”“之前的规则”或“记忆残留”。
- runtime built-in skills 必须由 owning package 在 `skills/**/SKILL.md` 中维护，并通过 app-server build step 聚合成 generated catalog；runtime 不得再把这些 built-ins materialize 到 `<rootWorkspace>/skills`。
- runtime skill system 的 durable truth 是可见 skill 的 on-disk files，而不是 prompt glue：shared / global / avatar skills 直接读盘；indexed built-in skills 在 source path 存在时也必须优先读当前磁盘文件，generated catalog 只负责 discovery baseline。
- runtime built-in `SKILL.md` 必须保持 concise overview-first，并把 deeper material 下沉到同目录 `references/*.md`；attention-backed runtime skill snapshot 与全局提示必须把 `skills.list -> skill info <skill> -> 只读所需 reference file` 作为 canonical discovery path。
- `ccski.config.json` 是 skill watcher 的唯一扩展入口：默认 live truth 只包含 `SKILL.md + ccski.config.json`，额外 watched files 只能来自 config `files[]` 声明；未声明 sibling file 的 churn 不得升级成 skill change。
- watcher 事件只是 dirtiness hint；runtime 必须在下一次模型输入收集边界重新读盘并按 skill 聚合 attention reminder，空闲时再由 debounce fallback 触发同样的刷新。
- `skill get-config/set-config` 是受控 metadata surface：它只能暴露 config JSON、path metadata 与 resolved watch targets；built-in `set-config` 只有在 runtime 已拥有对应 package source path 的 workspace `rw` authority 时才允许写入。
- 外部事实型任务的人格偏好必须落在 `AGENTER.mdx`：当事实依赖当前世界或外部网络且可能变化时，Avatar 先做简短确认，再通过 shell 或其它可观察工具查证，最后只回复查证后的结果；这里表达的是 general shell-first bias，不得把某个天气/搜索 recipe 写成唯一 workflow。
- runtime shell guidance 必须把 `root_workspace_bash` 的 outbound network verification 明确成客观能力边界，而不是在 runtime skills 里塞满固定查询脚本。
- system-owned skill 必须只解释本 system 的义务语义与操作风格，尤其是如何理解和处理该 system 提交的 attention items；例如 message skill 应该教 AI 何时确认、何时回复、何时不要刷屏，而不是代替 terminal / workspace / network 系统承载底层可靠性细节。
- `skill list/info/search` 必须把 built-in catalog 视为最低优先级 baseline，再叠加 `~/.agents/skills`、`~/.agenter/skills`、`<rootWorkspace>/skills` 的 on-disk skills；同名时由 on-disk skill 覆盖 built-in。
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
