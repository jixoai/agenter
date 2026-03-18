# Agenter SPEC

> 本文档是当前仓库的项目级唯一可信源（source of truth）。
> 包级细节以对应包内文档为准（如 `packages/terminal-system/SPEC.md`）。

## 0. 文档信息

- 状态：Active
- 仓库：`agenter`（monorepo）
- 语言：TypeScript（强类型优先，默认禁止 `any` / `as any` / `@ts-nocheck`）
- 运行时：Bun

---

## 1. 项目定位

Agenter 是一个“**终端驱动的 Agent 运行系统**”，核心目标是：

1. 用通用终端内核稳定运行任意 Agent-CLI（iflow/codex/claude-code/opencode 等）。
2. 把终端状态与变化落盘为 AI 可消费的 HTML 文件链。
3. 用 LoopBus 驱动 `chat + terminal` 的持续循环，让 AI 在多轮中推进任务。
4. 用可配置提示词与多语言包控制系统行为，而不是在代码中硬编码某个 CLI 语义。

非目标（当前阶段）：

- 不引入 JSONOP 作为主协议（当前以 terminal html + git diff 为主）。
- 不做过度未来化抽象（遵循 YAGNI）。

---

## 2. Monorepo 结构与职责边界

```txt
agenter/
  SPEC.md
  demo/
  packages/
    terminal-system/ # @agenter/terminal-system
    avatar/         # @agenter/avatar
    settings/       # @agenter/settings
    mdx2md/         # @agenter/mdx2md
    attention-system/    # @agenter/attention-system
    task-system/    # @agenter/task-system
    app-server/     # @agenter/app-server
    client-sdk/     # @agenter/client-sdk
    cli/            # @agenter/cli
    tui/            # @agenter/tui
    webui/          # @agenter/webui
    i18n-core/      # @agenter/i18n-core
    i18n-en/        # @agenter/i18n-en
    i18n-zh-Hans/   # @agenter/i18n-zh-hans
```

### 2.1 `@agenter/terminal-system`

- 负责 PTY 生命周期、`@xterm/headless` 渲染、日志文件链落盘、dirty slice、mixed input 队列。
- 提供 `ati` CLI：`ati [options] [command] [args]`。
- 详细规范以 `packages/terminal-system/SPEC.md` 为准。

### 2.2 `@agenter/settings`

- 负责 settings 聚合与统一资源加载。
- 支持多 source 混合：`user/project/local`、路径、URI。
- 提供统一 `ResourceLoader`，支持 alias + protocol 扩展（file/http/https + future protocols）。
- 在每个 settings layer 上叠加 avatar settings（`a->s`）：先 avatar/source，再该 source 的 settings。

### 2.3 `@agenter/avatar`

- 负责化身（Avatar）解析：`nickname + sources:Array<{name,path}>`。
- Avatar 是 SettingsAlias，不是运行实例。
- 默认 sources：`~/.agenter/avatar/<nickname>` 与 `<projectRoot>/.agenter/avatar/<nickname>`（后者覆盖前者）。
- 提供 Avatar 文档路径解析（`AGENTER.mdx` / `AGENTER_SYSTEM.mdx` / `SYSTEM_TEMPLATE.mdx` / `RESPONSE_CONTRACT.mdx`）。

### 2.4 `@agenter/mdx2md`

- 负责 MDX -> Markdown 安全转换（不经 HTML）。
- 提供策略：标签处理、表达式策略、可扩展自定义标签 transform。

### 2.5 `@agenter/i18n-*`

- `i18n-en` / `i18n-zh-hans`：提示词语言包（`prompts/*.mdx|md` 为源）。
- `i18n-core`：通用语言包加载与构建能力。
- 默认语言包：`en`（runtime 内置 fallback）。

### 2.6 `@agenter/attention-system`

- 负责“对话辅助状态”的独立存储与查询，不与任务系统耦合。
- 核心记录结构：`{ id, content, from, score, remark, createdAt, updatedAt }`。
- `score` 为 0-100 整数；`score=0` 表示退出当前注意力列表。
- 自动 `attention_add` 仅对用户输入触发；assistant/tool 不自动进入注意力列表。
- 持久化独立于 `session.json`（会话调用日志），使用单目录存储。
- 兼容迁移：若会话目录存在 legacy `chat-system/` 且不存在 `attention-system/`，runtime 启动时自动迁移目录。

