# @agenter/terminal-system SPEC

> 本文件是 `@agenter/terminal-system` 的开发者唯一可信源（source of truth）。

## 1. 范围与目标

`@agenter/terminal-system` 是一个 TypeScript 终端内核库：

- 使用 Bun PTY 运行任意 CLI 程序
- 通过 `@agenter/termless-core` bridge 消费 official Termless backend 维护绝对滚动缓冲
- 将终端状态写入语义化 HTML 分页日志，供 AI/工具稳定消费
- 提供 `ati` CLI 作为运行入口

非目标：

- 不做 bundling/export build（直接导出 TS）
- 不耦合 iflow/codex/claude 等具体程序语义

## 2. 架构与模块

- official backend ownership 固定属于 Termless：`@termless/core` 定义 backend contract，`@termless/xtermjs` 提供当前默认 xterm backend，后续如 `@termless/ghostty-native` 也必须复用同一 ownership slot。
- Agenter 只拥有 adapter/projection law：`@agenter/termless-core` 与 `@agenter/terminal-system` 可以包装 official backend instance，但不得重新声明 backend package identity，也不得把 browser `resolvedRenderer` 冒充成 backend authority。
- `Pty`：封装 Bun PTY 进程（启动、写入、退出、resize）
- `XtermBridge`：封装 official `@termless/xtermjs` backend 的本地 bridge（写入流、读取 buffer）
- `renderer`：把 buffer 转成 ANSI/Cell 语义模型（`richLines`），再序列化成 `log.html`
- `output-reader`：按 `latest + pre-file` 文件链读取 `output/*.log.html` 正文行
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
- `input/pending/*.raw.txt`
- `input/pending/*.mixed.txt`
- `input/done/*.done`
- `input/failed/*.failed`
- `debug/ati-cli.ndjson`
- `debug/terminal.ndjson`
- `debug/git-log.ndjson`

约束：

- `latest.log.html` 只保留活跃窗口
- 超过分页阈值后封存为 `{start}~{end}.log.html`
- 当 `viewportBase===0`（典型全屏 TUI 原地重绘）时，禁止按行号分页封存；必须持续重写 `latest.log.html`
- 每个日志文件（`latest` + 所有归档）顶部都必须包含一个统一的 YAML 注释块
- YAML 注释块必须同时包含 `meta` 与 `ati-source`
- `meta.size` 必须存在（未知场景写 `unknown`）
- `meta.log-style` 必须存在（`rich | plain`）
- `meta.status` 只允许出现在 `latest.log.html` 的 `meta` 中；归档文件 `meta` 禁止包含 `status`
- 必须维护“文件链”（仅维护文件关系，不缓存文件内容）：
  - `archive[0] -> archive[1] -> ... -> latest.log.html`
  - 任何分页、恢复、重写都必须基于链路更新，避免产生多余文件
- 同名归档文件只能在链上存在一次（幂等）
- automation-facing terminal input 的 durable truth 只能来自 `input/pending/*`
- pending 文件后缀是输入模式真源：
  - `.raw.txt` 表示 literal raw bytes
  - `.mixed.txt` 表示 mixed DSL
- 未声明为这两种后缀的文件不得被当作 authoritative terminal input

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
   - 同步 resize 到 PTY + terminal backend
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

