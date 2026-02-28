# @agenter/terminal SPEC

> 本文件是 `@agenter/terminal` 的开发者唯一可信源（source of truth）。

## 1. 范围与目标

`@agenter/terminal` 是一个 TypeScript 终端内核库：

- 使用 Bun PTY 运行任意 CLI 程序
- 使用 `@xterm/headless` 维护绝对滚动缓冲
- 将终端状态写入语义化 HTML 分页日志，供 AI/工具稳定消费
- 提供 `ati` CLI 作为运行入口

非目标：

- 不做 bundling/export build（直接导出 TS）
- 不耦合 iflow/codex/claude 等具体程序语义

## 2. 架构与模块

- `Pty`：封装 Bun PTY 进程（启动、写入、退出、resize）
- `XtermBridge`：封装 `@xterm/headless`（写入流、读取 buffer）
- `renderer`：把 buffer 转成 ANSI/Cell 语义模型（`richLines`），再序列化成 `log.html`
- `Committer`：debounce + throttle + plain text 去噪提交
- `HtmlPaginationStore`：分页写盘，维护 `latest.log.html` 与归档
- `AgenticTerminal`：编排 PTY/xterm/committer/inbox 生命周期
- `ati-cli`：yargs 命令解析与 stdin/stdout 桥接

## 3. 工作区与落盘约束

工作区路径（UTC，可读目录结构）：

- `{output-root}/{YYYY}/{MM}/{DD}/{HH_mm}-{pid}/`
- 示例：`/tmp/agentic-terminal/2026/02/28/04_59-10568/`
- 同一分钟内若发生冲突，允许追加短后缀保证唯一性（如 `04_59-10568-01`）

固定目录结构：

- `output/latest.log.html`
- `output/{start}~{end}.log.html`
- `input/ai-input.log`
- `input/pending/*.xml|*.txt`
- `input/done/*.done`
- `input/failed/*.failed`
- `debug/ati-cli.ndjson`
- `debug/terminal.ndjson`

约束：

- `latest.log.html` 只保留活跃窗口
- 超过分页阈值后封存为 `{start}~{end}.log.html`
- 每个日志文件（`latest` + 所有归档）顶部都必须包含一个统一的 YAML 注释块
- YAML 注释块必须同时包含 `meta` 与 `ati-source`
- `meta.size` 必须存在（未知场景写 `unknown`）
- `meta.log-style` 必须存在（`rich | plain`）
- `meta.status` 只允许出现在 `latest.log.html` 的 `meta` 中；归档文件 `meta` 禁止包含 `status`
- 必须维护“文件链”（仅维护文件关系，不缓存文件内容）：
  - `archive[0] -> archive[1] -> ... -> latest.log.html`
  - 任何分页、恢复、重写都必须基于链路更新，避免产生多余文件
  - 同名归档文件只能在链上存在一次（幂等）

统一 YAML 头注释约束：

- `ati-source` 统一放在头注释中，不再写尾注释
- `ati-source.file`
- `ati-source.pre-file`
- 归档文件额外包含 `ati-source.next-file`
- `ati-source.updated-at`

Resize 事件采用 **Linear Epoch Split & Viewport Snapshot**（禁止历史重写）：

- 触发 `resize(cols, rows)` 时，必须先 seal 当前 epoch，再启动新 epoch
- 任何已从 `latest.log.html` seal 并重命名为归档文件的文件，都视为 immutable，后续绝不改写
- resize 引发的 reflow（旧行重排）必须忽略，不尝试回写历史文件
- 新 epoch 只从当前 viewport 做快照，不从 buffer line 0 重算历史
- resize 触发必须具备“尺寸变化守卫”：
  - 仅当 `cols` 或 `rows` 与上次已应用值不同，才允许进入 split/snapshot 流程
  - 相同尺寸的重复 `resize` 事件必须忽略，避免伪 resize 导致文件链噪声分裂
- 交互 TTY 首次启动必须与 ATI-TUI 使用同一视口换算规则（cols=`width-2`, rows=`height-4`）：
  - 必须先启动 OpenTUI，并在启动阶段等待首个视口尺寸稳定（短暂 settle window）后，才允许初始化内部 PTY/xterm
  - 启动阶段应取 settle window 内最后一次 viewport 尺寸作为初始尺寸
  - 禁止使用“预估尺寸 + 启动后再修正”的流程，避免启动即 resize
- resize 处理策略保持直觉：
  - 接收到新尺寸后立即进入统一 resize 流程（串行执行）
  - 不引入额外 jitter/预测/平滑算法；仅保留“同尺寸忽略”这一基础守卫

Resize 工作流（强制）：