### 2.7 `@agenter/app-server`

- 负责 AgentRuntime + LoopBus + AgenterAI 编排。
- 运行时基于 `Session`（可并发、可恢复），不再使用 `instances.json`。
- 输入源：chat message + terminal diff/snapshot/help + attention-system facts。
- 输出分流：`to_user(attention_reply)` / `self_talk(model text/thinking)` / `tool_call` / `tool_result`。
- 与模型交互通过 `@tanstack/ai` 工具体系组织。
- 对外通过 tRPC router 暴露 session/chat/settings/runtime 能力（传输层为 ws）。

### 2.8 `@agenter/client-sdk`

- 负责 UI 侧统一通信与状态模型（tRPC wsLink + Snapshot/Event 流）。
- 封装 runtime store，供 `@agenter/tui` 与 `@agenter/webui` 复用。
- 连接断开时自动重连（指数退避），恢复后重新拉取 snapshot 并续订 events。

### 2.9 `demo`

- 可运行实验与联调入口（OpenTUI）。
- 消费 `@agenter/*` 包，不应复制核心逻辑。
- 重点用于验证循环行为、提示词、终端交互、日志可观测性。

### 2.10 `@agenter/cli`

- 统一用户入口命令：`agenter daemon|tui|web|doctor`
- `web` 模式负责托管 `assets/webui` 静态资源并提供同域 `/trpc` 实时接口
- `daemon` 模式仅启动内核服务（无前端托管）

### 2.11 `@agenter/tui`

- 基于 OpenTUI 的正式客户端
- 通过 `@agenter/client-sdk` 连接 app-server（tRPC wsLink）
- 支持多会话列表、会话切换、chat 同步与状态展示

### 2.12 `@agenter/webui`

- 正式 Web 客户端（React + Vite，移动端优先）
- UI 基于 `shadcn/ui` + Tailwind CSS v4 组件体系
- 通过 `@agenter/client-sdk` 同步 chat/runtime/terminal 事件
- 提供 settings/prompts 读写与冲突提示（mtime 乐观并发）
- Application 化壳层：Sidebar + Dialog + Quick Start（workspace + 首条消息）
- 会话列表默认 Recent 8，可切换全量；支持全局快捷键（如 `Ctrl/Cmd+N`）

---

## 3. 运行时主流程（LoopBus）

系统按循环总线工作：

1. 收集输入队列（用户输入 + 终端变化消息 + task 变化）。
2. 发送给 `AgenterAI.send(messages)`。
3. AI 返回结构化 outputs：
   - `toUser`：发给用户的正式回复（仅由 `attention_reply` 工具生成）
   - `toTerminal`：终端写入动作
   - `toTools`：工具调用
4. 工具调用结果重新入队，继续下一轮循环。
5. terminal dirty 通过 `sliceDirty(remark=true)` 持续推进上下文。
6. 若本轮无 task 输入、无 terminal diff，但 attention-system 仍有注意力记录，则注入 `attention-system` 事实输入触发 AI 继续决策。

任务系统（Task System）并行接入 LoopBus：

- 任务源通过配置 `tasks.sources: Array<{name,path}>` 提供（按数组顺序混合读取）。
- `path` 支持绝对路径、`~/`、相对路径（相对 `agentCwd`）。
- runtime 轮询任务源和事件 inbox（`events/pending/*.json`），把可执行任务变化注入 LoopBus（`source:"task"`）。
- AI 通过 `task_*` 工具维护内存任务图（DAG 依赖、触发器、状态推进），并由 runtime 持久化回 Markdown。

终端焦点语义（当前默认）：