- terminal screen transport 采用 dirty signal + client-paced pull：
  - backend 对屏幕变化发送 `frameDirty`
  - client 按自身 pacing 发送 `pullFrame`
  - 本地传输默认返回 viewport-sized row-cache frame：后端仍直接序列化当前 viewport 行，但通过每个 WebSocket attachment 私有的行 `cid` 缓存复用已知行，减少重复传输和解析
  - `cid=0` 固定表示空白无样式行；未知非零 `cid` 且未携带行内容时必须视为协议错误/重置条件
  - row-cache / not-modified 类优化只能属于 transport codec/patch 层，不允许在 product、viewport 或 frontend render 逻辑里通过可见 frame 对象比较来跳过工作
  - diff 只作为显式 `transport.framePatchMode: "diff"` 的远程/低带宽优化，不是本地默认路径
  - `pullFrame` 只表达 last applied frame 与当前 geometry；viewport 变化必须通过显式 `viewportDelta` / `viewportTarget` 先进入 backend truth
  - frame transport 必须拆成三个正交循环：
    - input drain loop：WebSocket 消息先进入 backend queue；连续 `viewportDelta` 可以合并为一次 `scrollViewport(delta)`；`inputBytes`、`resize`、`viewportTarget`、`pullFrame` 等语义事件会先 flush 当前滚动段再处理
    - dirty clock loop：每个 terminal backend 共享一个默认 20FPS 的 dirty 检查循环；dirty 状态跟随 WebSocket attachment，而不是全局 terminal；已 dirty 但未 pull 的连接不重复收到 dirty
    - pull/draw delivery loop：client 客观发送滚动/输入事件后即结束输入任务；默认输出路径固定 20FPS 拉取后端 cells 并通过 frame buffer 重放；动态刷新只作为显式实验能力，dirty 可提升到 20FPS，并在前端实际绘制 cells 连续安静后降到 1FPS
  - 前端输入事件不得成为本地 screen refresh 请求；滚轮/键盘/鼠标只负责发送 backend event，最终画面只能来自后端 cells 拉取结果
  - backend viewport 输入同样不得同步发送 `frameDirty` 或直接激活 pull；`viewportDelta` / `viewportTarget` 只修改 backend viewport truth，后续可见结果由 dirty clock 或 client 下一次 `pullFrame` 消费
  - `followCursor` 是 backend viewport mutation，不是 frontend viewportTarget fallback；transport attachment 可以把最近一次 `pullFrame` 的 rows 作为可见高度约束传给 backend，由 backend 根据当前 cursor truth 派生该 attachment 的 projection viewport
  - 同一个 pulled frame 只能进入一条 cells paint path；mirror subscription/status 不能和 frame paint callback 同时触发同一帧的重复重绘
  - dirty 判断以 backend `getText()` 为主要优化比较源，同时附加 viewport/cursor facts，确保纯滚动和光标移动能触发可见帧 dirty
  - 当前 JS 运行时依赖事件循环顺序保证 queued input 与 `pullFrame` 的垂直同步；不需要额外 pre-pull flush。若未来迁移到多线程运行时，必须重新审查这个同步边界
  - WebSocket 仍然是 transport control plane：负责 bootstrap、credential、lifecycle close 与 fallback；同 Bun 进程/同 pid 客户端可以在 `hello`/`helloAck` 后升级到 same-process direct data plane
  - same-process direct data plane 只用函数调用承载同一套 semantic terminal messages，消息仍进入 backend input drain；它不是第二个 terminal truth、不是 product-layer shortcut，也不绑定 BroadcastChannel
  - direct upgrade token 必须一次性 claim；未来如果扩展到 worker/thread/cross-process，可以替换底层 broker，但必须保留 WebSocket control-plane 与 direct data-plane 的边界
- 落盘链路必须是 **ANSI-first**：
  - 先从 xterm buffer 生成结构化快照（`richLines` + cursor + rows/cols）
  - 再按 `log-style` 序列化到 `log.html`
  - 禁止通过“先 rich-html 再正则剥离标签”得到 plain
- 结构化快照是内核唯一信源；`rich/plain` 都是转录视图
- terminal interaction 是 backend/offscreen renderer capability：selection/copy/semantic selection/cursor-follow 必须通过 `TerminalInteractionEvent` 和 backend-owned `TerminalInteractionFrameState` 传播；host-projection-only 只能表示宿主能捕获事件，不能拥有 selected text 或 durable selection range
- 必须基于绝对 scrollback 渲染（非仅 viewport）
- 渲染阶段输出面向 UI 观察：不得提前裁剪可见样式空白（例如 trailing inverse）
- 插入 `<cursor/>` 表示输入焦点（仅当 xterm `showCursor=true`）
- cursor 的位置必须直接来自 terminal backend 原始 buffer（`baseY + cursorY`, `cursorX`）
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
- `--git-log[=<mode>]`
  - 默认 `none`
  - `--git-log` 等价 `--git-log=normal`
  - `mode`: `none | normal | verbose`
  - `none`：关闭 git 历史提交
  - `normal`：只在关键帧提交（archive / resize-seal / resize-snapshot / status-idle）
  - `verbose`：每次落盘都提交

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

git-log 约束：

