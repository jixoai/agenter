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
- 默认 assistant 是 `shell-assistant`；其 prompt 与 memory 初始化固定为 seed-if-missing，且底层 avatar-private 文件保持开放可编辑。
- cli-shell 的 room、terminal、heartbeat、managed state 都必须读取 backend / platform truth；local process memory 不能冒充 reconnect 后的 canonical state。
- cli-shell 必须保留两个 terminal 角色：terminal-1 是唯一 shell truth，terminal-2 是唯一 backend-owned final visible product-terminal truth；native host 与 Web host 都只能消费这套 product law。
- `shell-1` 这类 session key 只是产品会话标识，不是 terminal-1 或 terminal-2 的同义词；它只用来把这两个 terminal 角色绑定到同一个 product session。
- cli-shell 的主表面固定是一个 native `shell-terminal-view` 投影角色；这个 native terminal projection 角色当前可以暂留在 `packages/cli-shell` 内部实现，但它最终解码渲染的是 terminal-2 完整产品面 truth，而不是只渲染 shell rows 再由 native host 额外持有一套 accepted bottom/dialogue chrome 真相。
- cli-shell 的 Web host 通过 `web-terminal-view` 投影 terminal-2；`--web` 只是宿主模式，不是第二套产品身份，也不是第二套 PTY，也不得直接绕过 terminal-2 去附着 terminal-1。
- 一行 bottom extension 与显式 dialogue chrome 一旦属于被接受的产品面，就必须能够通过 terminal-2 被 native/Web host 同源观察；native host 不得长期保留一套只有本地可见的 accepted product chrome truth。
- terminal-2 的 screen frame 传输必须采用 dirty signal + client-paced pull：backend 只通知“有变化”，client 在上一帧渲染完成且满足 pacing 后主动拉取；本地 cli-shell 默认固定 30FPS 拉取 viewport-sized row-cache frame，不默认计算 diff；动态刷新只作为显式实验能力，默认关闭；滚轮、滚动条点击/拖动必须先变成 backend viewport 事件，不能把本地 viewport override 塞进 `pullFrame` 里，也不能把 viewport 输入同步转成 `frameDirty` / pull 激活器。
- 离屏 backend frame 投影必须作为一个统一组件封装 cells 绘制、selection、OSC52 copy action、paste input bridge、scrollbar 与 keyboard/mouse 事件桥接；复制的统一出口是 OSC52，文本粘贴是 host paste event 到 backend input 的输入桥接，富媒体粘贴必须先成为 MIME-aware media paste fact，再进入 room asset / attachment 路径或显式 unsupported 状态，不得被当作普通文本写进 shell stdin；具体由哪个快捷键触发属于上层 keybinding 策略，不得把 selection 或 paste 语义散落在产品入口里。
- terminal-like 交互事实必须归属于 backend/offscreen renderer owner：shell owner 与 dialogue owner 各自拥有 selection、copy、semantic word/line selection、cursor、wrap、scroll 与 overlay truth；OpenTUI projection 只负责捕获事件、映射 owner 坐标、发送 backend interaction message、重放 backend cells/overlays，并可额外投影 scrollbar/focus/click 控件。OpenTUI 不得长期保存 selected text、selected range 或 word/line selection 语义作为 terminal truth。
- cli-shell 的离屏终端交互增强必须是 product-local 可配置能力：双击选词、三击选行、Option+Left/Right 跳词、Home/End fallback、输入后跟随光标等能力默认不硬覆盖 backend；产品通过 backend 推荐配置只启用缺失能力。词边界统一使用 ICU `Intl.Segmenter` 与 `Bun.stringWidth` 的 terminal column 映射，不能退回 ASCII 空格切分。
- managed mode 只是 hosting attention + write-capable delegation projection；positive `hosting` 不等于隐式 terminal write privilege。
- TUI 的第一原则是 terminal-first：默认只占用一行底部 toolbar，显式对话面板是附加 extension chrome，不得退化成多 terminal dashboard，也不得把 bottom 重新用成多行 transcript surface。
- bottom extension 只负责投影 heartbeat / status / product actions，不得接管 terminal scrolling、cursor semantics、terminal lifecycle truth 或 shared viewport truth。
- visible `Avatar started` 只能表示 terminal-1 的 LoopBus observation 已经就绪；本地 heartbeat placeholder 或 runtime bootstrap 本身都不足以构成该 readiness truth。