- 支持多个 focused terminal；每个 focused terminal 都会独立作为一段 terminal input 注入 LoopBus。
- focused terminal 的变更由 runtime 自动消费；内部使用 `sliceDirty({ remark: true })`，对外工具名统一为 `terminal_consumeDiff`。
- unfocused terminal 只保留 dirty 状态，不主动注入 summary，避免无效 AI 调用。
- terminal BUSY 时仅累计 dirty；进入 IDLE 后再进行一次差异采集。

关键约束：

- LoopBus 是持续循环，不依赖用户每轮手动触发。
- LoopBus 基于 `Promise.race(waitCommitted(...))` 等待输入；任一输入 resolved 后，必须再等待固定 `loopWaitMs=300ms` 再 collect，以吸收临近变更。
- LoopBus phase 固定为：`waiting_commits -> settling_inputs -> collecting_inputs -> persisting_cycle -> calling_model -> applying_outputs`。
- wait losers 必须 reject/cancel，避免 waiter 泄漏。
- terminal 变化默认视为 user-source context（不是 assistant 自述）。
- 没有 pending task、没有 terminal diff/attention-system facts/chat 输入时，不触发 AI API 调用，只在 LoopBus 空转等待下一次触发。
- 消息结构必须紧凑，便于模型持续消费与回放。
- 用户发送 `/compact` 时，runtime 会强制请求下一轮上下文压缩（不写入 attention-system 注意力列表）。

### 3.1 Attention-System 工具契约

- `attention_list() -> Array<{id, content, from, score, remark, updatedAt}>`
  - 仅返回 `score>0` 的当前注意力列表。
- `attention_add({content, from, score?}) -> {id}`
  - 默认 `score=100`。
- `attention_remark({id, remark, score?}) -> {ok}`
  - 可同时修改备注与注意力。
- `attention_query({offset?, limit?, query?}) -> Array<{id, content, from, score, remark, updatedAt}>`
  - 支持关键词查询历史记录。
- `attention_reply({replyContent, relationships?}) -> {ok, id}`
  - 发送用户可见回复并写入 attention-system；
  - `relationships` 可批量调整关联记录注意力（0 表示移出注意力列表）。

### 3.2 LoopBus Kernel 持久化（`session.db`）

- 每个 session root 必须创建 `session.db`，只用于 **LoopBus 内核级事实持久化**，不接管 task/attention/terminal 各自的独立存储。
- `session.db` 只存事实，不存可推导快照；projection 由 server 侧按需构建。
- 核心表：
  - `session_head`：当前 branch head。
  - `session_cycle`：每轮循环 ledger（`prev_cycle_id`、`wake`、`collected_inputs`、`extends`、`result`）。
  - `model_call`：一次语义模型调用。
  - `session_block`：chat 面板块（`user_input` / `to_user` / `self_talk` / `tool_call` / `tool_result`）。
  - `loopbus_trace`：LoopBus trace（按 cycle + seq 记录步骤）。
  - `api_call`：按需开启的原始 HTTP request/response/error 录制。
- `session_cycle.collected_inputs` 是“本轮到底收集了什么”的单一可信源；provider request body 仍然只放在 `model_call.request` / `api_call.request`。
- `session_block.content` 必须保存原始消息内容（通常为 Markdown），不得写入 UI 派生标题、视觉标签或 HTML 投影。
- `session_block.channel` 只表达语义通道；`self_talk` / `to_user` / `tool_*` 的视觉表现属于 projection 层，不回写事实层。
- preview/raw 等展示模式属于前端 projection 契约，不进入 `session.db` 真源。
- rollback 的 branch 通过 `session_head` + `session_cycle.prev_cycle_id` 表达；`CycleView` 属于 projection，不单独落库。

### 3.3 API 调用录制开关（订阅引用计数）

- API 调用录制默认关闭，避免大体积持久化。
- 通过 `runtime.apiCalls` subscription 按 session 打开录制：
  - 订阅建立：`refCount + 1`，启用录制；
  - 订阅关闭：`refCount - 1`，`refCount=0` 时自动关闭；
  - 支持多页面并发订阅（引用计数）。
- 录制内容必须保留完整 request/response body 与错误对象，便于离线回放与问题排查。

---

## 4. 提示词与配置体系

### 4.1 配置来源

