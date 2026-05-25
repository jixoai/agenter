# agenter-ext-shell SPEC

> 本文件记录 `agenter-ext-shell` 作为 extension product 的长期职责。

## 1. 角色

`agenter-ext-shell` 是社区/extension 级 terminal product：

- 通过 `agenter shell` 被 descriptor-driven launcher 启动
- 代码位置属于 `extensions/cli-shell`，不属于 core packages
- 可使用 tmux 作为本地 terminal host/compositor
- 通过 generic product-extension/client-sdk API 绑定 TerminalSystem、AvatarRuntime、MessageRoom 与 attention
- 不把 TerminalSystem 当作 cli-shell 的产品渲染层、terminal pair 层或 pane topology 存储层
- 不把 tmux 当作 Shell 真相、提示词真相、授权真相或 MessageRoom 真相

## 2. 长期法则

- package 只能通过 `@agenter/client-sdk` 与 `@agenter/product-extension-runtime` 消费平台能力；不得 import core runtime internals。
- optional `@avatar` 与 `--session` grammar 属于 product-local parsing：Avatar identity 与 shell name 必须分离，shell name 不能成为 runtime identity。
- `--avatar=<nickname>` 是显式 Avatar 选择器；positional `@nickname` 只是等价 shorthand。两者同时出现且不一致时必须在任何 backend mutation 前失败。
- `--create-avatar` 只是“允许创建缺失普通 Avatar”的 boolean 权限。它不得创建特殊 Avatar 类型、特殊 classify、特殊 prompt、特殊 memory pack 或隐藏测试模式；系统没有 test Avatar 概念。
- `--clear-avatar` 只清当前 workspace + selected Avatar 对应的 runtime session/context，必须发生在 `ensureRuntime/startRuntime` 之前。它不得删除 Avatar principal、nickname alias、`AGENTER.mdx`、memory files、profile media、workspace files、tmux sessions 或 MessageRoom resources。
- `--session=<name>` 只选择 cli-shell product resource key，例如 `--session=4` 对应 `shell-4`。它不得变成 AvatarRuntime identity，也不得被解释成“创建一个干净 Avatar 上下文”。
- 默认 assistant 是 `shell-assistant`；其 prompt 与 memory 初始化固定为 seed-if-missing，且底层 avatar-private 文件保持开放可编辑。
- `AGENTER.mdx` 是提示词唯一可信源；cli-shell 当前 terminal/room/session 的绑定信息只能作为 runtime/session facts 出现，不能变成第二份隐藏提示词。
- cli-shell 必须通过 generic binding 获得当前 TerminalSystem terminal id；tmux pane id 只能是 presentation-local host 标识。
- cli-shell 必须把 tmux 作为 product shell，而不只是 process launcher：默认 attach 进入 primary shell pane，Chat 通过 tmux popup 按需打开，persistent Chat pane 只是显式 fallback。
- cli-shell 必须使用 product-owned tmux socket namespace（当前为 `agenter-cli-shell`），不得把 status/key binding 写入用户默认 tmux server。
- cli-shell 必须把 Avatar、daemon endpoint、workspace path、managed state 等产品上下文写入当前 tmux session 的 user options；key binding 必须读取 `#{session_name}` 和这些 session-local options，不能把某一个 shell 的上下文硬编码进全局 binding。
- cli-shell 的 tmux key/status binding 必须保持短命令：只把 action、session、Avatar、target pane 等上下文交给 extension-owned `tmux-action` 子命令；真正的 Help/Chat/managed/Dock/Mouse/Shell 动作由 cli-shell 代码执行，避免把 `#{...}` format 字面量泄漏给 shell 进程。
- cli-shell 默认必须开启 tmux mouse support，让底部 status bar 成为可点击主入口；`Ctrl+b` 后按 `m` 必须可以关闭/重新开启 Mouse，关闭后恢复普通终端的原生鼠标选择文本行为，但 status click 不再可用。
- cli-shell 必须安装底部 tmux status bar：左侧展示 product id、session、Avatar、Avatar Heartbeat 预览、managed state；managed state 必须可点击并切换 room-bound hosting attention。右侧只展示 Help 入口与 Chat popup 入口；Dock pane fallback、Mouse toggle、Shell focus 与 Refresh 是 keyboard-accessible expert actions，不得重新挤占右侧主入口。
- Avatar Heartbeat 预览必须来自 runtime Heartbeat facts 的 cli-shell-local 投影，不得通过恢复旧 `terminal-2` composed surface 或读取 TerminalSystem active surface 实现。
- cli-shell session 必须隐藏默认 tmux window list，并显式设置 status-left/status-right 长度；左右长度必须通过 `@agenter/tmux-client` 的 minimum client width 预算校验，确保 Help/Chat 等鼠标入口在 80 列基线下仍可点击。
- cli-shell session 必须显式设置高对比 status/status-left/status-right 样式；产品 status label 不得依赖 `#[default]`，否则会继承用户全局 tmux theme 并导致底部状态栏不可读。
- status bar action 必须通过 tmux `range=user|...` 与 `MouseDown1Status` 建模；Mouse 开启时，点击 managed/Help/Chat 触发对应产品动作。managed 这类可点击入口必须放在动态 Heartbeat 文本之前，避免可变左侧文本吞掉右侧 Help/Chat 热区。status bar 不得把快捷键文案当作主 UI；当前 surface 必须通过背景色或文字颜色高亮表达。
- cli-shell 必须提供 Help popup，`Ctrl+b` 后按 `?` 可打开；Mouse 开启后点击 Help 也可打开。Help 必须用非 tmux 用户能理解的方式说明点击主入口、“先按 Ctrl+b 松开，再按下一键”、Mouse、Chat popup、Dock pane、copy-mode 与 popup 退出方式。
- Help 是同一 tmux client 上的覆盖层动作；如果 Chat popup 已经打开，Help 必须先关闭当前 client popup 并清理 Chat popup presentation state，再打开 Help，避免 tmux 单 client popup 限制导致点击看起来无反应。
- Help popup 必须启动 cli-shell-owned OpenTUI `help-panel` surface；不得退化成 tmux `printf/read` shell snippet。静态 Help surface 不需要 daemon client/store/bootstrap，避免后端连接失败导致本地帮助入口无响应。
- Chat popup / Dock pane 只允许让 tmux 提供本地 popup/pane 容器；`room` 子命令本身必须启动 OpenTUI MessageRoom surface，不得降级成纯文本 `room-console`。
- Chat 是 cli-shell product shell 中的单例 surface：同一个 tmux session + Avatar 下，状态栏 `Chat`、dock fallback、titlebar layout request 必须收敛到同一个 Chat surface。状态栏 `Chat` 是 toggle：closed 时按保存的默认布局打开；popup 或 pane 已打开时再次触发必须关闭当前 Chat surface、恢复 shell focus/highlight，不得再打开第二个 Room。
- Chat 单例状态必须由 tmux session-local options 与 pane discovery 共同维护，当前包括 `@agenter_cli_shell_chat_surface`、`@agenter_cli_shell_chat_pane`、`@agenter_cli_shell_active_action`。这些都只是 presentation-local truth，不是 TerminalSystem/MessageSystem truth。
- cli-shell 对 tmux 的运行时 topology 操作必须优先通过通用 `@agenter/tmux-client` 完成；tmux status/key binding 只保留短的 `tmux-action` 入口命令。`@agenter/tmux-client` 是客观 tmux SDK，不得包含 cli-shell、Avatar、MessageRoom、TerminalSystem 或 Studio 语义。
- 在 tmux `run-shell` 内部再次调用 tmux 时，传给内层 tmux 的 format（例如 pane discovery 的 `#{pane_id}`）必须使用 `##{...}` 延迟展开，避免外层 tmux 提前把内层 format 展开成触发 action 的 pane。
- OpenTUI Chat surface 的顶部 titlebar 必须提供关闭按钮；关闭按钮只关闭当前 room surface/popup，不得杀掉 tmux session 或 MessageRoom truth。
- OpenTUI Chat surface 顶部的 `◨` / `◧` / `⿴` 只是 tmux layout 请求入口：`◨` 请求左侧 dock pane，`◧` 请求右侧 dock pane，`⿴` 请求 popup/cover。Chat surface 自身不得用这些按钮改变内部 left/width 或重建一个自有混合布局；实际布局必须由 cli-shell-owned tmux action 执行。
- Chat popup 里的 room 命令异常退出后不得一闪而过；必须显示退出状态并等待用户按键关闭。用户通过 titlebar 主动关闭或布局切换导致的正常退出必须直接关闭旧 surface。
- Chat popup / Dock pane 的 room 子命令必须复用当前 launcher 提供的 cli-shell bin argv；不得在 tmux host 内用 `import.meta.url` 猜测入口路径。
- cli-shell 的默认 tmux attach 不得为了显示 Chat 而永久 `split-window`；任何 persistent Chat pane 必须由显式 key binding 触发。
- cli-shell 必须安装 product-local tmux key bindings：`Ctrl+b` 后按 `?` 打开 Help popup，按 `c` 打开 Chat popup，按 `C` 打开 Chat pane fallback，按 `m` 切换 Mouse，按 `s` 聚焦 shell pane，按 `r` 刷新状态栏。
- cli-shell 不得创建 `terminal-1` / `terminal-2` 作为 active product surface；这些名字只允许出现在 legacy residue audit 或 migration cleanup 语境。
- cli-shell 不得写入 `terminalRuntimeKind=composed`、`composedShellTerminalId` 或发布 `ProductTerminalComposedSurfaceState`。
- MessageRoom 是 MessageSystem truth；tmux room pane 只是一个本地投影/输入入口。
- managed mode 只是 room-bound hosting attention；positive `hosting` 不等于隐式 shell authority，也不会创建 TerminalSystem write lease 或 permanent writer grant。managed provenance 可以携带 `surfaceId` 这种 extension-local surface id（例如 `tmux:shell-5`）作为展示层出处，但实际 terminal authority 仍必须回到当前绑定的 TerminalSystem terminal id。
- cleanup 必须通过同一个 product-owned tmux socket namespace 清理 extension-owned tmux sessions，并清理 MessageRoom resources、runtime sessions，也可作为 migration helper 清理旧 terminal-1/terminal-2 residue。
- WebUI 与 cli-shell 是两个独立产品。WebUI 不承担 cli-shell 的 Avatar catalog、tmux launch、session reset 或 cleanup 控制面。
