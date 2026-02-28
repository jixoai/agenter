# @agenter/terminal

ATI (Agentic Terminal Interface): 用 PTY + `@xterm/headless` 把终端输出落盘为可被 AI 消费的语义化 HTML 日志。
内核采用 ANSI-first：先生成语义模型，再序列化为 `log.html`。

## 安装与运行

本包是 TypeScript 直出（不编译导出），可直接用 Bun 运行：

```bash
cd packages/terminal
bun run ati -- --help
```

CLI 语法：

```txt
ati [options] [command] [args]
```

- 当前只支持 `run` 命令
- 非 `run` 首个位置参数会自动回退为 `run`
  - `ati codex` 等价于 `ati run codex`
- `run` 的参数布局是 `run [options] [args]`
  - `args` 第一个参数是目标 command
  - 在目标 command 之后，参数原样传递给子进程（不再作为 ATI options 解析）

## CLI 选项

- `-o, --output-dir <path>`：日志根目录（默认系统 tmp 下的 `agentic-terminal`）
- `--size <rows>:<cols>`：终端尺寸，默认 `auto:auto`
  - `--size=10` 等价 `--size=10:auto`
  - `--size=:120` 等价 `--size=auto:120`
  - `--size=auto` 等价 `--size=auto:auto`
  - `auto` 表示继承 ATI-TUI 视图区域尺寸（非交互 TTY 时回退为当前终端尺寸）
- `--color <mode>`：颜色能力，默认 `auto`
  - 支持：`auto` / `none` / `16` / `256` / `truecolor`
  - 同时兼容常见别名：`24bit`、`xterm-256color`、`off`
  - `auto` 表示继承当前 ati 进程的颜色能力（基于 `NO_COLOR` / `FORCE_COLOR` / `COLORTERM` / `TERM`）
- `--log-style <mode>`：日志样式模式，默认 `rich`
  - `rich`：落盘保留样式标签（颜色/强调等）
  - `plain`：落盘为精简 HTML（去样式标签），但保留 `<cursor/>` 与头部 YAML 注释
- `--keep-style`：`--log-style` 的别名
  - `--keep-style` => `rich`
  - `--no-keep-style` => `plain`
  - 若同时传 `--log-style`，以 `--log-style` 为准
- `--debug-cursor`：开启 cursor 实验日志（写入 `output/cursor-debug.ndjson`）
- `--git-log[=<mode>]`：为 workspace 启用 git 历史记录
  - `--git-log` 等价 `--git-log=normal`
  - `mode` 支持：`normal` / `verbose`
  - `normal`：关键帧提交（archive / resize split / resize snapshot / status idle）
  - `verbose`：每次落盘都提交

## 启动行为

`ati run ...` 时，会话顶部会显示元信息：

```txt
[ati-meta] size=auto:auto (effective 42:162) color=auto (effective truecolor) log-style=rich output-dir=/tmp/agentic-terminal
```

在交互 TTY 下，ATI 使用 OpenTUI 渲染一个独立视图区域：

- 视图内容来自 `@xterm/headless` 的结构化渲染结果（text + fg/bg + attrs）
- 刷新策略是“替换当前视图”（clear + rewrite），不是简单 stdout 追加打印
- 键盘输入由 ATI-TUI 捕获并转发到目标进程（`ctrl+q` 退出 ATI）
- 视图可显示边框；PTY 的 auto 尺寸会继承“边框内”可用区域
- 启动时先等待 OpenTUI 视口短暂稳定（settle）后再初始化 PTY/xterm，避免“启动即 resize”

当 `--size` 任一轴为 `auto` 时，ATI-TUI 视图区域 resize 会实时透传到内部 PTY：

- `--size=auto:auto`：行列都跟随外层窗口变化
- `--size=40:auto`：仅列跟随，行固定 40
- `--size=auto:120`：仅行跟随，列固定 120
- 注意：`auto` 继承的是 ATI-TUI 视图区域尺寸（会扣除顶部状态行），不是整个宿主终端尺寸

发生 resize 时，ATI 会执行“线性分片”：

- 先封存当前 `latest.log.html`（追加 `meta.split-reason: TERMINAL_RESIZED` 后重命名归档）
- 分片 footer 的 `meta.next-file` 固定指向 `latest.log.html`（后继文件），避免自指
- 等待短暂稳定窗口（默认 500ms）吸收 TUI 重绘
- 创建新的 `latest.log.html`，仅写入当前 viewport 快照，并添加 `meta.event: RESIZED_TO_${cols}x${rows}`
- 仅当尺寸真的发生变化时才触发（相同尺寸的重复 resize 事件会被忽略）
- resize 不做额外 jitter/预测算法，收到新尺寸后直接进入统一 resize 流程

## 日志目录结构

每次会话创建 workspace（UTC）：

`{output-dir}/{YYYY}/{MM}/{DD}/{HH_mm}-{pid}/`

- `output/latest.log.html`
- `output/{start}~{end}.log.html`
- `input/ai-input.log`
- `input/pending/*.xml|*.txt`
- `input/done/*.done`
- `input/failed/*.failed`
- `debug/ati-cli.ndjson`（CLI 关键事件）
- `debug/terminal.ndjson`（内核关键事件）
- `debug/git-log.ndjson`（git 初始化/提交事件）

每个日志文件（`latest.log.html` 和所有归档）顶部都包含一个统一 YAML 注释块，根节点包含 `meta` 与 `ati-source`：

- `meta.status: BUSY | IDLE`（仅 `latest.log.html` 的 `meta` 包含）
- `meta.cursor.row` / `meta.cursor.col`
- `meta.log-style: rich | plain`
- `meta.size: {rows}x{cols}`（无法确定时为 `unknown`）
- `meta.pre-file`
- `meta.viewport-base`

`ati-source` 统一放在头注释内（不再写 tail 注释）：

- `ati-source.file`、`ati-source.pre-file`
- 归档文件额外包含 `ati-source.next-file`
- `ati-source.updated-at`（最后更新时间）
- 内核在内存里维护文件链（`archive -> ... -> latest`），保证链路关系更新时不会生成多余归档文件

## 近期关键修复

- 修复 `meta.status` 长时间停留 `BUSY`：空闲后会触发状态快照提交，最终可落盘 `IDLE`
- cursor 定位改为严格使用 `@xterm/headless` 原始光标（不做 placeholder 文案硬编码修正）
- 支持 `showCursor` 语义：当硬件光标被隐藏时，ATI 不再注入额外光标块
- 保留 `inverse` 样式（如 `SGR 7m/27m`），用于显示应用自绘焦点
- 当检测到 inverse 焦点时，ATI-TUI 会优先显示 inverse 并抑制额外块光标，避免双光标或错位
- 当 blur 后光标不可见且无 inverse 时，ATI-TUI 会使用 sticky（最后一次有效焦点）避免跳到末行
- 末尾可见样式空白（如 trailing inverse cursor）不会在渲染阶段裁剪；仅在最终落盘前做 compact
- 新增 `--debug-cursor` 持久化诊断，便于实验定位 cursor 偏移问题
- 增强颜色语义映射：支持 16 色、256 色、RGB 三类输入映射
- 分页日志统一写入 `output/` 子目录，`latest.log.html` 不再放 workspace 根目录
- 修复交互启动首帧尺寸不一致导致的“启动即 resize”噪声分片
- 新增 `--git-log`：可为日志目录自动初始化 git，并按模式产生结构化 commit 历史

## 开发命令

```bash
bun run typecheck
bun test
bun run demo-cli
```
