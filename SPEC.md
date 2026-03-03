# Agenter SPEC

> 本文档是当前仓库的项目级唯一可信源（source of truth）。
> 包级细节以对应包内文档为准（如 `packages/terminal/SPEC.md`）。

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
    terminal/       # @agenter/terminal
    settings/       # @agenter/settings
    mdx2md/         # @agenter/mdx2md
    app-server/     # @agenter/app-server
    cli/            # @agenter/cli
    tui/            # @agenter/tui
    webui/          # @agenter/webui
    i18n-core/      # @agenter/i18n-core
    i18n-en/        # @agenter/i18n-en
    i18n-zh-Hans/   # @agenter/i18n-zh-hans
```

### 2.1 `@agenter/terminal`

- 负责 PTY 生命周期、`@xterm/headless` 渲染、日志文件链落盘、dirty slice、mixed input 队列。
- 提供 `ati` CLI：`ati [options] [command] [args]`。
- 详细规范以 `packages/terminal/SPEC.md` 为准。

### 2.2 `@agenter/settings`

- 负责 settings 聚合与统一资源加载。
- 支持多 source 混合：`user/project/local`、路径、URI。
- 提供统一 `ResourceLoader`，支持 alias + protocol 扩展（file/http/https + future protocols）。

### 2.3 `@agenter/mdx2md`

- 负责 MDX -> Markdown 安全转换（不经 HTML）。
- 提供策略：标签处理、表达式策略、可扩展自定义标签 transform。

### 2.4 `@agenter/i18n-*`

- `i18n-en` / `i18n-zh-hans`：提示词语言包（`prompts/*.mdx|md` 为源）。
- `i18n-core`：通用语言包加载与构建能力。
- 默认语言包：`en`（runtime 内置 fallback）。

### 2.5 `@agenter/app-server`

- 负责 AgentRuntime + LoopBus + AgenterAI 编排。
- 输入源：chat message + terminal diff/snapshot/help。
- 输出分流：`to_user` / `self_talk` / `tool_call` / `tool_result`。
- 与模型交互通过 `@tanstack/ai` 工具体系组织。

### 2.6 `demo`

- 可运行实验与联调入口（OpenTUI）。
- 消费 `@agenter/*` 包，不应复制核心逻辑。
- 重点用于验证循环行为、提示词、终端交互、日志可观测性。

### 2.7 `@agenter/cli`

- 统一用户入口命令：`agenter daemon|tui|web|doctor`
- 负责拉起守护进程、连接 TUI 客户端、暴露 WebUI 入口
- `tui`/`web` 共享同一个 app-server 守护进程

### 2.8 `@agenter/tui`

- 基于 OpenTUI 的正式客户端
- 通过 WebSocket 连接 app-server
- 支持多实例列表、实例切换、chat 同步与状态展示

### 2.9 `@agenter/webui`

- 正式 Web 客户端（移动端优先）
- 通过 WebSocket 连接 app-server，同步 chat/runtime/terminal 事件
- 提供 settings/prompts 读写与冲突提示（mtime 乐观并发）

---

## 3. 运行时主流程（LoopBus）

系统按循环总线工作：

1. 收集输入队列（用户输入 + 终端变化消息）。
2. 发送给 `AgenterAI.send(messages)`。
3. AI 返回结构化 outputs：
   - `toUser`：发给用户的正式回复
   - `toTerminal`：终端写入动作
   - `toTools`：工具调用
4. 工具调用结果重新入队，继续下一轮循环。
5. terminal dirty 通过 `sliceDirty(remark=true)` 持续推进上下文。

终端焦点语义（当前默认）：

- 仅一个 focused terminal（`focusMode=exclusive`）。
- focused terminal 的 diff 由 LoopBus 自动注入。
- unfocused terminal 仅注入 dirty summary，AI 如需细节可主动 `terminal_sliceDirty`。
- 对 focused terminal 调用 `terminal_sliceDirty` 返回 `ignored=true`，避免重复消费同一变更。

关键约束：

- LoopBus 是持续循环，不依赖用户每轮手动触发。
- terminal 变化默认视为 user-source context（不是 assistant 自述）。
- 消息结构必须紧凑，便于模型持续消费与回放。

---

## 4. 提示词与配置体系

### 4.1 配置来源

- 默认 source：`["user", "project", "local"]`
  - `user` -> `~/.agenter/settings.json`
  - `project` -> `.agenter/settings.json`
  - `local` -> `.agenter/settings.local.json`
- 支持路径与 URI source（`./` `../` `/` `~/` `file:` `http:` `https:`）。

### 4.2 提示词分层

- 用户层：`AGENTER.mdx`（可空，用户自由扩展）。
- 系统层：语言包内置 `AGENTER_SYSTEM` / `SYSTEM_TEMPLATE` / `RESPONSE_CONTRACT`。
- CLI 帮助：通过 `terminal_run` 返回 `doc:{syntax,content}` + manuals，支持 `<CliHelp command="..."/>`。

### 4.3 运行特性配置（`features.*`）

- 废弃 `internal.*` 配置层，统一使用 `features.*`。
- 首个落地域：`features.terminal`
  - `bootTerminals: Array<string | { id, focus?, autoRun? }>`
  - `focusMode: "exclusive"`（当前实现）
  - `unfocusedSignal: "summary"`（当前实现）
- `terminal_list` 输出包含 `focused/dirty/latestSeq`，并支持 `terminal_focus` 切换焦点。

### 4.4 语言包策略

- `settings.lang` 指定语言；非法值回退到 `en`。
- dev 模式：从 workspace `packages/i18n-*/prompts/` 读取源文件。
- prod 模式：按版本下载语言包到 `~/.agenter/i18n/<lang>@<version>/`（设计目标，逐步落地）。

### 4.5 多实例持久化

- app-server 守护进程维护实例列表（每实例 = `workspace + runtime`）
- 实例元数据持久化路径：`~/.agenter/instances.json`
- 默认策略：
  - 单守护进程
  - UI 与 daemon 使用 WebSocket 同步
  - Web 默认绑定 `127.0.0.1`

---

## 5. Terminal 数据契约（项目级）

项目统一依赖 `@agenter/terminal` 输出目录作为“单一信源”：

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

- `@agenter/terminal`：核心协议与终端行为（CLI 解析、渲染、分页链、dirty slice、git-log、integration）。
- `@agenter/mdx2md`：安全策略与 transform 契约。
- `@agenter/demo`：组合层行为（runtime config、loop bus、prompt store、dispatcher）。
- `@agenter/app-server`：runtime/协议行为 + e2e（daemon health/ws/lifecycle/web root）。
- `@agenter/cli`：黑盒 e2e（`daemon/web/doctor` 主链路）。
- `@agenter/tui`：高价值可观察逻辑（ws 协议解析），避免低信号 UI smoke。
- `@agenter/webui`：shell 输出契约（viewport/ws bootstrap 标记）。
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
- `@agenter/app-server` 已提供 daemon + 多实例聚合 + WebSocket 事件同步。
- TUI/WebUI 已共享同一后端并支持实例列表与 chat 同步。
- WebUI 已支持 settings/prompts 的读取与保存（含 mtime 冲突返回）。
- 后续重点：收敛 demo 逻辑并进一步提升 TUI/WebUI 交互质量。

### M3（后续）

- 在 `@agenter/app-server` 之上实现标准化 TUI/WebUI 客户端。
- 扩展多 terminal 并发场景的策略与观测。

---

## 9. 变更纪律

1. 功能改动优先补测试，再改实现。
2. 发生行为变化必须同步更新本 `SPEC.md`（项目级）或包级 SPEC。
3. 禁止在 core 代码中硬编码具体 CLI 语义（iflow/codex 等应由 settings + prompt 决定）。