- 开启 `--git-log` 后，workspace 若无 `.git` 必须自动 `git init`
- git 提交失败不得中断终端主流程（fail-open），但必须记录到 `debug/git-log.ndjson`

## 7. Global Collaboration Control Plane

`@agenter/terminal-system` 同时承担全局 terminal collaboration control plane 的 durable contract。该层与前文的 PTY / xterm 机械层是两个正交原子：

- `terminal-core`：负责 PTY 生命周期、读写、resize、snapshot/diff、renderer host 所需 title/status/transport 机械事实。
- `terminal-system` control plane：负责全局 terminal catalog、grant、approval、write lease、focus、presence、activity history、session projection。

长期法则：

- terminal durable truth 存在于全局 `.terminal` authority，而不是某个 workspace/session 目录。
- terminal lifecycle（list/create/focus/kill）必须独立于 session startup order 工作。
- 所有终端输入路径都必须经过同一 write policy gate：
  - direct write
  - raw write
  - websocket transport input bytes
- product-managed autonomy 也必须回到同一 gate：ordinary-user product 只能通过 TerminalSystem grant、guard approval request、timeboxed write lease 或等价 terminal authority fact 获得 terminal write authority，不能绕过 terminal-system 自己发明 hidden write path。
- websocket transport 是独立的 live terminal session protocol，不承载 automation durable truth：
  - live websocket `inputBytes` 归属真人交互 forwarding，必须经过同一 write policy gate，但授权后低延迟直写 PTY，不创建 pending file、approval request 或 `terminal_write` activity
  - automation `terminal.write` / `terminal.input` 继续走 control-plane durable path，保留 pending inbox、approval request 与 `terminal_write` activity
- grant 固定四级：`admin | writer | guard | readonly`
- superadmin 可以越过 local grant 做恢复性管理，但不改变 terminal-local durable truth 的 owner。

### 7.1 Single Current Admin

- 每个 terminal 同时只能有一个 current local admin。
- terminal 可以配置按优先级排序的 admin-group candidates。
- current admin 下线时，必须把下一个 eligible candidate 升格成 current admin。
- 更高优先级 candidate 上线时，必须立即抢占 current admin。
- pending approval requests 必须随着 current admin 切换而重新分配，不允许悬挂到旧 admin。

### 7.2 Base Write Semantics vs Admin Routing

- admin routing authority 与 actor 自身的基础写能力是两个独立维度。
- `readonly` candidate 被升格为 current admin 后，仍然保持 readonly PTY write 语义。
- `guard` candidate 被升格为 current admin 后，可以直接写自己的 terminal，不需要给自己走审批回路。

### 7.3 Approval and Lease

- `guard` 写入失败时必须创建 approval request，而不是直接透传到 PTY。
- approval timeout 默认 `90s`，并且属于 terminal authority 的状态机，不属于 attention item。
- attention 只允许投影 approval work，不能成为 approval durable owner。
- approval history 必须保留 `pending | approved | denied | expired` 的 durable 状态转移；审批查询读取的是历史事实，而不是只看当前 pending 队列。
- approved request 必须 mint timeboxed write lease。
- lease 过期后，所有输入路径立即恢复拒绝。
- product hosting attention 本身不得替代 TerminalSystem lease、approval 或 grant。
- autonomous terminal write 的 activity / effect ledger 必须保留 Avatar actor identity 与 terminal authority provenance，不能把 superadmin bootstrap actor 当成 hidden writer。

### 7.4 Session Projection and UI Contract