- 默认 source：`["user", "project", "local"]`
  - `user` -> `~/.agenter/settings.json`
  - `project` -> `.agenter/settings.json`
  - `local` -> `.agenter/settings.local.json`
- 支持路径与 URI source（`./` `../` `/` `~/` `file:` `http:` `https:`）。
- `avatar`：当前激活化身昵称（可被 CLI `--avatar` 临时覆盖）。
- `sessionStoreTarget`：会话存储目标（`global | workspace`，默认 `global`）。
- 合并语义：`user(a->s) -> project(a->s) -> local(a->s)`（后者覆盖前者）。

任务系统源配置：

- `tasks.sources` 使用统一数组配置：`[{ name, path }]`。
- 未配置时默认：
  - `{name:"user", path:"~/.agenter/tasks"}`
  - `{name:"workspace", path:".agenter/tasks"}`
- runtime 按顺序遍历 sources，并混合读取所有 Markdown 任务文件与事件 inbox。

### 4.1.1 AI Provider 配置

- `ai.activeProvider`：当前激活 provider id。
- `ai.providers`：provider map（支持多供应商并行配置）。
- provider `kind` 支持：
  - `openai`
  - `anthropic`
  - `gemini`
  - `grok`
  - `ollama`
  - `openai-compatible`
  - `anthropic-compatible`
- provider 字段：
  - `model`
  - `apiKey` / `apiKeyEnv`
  - `baseUrl`
  - `temperature`
  - `maxRetries`
  - `maxToken`
  - `compactThreshold`

### 4.2 提示词分层

- 用户层：`AGENTER.mdx`（可空，用户自由扩展）。
- 系统层：语言包内置 `AGENTER_SYSTEM` / `SYSTEM_TEMPLATE` / `RESPONSE_CONTRACT`。
- CLI 帮助：通过 `terminal_run` 返回 `doc:{syntax,content}` + manuals，支持 `<CliHelp command="..."/>`。

### 4.3 运行特性配置（`features.*`）

- 废弃 `internal.*` 配置层，统一使用 `features.*`。
- 首个落地域：`features.terminal`
  - `bootTerminals: Array<string | { id, focus?, autoRun? }>`
- `terminal_list` 输出包含 `focused/dirty/latestSeq`，并支持 `terminal_focus` 增删当前 focus 集合。

### 4.4 语言包策略

- `settings.lang` 指定语言；非法值回退到 `en`。
- dev 模式：从 workspace `packages/i18n-*/prompts/` 读取源文件。
- prod 模式：按版本下载语言包到 `~/.agenter/i18n/<lang>@<version>/`（设计目标，逐步落地）。

### 4.5 Avatar + Session 持久化

- app-server 维护 `Session` 列表（每个 Session 绑定一个 Avatar）。
- 不再使用 `~/.agenter/instances.json`。
- 全局工作区记录文件：`~/.agenter/workspaces.yaml`（记录所有通过 agenter 打开的 cwd）。
  - 多进程写入策略：`*.lock` 文件锁 + `tmp -> rename` 原子替换，避免并发覆盖与部分写入。
- 会话目录：
  - `sessionStoreTarget=global` -> `~/.agenter/sessions/<sessionId>`
  - `sessionStoreTarget=workspace` -> `<projectRoot>/.agenter/avatar/<nickname>/sessions/<sessionId>`
- 每个会话目录包含 `session.json` 与 `logs/terminals/*`。
- 每个会话目录还包含 `attention-system/*`（独立于 `session.json` 的对话注意力存储）。
- 默认策略：
  - 单守护进程
  - UI 与 daemon 使用 tRPC + wsLink 同步（全双工）
  - runtime events 支持 backlog replay（基于 `afterEventId` 续传）
  - Web 默认绑定 `127.0.0.1`
  - workspace 与目录浏览通过 tRPC 提供：`workspace.recent` / `fs.listDirectories` / `fs.validateDirectory`

### 4.6 自动压缩策略

- 仅在模型返回 `usage.promptTokens` 时触发自动压缩。
- 阈值计算：`promptTokens >= floor(maxToken * compactThreshold)`。
- 若 provider 未返回 usage，则不自动压缩，仅允许手动 compact。

