# @agenter/cli-shell SPEC

> 本文件记录 `@agenter/cli-shell` 作为外部产品包的长期职责。

## 1. 角色

`@agenter/cli-shell` 是 ordinary-user terminal product：

- 通过 `agenter shell` 被 descriptor-driven launcher 启动
- 把一个 user shell-terminal 作为 native host，绑定到 terminal-1 shell truth、terminal-2 final visible product terminal、一个 product room、一个 selected AvatarRuntime
- 在不污染 core runtime 的前提下提供 bottom-only TUI、chat dialogue、managed hosting surface

## 2. 长期法则

- Bun-first package 的 entry contract 必须 ts-first：`bin` / `exports` 直接指向 source entry，不再保留 dist wrapper 回退。
- package 只能通过 `@agenter/client-sdk` 与 `@agenter/product-extension-runtime` 消费平台能力；不得 import core runtime internals。
- optional `@avatar` 与 `--session` grammar 属于 product-local parsing：Avatar identity 与 shell name 必须分离，shell name 不能成为 runtime identity。
- `--avatar=<nickname>` 是显式 Avatar 选择器；positional `@nickname` 只是等价 shorthand。两者同时出现且不一致时必须在任何 backend mutation 前失败。
- `--create-avatar` 只是“允许创建缺失普通 Avatar”的 boolean 权限。它不得创建特殊 Avatar 类型、特殊 classify、特殊 prompt、特殊 memory pack 或隐藏测试模式；系统没有 test Avatar 概念。
- `--clear-avatar` 只清当前 workspace + selected Avatar 对应的 runtime session/context，必须发生在 `ensureRuntime/startRuntime` 之前。它不得删除 Avatar principal、nickname alias、`AGENTER.mdx`、memory files、profile media、workspace files、terminal resources 或 MessageRoom resources。
- `--session=<name>` 只选择 cli-shell product resource key，例如 `--session=4` 对应 `shell-4`，并把 terminal-1、terminal-2 与 room 绑定成同一组产品资源。它不得变成 AvatarRuntime identity，也不得被解释成“创建一个干净 Avatar 上下文”。
- 默认 assistant 是 `shell-assistant`；其 prompt 与 memory 初始化固定为 seed-if-missing，且底层 avatar-private 文件保持开放可编辑。prompt seed 必须在 runtime 首次模型调用前落到 session Avatar principal 的 workspace-aware canonical `AGENTER.mdx`，即 `[~|<workspace>]/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`，不得写入 session-local、nickname alias、settings prompt path 或 workspace-root fallback prompt 后再期待 runtime 读取。
- Shell Assistant 的 prompt 语义必须围绕当前 Terminal 与 MessageRoom。root workspace 只作为调用 runtime-local terminal/message/attention CLI 的入口环境，不应在对话模型中冒充用户可见 Terminal；当用户要求运行、输入、按键、检查输出或继续终端工作时，默认作用目标是当前 cli-shell Terminal。
- Shell Assistant prompt 不得默认暴露 terminal-1 / terminal-2 这类 cli-shell 内部终端角色。Avatar 的默认认知只需要知道“当前打开 Terminal”；内部 terminal pair 只能留在产品实现、debug 文档和实现级测试中。
- Shell Assistant 对 MessageRoom 的解释规则是 cli-shell 产品局部法则：任一 cli-shell room 的话题默认围绕其 `metadata.resourceKey=<shellName>` 对应的 TerminalSystem 实例，不能把这条规则下沉成 core runtime 或其它产品的全局行为。
- 多个 cli-shell terminal 同时存在是合法状态；产品必须保留 terminal identity，并提供产品级 cleanup 管理动作来清理过多的 cli-shell terminal / room / session 资源。cleanup 只能通过已有 session、message-system、terminal-system 通用 API 编排，不得在核心层添加 cli-shell 专用分支。cleanup 必须优先删除 MessageRoom 与 shell-assistant runtime session，再删除 TerminalSystem 实例，避免某个 terminal 正好承载当前 daemon 时提前切断自己的 API。
- cli-shell 的 room、terminal、heartbeat、managed state 都必须读取 backend / platform truth；local process memory 不能冒充 reconnect 后的 canonical state。
- cli-shell 必须保留两个 terminal 角色：terminal-1 是唯一 shell truth，terminal-2 是唯一 backend-owned final visible product-terminal truth；native host 与 Web host 都只能消费这套 product law。
- `shell-1` 这类 session key 只是产品会话标识，不是 terminal-1 或 terminal-2 的同义词；它只用来把这两个 terminal 角色绑定到同一个 product session。
- cli-shell 的主表面固定是一个 native `shell-terminal-view` 投影角色；这个 native terminal projection 角色当前可以暂留在 `packages/cli-shell` 内部实现，但它最终解码渲染的是 terminal-2 完整产品面 truth，而不是只渲染 shell rows 再由 native host 额外持有一套 accepted bottom/dialogue chrome 真相。
- cli-shell 的 Web host 通过 `web-terminal-view` 投影 terminal-2；`--web` 只是宿主模式，不是第二套产品身份，也不是第二套 PTY，也不得直接绕过 terminal-2 去附着 terminal-1。
- cli-shell 的当前打开 TerminalSystem 实例是 bootstrap 结果里的 `visibleTerminal.entry.terminalId`，也就是用户可见的 terminal-2 产品面。native host 和 `--web` host 都只能订阅这个 terminal 的 permission request stream；不得为了让弹窗出现而订阅 hidden/internal terminals。
- terminal-1 是 terminal-2 的 shell truth/source plumbing，不是 Shell Assistant 的可操作 TerminalSystem 实例。cli-shell bootstrap 不得给 selected Avatar 直接授予 terminal-1 grant；如果复用历史资源时发现当前 Avatar 在 terminal-1 上残留 grant，必须撤销它，只保留 terminal-2 的 guard grant。否则 `terminal list` 会把内部 terminal 暴露给 Avatar，并使 guard approval request 打到错误 terminal。
- terminal write guard approval 属于 TerminalSystem authority。native `shell-terminal-view` 和 `--web` terminal-view 只能投影当前 terminal 的请求并调用 `approveGlobalTerminalRequest` / `denyGlobalTerminalRequest`；渲染、批准或拒绝请求不得改变 managed/takeover state。
- WebUI 与 cli-shell 是两个独立产品。WebUI 不承担 cli-shell 的 Avatar catalog、terminal launch、session reset 或 authorization repair 控制面；cli-shell `--web` host 是 cli-shell 自己的 browser host，不是 WebUI 耦合点。
- 一行 bottom extension 与显式 dialogue chrome 一旦属于被接受的产品面，就必须能够通过 terminal-2 被 native/Web host 同源观察；native host 不得长期保留一套只有本地可见的 accepted product chrome truth。
- terminal-2 的 screen frame 传输必须采用 dirty signal + client-paced pull：backend 只通知“有变化”，client 在上一帧渲染完成且满足 pacing 后主动拉取；本地 cli-shell 默认固定 30FPS 拉取 viewport-sized row-cache frame，不默认计算 diff；动态刷新只作为显式实验能力，默认关闭；滚轮、滚动条点击/拖动必须先变成 backend viewport 事件，不能把本地 viewport override 塞进 `pullFrame` 里，也不能把 viewport 输入同步转成 `frameDirty` / pull 激活器。
- 离屏 backend frame 投影必须作为一个统一组件封装 cells 绘制、selection、OSC52 copy action、paste input bridge、scrollbar 与 keyboard/mouse 事件桥接；复制的统一出口是 OSC52，文本粘贴是 host paste event 到 backend input 的输入桥接，富媒体粘贴必须先成为 MIME-aware media paste fact，再进入 room asset / attachment 路径或显式 unsupported 状态，不得被当作普通文本写进 shell stdin；具体由哪个快捷键触发属于上层 keybinding 策略，不得把 selection 或 paste 语义散落在产品入口里。
- terminal-like 交互事实必须归属于 backend/offscreen renderer owner：shell owner 与 dialogue owner 各自拥有 selection、copy、semantic word/line selection、cursor、wrap、scroll 与 overlay truth；OpenTUI projection 只负责捕获事件、映射 owner 坐标、发送 backend interaction message、重放 backend cells/overlays，并可额外投影 scrollbar/focus/click 控件。OpenTUI 不得长期保存 selected text、selected range 或 word/line selection 语义作为 terminal truth。
- cli-shell 的离屏终端交互增强必须是 product-local 可配置能力：双击选词、三击选行、Option+Left/Right 跳词、Home/End fallback、输入后跟随光标等能力默认不硬覆盖 backend；产品通过 backend 推荐配置只启用缺失能力。词边界统一使用 ICU `Intl.Segmenter` 与 `Bun.stringWidth` 的 terminal column 映射，不能退回 ASCII 空格切分。
- managed mode 只是 room-bound hosting attention；positive `hosting` 不等于隐式 terminal write privilege，也不会创建 product delegation、terminal write lease 或 permanent writer grant。
- TUI 的第一原则是 terminal-first：默认只占用一行底部 toolbar，显式对话面板是附加 extension chrome，不得退化成多 terminal dashboard，也不得把 bottom 重新用成多行 transcript surface。
- bottom extension 只负责投影 heartbeat / status / product actions，不得接管 terminal scrolling、cursor semantics、terminal lifecycle truth 或 shared viewport truth。
- visible `Avatar started` 只能表示 terminal-1 的 LoopBus observation 已经就绪；本地 heartbeat placeholder 或 runtime bootstrap 本身都不足以构成该 readiness truth。