- session runtime 只允许保存 terminal refs、focus bindings、activity refs、approval subscription 等 projection facts。
- session stop / delete 不得删除 global terminal truth、grant 或 activity history。
- terminal 输出是共享物理事实；`terminal_read` 的 git-log/diff 进度是 actor-scoped read cursor，不允许落在 terminal 单例上。
- accessToken 读 terminal 时，read cursor 必须归属 token grant 的 participant actor，不允许退化成匿名或 terminal-global cursor。
- `remark:true` 表示消费当前 actor 的 read cursor；其它 actor 再读同一个 terminal 时必须仍能从自己的 cursor 看到同一批 diff。
- `remark:false` 表示不推进 read cursor；activity history 是否记录由 `recordActivity` 单独控制，不能与 cursor consumption 混成一个开关。
- actor-facing terminal surface projection 必须把 catalog metadata、seat/access projection、approval counters、transport endpoint 与 renderable snapshot truth 聚合成一个 authoritative model；WebUI/client 不得再自行拼接 `access + grants + actors + snapshot` 来还原 terminal truth。
- terminal profile truth 固定采用声明式 `rendererPreference + theme + cursor`：
  - `font` 也是 terminal-system durable truth，固定使用 renderer-neutral profile：`family + sizePx + lineHeight + letterSpacing + weight + weightBold + ligatures`
  - durable default font baseline 当前对齐验证过的 compact baseline 是 literal system mono stack：`ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace` + `14px` + `lineHeight: 1`
  - `rendererPreference` 是 terminal-system durable truth，允许 `auto | ghostty-web | wterm | xterm`
  - `theme` 与 `cursor` 是 renderer-neutral 的 declarative profile identity，而不是 feature-local CSS 补丁
  - `font/theme/cursor/rendererPreference` 的 durable 写入口属于 authenticated browser terminal config mutation；AI-facing runtime config mutation 不得重新取得这些 presentation 字段的写权限
  - `resolvedRenderer` 属于前端环境解析事实，不回写成 terminal-system authoritative truth
  - 当前 desktop `auto` 默认解析到 `xterm`，直到其它 renderer 通过 termless backend parity 与真实走查证明自己可以成为新的 durable baseline
  - renderer-neutral 不等于 renderer-identical：`ghostty-web` 当前只稳定消费 `family + sizePx` 等受支持子集，并在 adapter 内处理 browser font settle / repaint；`xterm` 与 `wterm` 可以继续消费更多 font subfields
  - `@font-face` declaration 不是 renderer-ready truth：只有 renderer adapter 自己拿到 browser font readiness 之后，才允许信任 webfont metrics
  - `wterm` 是 renderer stack law，而不是单一 widget law：实现可以在 adapter 内部组合 `@wterm/ghostty` core 与 `@wterm/dom` host，但 host/UI 只能消费统一 terminal-view contract
  - terminal-window 的 fit/cover 几何真值来自 renderer-native content metrics，而不是 renderer host box；当 scroll host 与 terminal content box 不一致时，adapter 必须上报 content surface 的尺寸事实
- terminal websocket transport 的 contract 固定为“bootstrap snapshot + live bytes/status”：
  - websocket 本身只是 binary data link；terminal transport 的 authoritative live truth 是 PTY `inputBytes / outputBytes`
  - live session frame 的 concrete wire format 固定为 `@agenter/terminal-transport-protocol` 提供的 protobuf message envelope；client/server 不得各自发明 ad-hoc JSON 或私有二进制布局
  - connect 时允许发送一份 renderable snapshot 作为 viewport hydration baseline，即使 terminal 当前是 stopped 也可以连接并拿到 bootstrap snapshot
  - live 阶段的主 truth 是 `outputBytes` / `status`，而不是每个 render tick 都镜像一份 full snapshot
  - geometry 未变化时，不得持续推送冗余 full snapshot
  - client 可以发送 `resize` sideband frame 同步 backend terminal geometry，但 geometry authority 必须是显式 contract，而不是 last-resizer-wins 副作用
  - same-terminal attachments 还必须支持显式 `viewportDelta` sideband frame，让 shared viewport mutation 回到 backend terminal truth，而不是藏在 host-local scroll state
  - client 可以发送 `inputBytes` frame 转发 xterm 交互字节；方向键、快捷键、普通输入、binary mouse report 都不得伪装成 automation write
  - browser `keydown/paste/mouse/focus` 只是 renderer 本地事实；transport 优先承载 terminal-native bytes / control sequences，而不是浏览器语义事件总线
- one terminal truth 必须同时驱动 renderable snapshot truth、durable terminal change-log truth 与 terminal observation ingress truth；client projection cache 不能被提升成第二 authoritative terminal state machine。
- 同一个 terminal id 的 attachments 默认共享 visible viewport truth 与 visible input effects；如果一个 attachment 触发 shared viewport mutation，结果必须先经 backend apply，再由 authoritative publication 回显给所有 attachments。
- geometry authority 与 presentation scaling 必须分离：projection-only attachment 可以 fit/cover/zoom shared geometry，但不得在另一个 attachment 持有 authority 时静默重写 backend cols/rows。
- projection contract 要求同一 terminal truth 保持连续 renderer surface；不得把 scrollback/history 降级成第二个 plain-text mirror fidelity tier。
- terminal listing / transport contract 必须显式携带：
  - global terminal id
  - title
  - status
  - renderer preference
  - theme / cursor profile identity
  - actor seats / admin state
  - transport endpoint