---

## 5. Terminal 数据契约（项目级）

项目统一依赖 `@agenter/terminal-system` 输出目录作为“单一信源”：

- `output/latest.log.html` + `pre-file` 链。
- `input/pending -> done/failed` mixed input 工作流。
- `debug/*.ndjson` 关键事件日志。
- 可选 git 历史（`--git-log=none|normal|verbose`）辅助变更追溯。

项目级约束：

- demo/app-server 不重复实现 terminal 解析内核。
- 与 terminal 的交互优先走包接口（如 `sliceDirty/markDirty/enqueuePendingInput/readOutput`）。

---

## 6. 质量标准与工程原则

### 6.1 KISS

- 保持包职责单一：terminal / settings / mdx2md / app-server 解耦。
- demo 只做组合层，不把核心算法写进 UI。

### 6.2 YAGNI

- 不提前实现未验证的高级协议。
- 先保证 loop + terminal 链路稳定，再扩展更多终端和 UI。

### 6.3 SOLID

- 依赖抽象接口（terminal gateway、prompt store、resource loader）。
- 工具调用、消息建模、提示词构建彼此独立可替换。

### 6.4 DRY

- ResourceLoader 统一处理所有文件/URI读取。
- prompt 统一走 `PromptDocument (mdx|md)` + `buildMd(...)`。
- terminal 结构化结果统一作为 rich/plain 转录来源。

---

## 7. 测试策略（当前）

测试方法论统一为 **BDD-first**（行为驱动优先），TDD（红-绿-重构）作为场景落地手段：

- 先定义 Feature/Scenario，再写实现。
- 测试命名使用 Given/When/Then，确保“测试即验收文档”。
- 仅保留高价值用例：跨边界链路、稳定契约、关键行为。

统一使用 Bun 测试体系，按价值分层：

- `@agenter/terminal-system`：核心协议与终端行为（CLI 解析、渲染、分页链、dirty slice、git-log、integration）。
- `@agenter/mdx2md`：安全策略与 transform 契约。
- `@agenter/demo`：组合层行为（runtime config、loop bus、prompt store、dispatcher）。
- `@agenter/app-server`：runtime/tRPC 协议行为 + e2e（daemon health/lifecycle/web root）。
- `@agenter/client-sdk`：通信封装与状态层回归测试。
- `@agenter/cli`：黑盒 e2e（`daemon/web/doctor` 主链路）。
- `@agenter/tui`：高价值可观察逻辑（view-model 映射与状态展示）。
- `@agenter/webui`：Vitest 组件测试 + Playwright e2e 入口。
- `@agenter/settings`：source 合并、路径归一化、ResourceLoader 协议/alias。

基线命令：

```bash
bun run test
```

---

## 8. 里程碑与下一步

### M1（已在进行）

- 稳定 `terminal + app-server + demo` 闭环。
- 提示词与工具调用策略可控。

### M2（已落地基础版本，持续迭代）

- 已引入 `@agenter/cli`、`@agenter/tui`、`@agenter/webui` 正式包。
- `@agenter/app-server` 已提供 daemon + 多会话聚合 + tRPC/ws 实时同步。
- TUI/WebUI 已共享同一后端并支持实例列表与 chat 同步。
- WebUI 已升级为 Vite 工程并支持 settings/prompts 读取与保存（含 mtime 冲突返回）。
- app-server 已接入任务引擎基础能力（task DAG、manual/event/time 触发、Markdown 导入导出、task\_\* 工具）。
- 后续重点：收敛 demo 逻辑并进一步提升 TUI/WebUI 交互质量。

### M3（后续）

- 在 `@agenter/app-server` 之上实现标准化 TUI/WebUI 客户端。
- 扩展多 terminal 并发场景的策略与观测。

---

## 9. 变更纪律

1. 功能改动优先补测试，再改实现。
2. 发生行为变化必须同步更新本 `SPEC.md`（项目级）或包级 SPEC。
3. 禁止在 core 代码中硬编码具体 CLI 语义（iflow/codex 等应由 settings + prompt 决定）。