1. Seal 旧 epoch
   - 立即 flush pending writes（跳过 debounce，强制提交）
   - 向 `latest.log.html` 追加 footer：
     - 使用 YAML 注释格式写 `meta.split-reason: TERMINAL_RESIZED`
     - `meta.last-updated: <ISO>`
     - `meta.next-file: latest.log.html`（表示链路上的后继文件，不允许自指）
   - 将 `latest.log.html` 重命名为归档名（`start~end.log.html`）
   - 更新内存文件链（仅关系，不缓存内容）
2. 执行 resize 并等待稳定
   - 同步 resize 到 PTY + `@xterm/headless`
   - 等待稳定窗口（默认 500ms），吸收目标 TUI 的 SIGWINCH 重绘噪声
3. 启动新 epoch（viewport snapshot）
   - 创建新的 `latest.log.html`
   - 注入 header：
     - `meta.pre-file: <ARCHIVED_FILE_NAME>`
     - `meta.event: RESIZED_TO_${cols}x${rows}`
   - 注入系统提示行：
     - `<system-msg>=== Terminal Resized to ${cols}x${rows}. Historical scrollback is preserved in previous files. ===</system-msg>`
   - 仅快照 viewport 区间 `[baseY, baseY + rows - 1]`
   - 重置增量指针 `lastLoggedAbsoluteY = baseY + rows`

Debug 约束（用于定位 resize 问题）：

- 所有关键事件必须写入 `debug/*.ndjson`（每行一条 JSON）
- `debug/ati-cli.ndjson` 至少记录：
  - 会话启动参数、首个 viewport 事件、effective size、每次 resize request/apply/skip/error
- `debug/terminal.ndjson` 至少记录：
  - status 切换、resize begin/skip/seal/snapshot/done、进程退出

## 4. 渲染与语义约束

- 落盘链路必须是 **ANSI-first**：
  - 先从 xterm buffer 生成 `richLines`（语义模型）
  - 再按 `log-style` 序列化到 `log.html`
  - 禁止通过“先 rich-html 再正则剥离标签”得到 plain
- 必须基于绝对 scrollback 渲染（非仅 viewport）
- 渲染阶段输出面向 UI 观察：不得提前裁剪可见样式空白（例如 trailing inverse）
- 插入 `<cursor/>` 表示输入焦点（仅当 xterm `showCursor=true`）
- cursor 的位置必须直接来自 `@xterm/headless` 原始 buffer（`baseY + cursorY`, `cursorX`）
- 禁止基于特定应用文案（如 placeholder 文本）做硬编码寻址修正
- 必须保留并透传关键文本样式属性（至少：fg/bg/bold/underline/inverse）
- 当目标程序通过 SGR（如 `7m/27m`）自绘焦点时，ATI 不得用硬件 cursor 覆盖该语义
- 当检测到 inverse 光标候选时，ATI-TUI 需要优先以 inverse 作为焦点，并抑制额外块光标注入
- inverse 且 fg/bg 缺省（terminal default color）时，ATI-TUI 必须提供可见的对比色回退
- 渲染阶段禁止裁剪“末尾但可见”的样式空白（如末尾 inverse 光标单元、带背景色的空白）
- 空白裁剪属于最终落盘优化：在持久化提交前做 compact（而非在渲染阶段丢失语义）
- ATI-TUI 的焦点解析优先级必须是：`inverse` > `hardware(showCursor=true)` > `sticky(last known)`
- 当 `blur` 或 `showCursor=false` 且无 inverse 时，焦点行应沿用最后一次有效位置（sticky），禁止退化到“最后一行空白”
- 颜色语义映射支持：
  - 16 色 palette
  - 256 色 palette
  - RGB 颜色（映射到最近语义标签）

cursor 实验约束：

- 需要支持 `ati run --debug-cursor ...` 生成持久化调试日志：
  - 路径：`output/cursor-debug.ndjson`
  - 每条记录至少包含：时间戳、递增序号、raw cursor(row/col)、cursor 附近上下文行
- 调试日志仅用于定位问题，不参与分页链与语义输出

## 5. 提交与状态机约束

- `status` 取值仅 `BUSY | IDLE`
- PTY 有输出即 `BUSY`
- 空闲超时后切换 `IDLE`
- 从 `BUSY -> IDLE` 时必须触发一次状态快照提交（确保文件可观测到 `meta.status: IDLE`）
- 去噪规则：
  - 仅样式变化、plain text 未变 => 跳过提交
  - 同时支持 debounce + throttle

## 6. CLI 规范（ati）

语法：

```txt
ati [options] [command] [args]
```

命令：

- 当前仅 `run`
- 非 `run` 首个位置参数默认按 `run` 处理（`ati codex` == `ati run codex`）
- `run` 的参数布局采用：`run [options] [args]`
  - `args` 的第一个参数视为目标 command
  - 在第一个非 `-` 参数（目标 command）之后，后续参数全部按子进程 args 原样透传
  - 也即：ATI 自身 options 只在 command 之前解析