- WebUI 的 `Terminals` 页面是 terminal-system 的正式消费面：
  - 顶层 tabs 表示 global terminal catalog
  - terminal-local toolbar 承载 focus / viewport / access / approval 操作
  - AvatarGroup 用 badge color 表示 offline / online / focused，用 border color 表示 `readonly / guard / writer / admin`
  - 当授予第二个 `writer` 时，UI 必须先给出 downgrade prompt，允许把旧 writer 降级成 guard

### 7.5 Await Observation

- `terminal await` 是独立于 `terminal read` 的 bounded observation 原语；`read` 只负责 immediate inspection，不承载等待、匹配或稳定窗口语义。
- await 只能观察 TerminalSystem 拥有的物理事实：headless snapshot lines、status、running state、cursor/geometry 与 commit cursor；不得硬编码 Claude、Codex、iflow 或其它上层程序语义。
- await 的 deterministic match / absent 判断必须作用在稳定后的 clean snapshot lines 上，而不是 raw PTY bytes、ANSI transition chunks 或 append-only log 假象。
- await 结果必须返回结构化 outcome：`changed | idle | matched | absent | timeout | stopped | cancelled`，并携带 bounded tail lines、match context、cursor、rows/cols、status/running 与 from/to cursor metadata。
- command-level timeout 是正常 outcome，必须返回最后可见 post-mortem evidence；外部 shell-level timeout 可能中断 JSON 返回，但 server-side waiter、listener、timer 与 fallback handle 仍然必须释放。
- await 默认记录 terminal observation activity；调用方可以用 `recordActivity:false` 做纯探测，且该开关不得影响 returned evidence。
- commit message 必须结构化，标题格式：
  - `ati(log): <event> <mode>`
- commit 正文至少包含：
  - `workspace`、`event`、`mode`、`file`、`status`、`size`、`cursor`、`pre`、`next`、`ts`

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
- `StructuredRenderResult`
  - `richLines`, `cursorAbsRow`, `cursorCol`, `cursorVisible`, `rows`, `cols`
- `TerminalStructuredSnapshot`
  - `StructuredRenderResult` + `seq` + `timestamp` + `status`

核心类：

- `AgenticTerminal`
  - `start()`
  - `write()`
  - `input()`
  - `writeRaw()`
  - `forceCommit()`
  - `destroy()`
  - `onOutput()`
  - `onExit()`
  - `onStructured()`
  - `getLatestStructured()`

输入法则：

- `write()` 是 automation raw API，必须通过 pending `.raw.txt` 落盘后再消费
- `input()` 是 automation mixed API，必须通过 pending `.mixed.txt` 落盘后再消费
- pending 处理失败必须向 automation caller 回传失败；不能把没有真正写入 PTY 的输入伪装成 success
- `writeRaw()` 只保留给 ATI-CLI / ATI-TUI / terminal-view websocket live `inputBytes` 这类真人交互 forwarding；它不是 automation durable truth
- mixed DSL 允许 `<key .../>`、`<wait .../>`、`<raw>...</raw>`
- `<raw>...</raw>` 内只解码固定 HTML entities：`&lt;`、`&gt;`、`&amp;`、`&quot;`、`&#39;`
- nested `<raw>` 属于非法 mixed payload，terminal-core 必须拒绝，不能半截吞掉 outer raw block

文件链读取 API（面向 demo/工具）：

- `readTerminalOutput(options): Promise<string>`
- `streamTerminalOutput(options): ReadableStream<string>`
- `options`
  - `outputDir: string`（workspace 下 `output` 目录）
  - `offset?: number`（默认 `0`，尾部反向计数）
  - `limit?: number`（默认 `-1`，不限制）
- 语义约束：
  - 读取顺序：`latest.log.html -> pre-file -> ...`，返回顺序固定为时间正序（旧到新）
  - 只返回正文行（不返回 YAML 注释头）
  - 返回内容保持 HTML 正文原样（保留 `<cursor/>` 等标签）

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