选项：

- `-o, --output-dir <path>`
  - 日志根目录（默认系统 tmp 下 `agentic-terminal`）
- `--size <rows>:<cols>`
  - 默认 `auto:auto`
  - 兼容 `10`、`:120`、`auto` 等缩写
  - `auto` 继承 ati 当前 PTY 尺寸
  - 当某一轴为 `auto` 时，该轴必须在外层窗口 resize 时持续继承（动态透传）
- `--color <mode>`
  - 默认 `auto`
  - 支持：`none | 16 | 256 | truecolor`（兼容 `24bit` / `xterm-256color` / `off`）
  - `auto` 继承 ati 当前 PTY 颜色能力（基于环境变量推断）
- `--log-style <mode>`
  - 默认 `rich`
  - 支持：`rich | plain`
  - `rich`：落盘保留样式标签（颜色/强调等）
  - `plain`：落盘为“精简 HTML”，移除样式标签，但必须保留 `<cursor/>` 与 YAML 头注释
- `--keep-style`
  - `--keep-style` 等价 `--log-style=rich`
  - `--no-keep-style` 等价 `--log-style=plain`
  - 若同时传入 `--log-style`，以 `--log-style` 为准
- `--debug-cursor`
  - 默认 `false`
  - 开启后会写 `output/cursor-debug.ndjson`，用于实验 cursor 位置问题

启动输出约束：

- `ati run` 时，stdout 第一行必须打印会话元信息：
  - `size`
  - `color`
  - `log-style`
  - `output-dir`
- 在交互 TTY 模式下，ATI 必须使用 OpenTUI 作为容器渲染层：
  - `xterm` 渲染结果写入 ATI-TUI 的“视图区域”，不是直接 `console/stdout` 追加打印
  - 每次刷新是“清空后重绘当前视图”（replace），不是 append
  - 视图数据源必须来自 `xterm` 的结构化渲染结果（rich spans: text + fg/bg + attrs），而非 PTY 原始 chunk
  - ATI-TUI 禁止二次解析语义标签字符串来恢复颜色
  - 当 `cursorVisible=false` 时，ATI-TUI 禁止注入额外光标块；应仅显示 xterm 已渲染的内容样式
  - 允许使用边框；若使用边框，PTY 的 auto size 必须继承“边框内视口”尺寸
- `--size=auto` 在交互 TTY 模式下的语义：
  - `auto` 继承 ATI-TUI 视图区域的 rows/cols（不是整个宿主终端窗口）
  - 因为顶部有 meta/status 行，默认 `auto` 的 rows 会小于宿主终端总行数
- 非 TTY（如管道/测试）允许退化为直通输出，以保证可自动化执行

resize 约束：

- `ati` 进程收到终端 resize 事件后，必须调用内部 `AgenticTerminal.resize(cols, rows)`
- 对于 `--size` 的固定轴保持不变；`auto` 轴按最新外层尺寸重算

## 7. 环境变量与颜色能力策略

当 `--color` 明确指定时，PTY 环境变量覆盖策略：

- `none`: `TERM=dumb`, `NO_COLOR=1`, `FORCE_COLOR=0`
- `16`: `TERM=xterm`, `FORCE_COLOR=1`
- `256`: `TERM=xterm-256color`, `FORCE_COLOR=2`
- `truecolor`: `TERM=xterm-256color`, `COLORTERM=truecolor`, `FORCE_COLOR=3`

当 `--color=auto` 时，继承推断顺序：

1. `NO_COLOR`
2. `FORCE_COLOR`
3. `COLORTERM`
4. `TERM`

## 8. API 约束

核心类型：

- `TerminalProfile`
  - `rows`, `cols`, `color`, `logStyle`, `outputRoot`, `workspacePath`, `resumePid`, `cwd`, `debugCursor`
  - `debounceMs`, `throttleMs`, `maxLinesPerFile`
- `TerminalColorMode = "none" | "16" | "256" | "truecolor"`
- `TerminalLogStyle = "rich" | "plain"`

核心类：

- `AgenticTerminal`
  - `start()`
  - `writeMixed()`
  - `writeRaw()`
  - `forceCommit()`
  - `destroy()`
  - `onOutput()`
  - `onExit()`

## 9. 测试基线

必须通过：

- `bun run typecheck`
- `bun test`

测试覆盖重点：

- CLI fallback 语义与参数解析（含 `--size` / `--color` / `--log-style` / `--keep-style`）
- 元信息首行输出
- 分页恢复与 `output/` 子目录路径
- `meta.status` 的 `BUSY/IDLE` 落盘
- raw cursor 直通（禁止 placeholder 硬编码重定位）
- 颜色语义映射（16/256/RGB）
