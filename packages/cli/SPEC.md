# @agenter/cli SPEC

> 本文件记录 `@agenter/cli` 的长期职责与边界。

## 1. 角色

`@agenter/cli` 是 `agenter` binary 的 app-agnostic launcher 与本机 bootstrap 入口：

- 负责 `daemon`、`auth-service` 等 core bootstrap 入口的启动编排
- 负责 first-party app command descriptor registry 与 launcher env contract
- 负责在需要时确保本机 daemon / auth-service authority 并把上下文传给子进程
- 负责通过 descriptor 启动 `shell`、`studio` 等生态 app 命令，但不拥有这些 app 的 UI 生命周期

## 2. App Command Launcher Law

- app command 只能通过受控 descriptor 解析到 first-party package；不得把用户输入当成任意 npm package 名执行。
- launcher 只拥有 descriptor lookup、package resolution、stdio/exit propagation、daemon/auth context 注入；不得解析 app grammar，也不得 import app implementation。
- `studio` 是 descriptor-driven app command，解析到 `agenter-app-studio` / `agenter-studio` / `runStudio`；Studio-specific flags、static serving 与 dev serving 都属于 `agenter-app-studio`。
- `web` 不再是 core built-in、app alias 或兼容 shim；`agenter web` 必须走 unsupported-command 路径。
- `tui` 已从 live product surface 退役；`agenter tui` 必须走 unsupported-command 路径，而不是任何隐藏 built-in、descriptor 或 backup package fallback。
- CLI package 不拥有 active Studio static asset root、Vite dev-server startup 或 asset-copy pipeline。
- app package resolution 固定遵守 `workspace > installed package > configured remote runner`。
- launcher 创建的 app 进程必须以前台交互模式运行，继承当前 shell-terminal 的 stdio，并传播原始退出码。
- app command launcher 只负责确保或复用当前 runtime home root 的 managed daemon authority；app 前台进程退出不得停止 daemon 或 daemon-owned resources。daemon 关闭只属于显式 `agenter daemon stop` / `restart` 生命周期动作。
- `shell` 是正式 Shell app 入口，固定解析到 `agenter-app-shell` / `agenter-shell` / `runShell`；旧 incubation 入口 `shell2` 不再是 app command，必须走 unsupported-command 路径。
- 本机 loopback auto-start 路径必须以 runtime home root 为单一 daemon authority discovery 作用域：先复用健康的 same-root daemon descriptor，再决定是否启动新的本地 daemon；app 不得自建第二套 daemon 发现真源。
- `agenter daemon` 必须支持显式 `start` / `stop` / `restart` 生命周期动作；默认动作是 `start`。
- `agenter daemon start` 必须只负责为当前 runtime home root 拉起后台 daemon、等待健康并立即把控制权还给调用终端；真正长期运行的 server 必须在独立后台进程中承载。
- `stop` / `restart` 只允许操作当前 runtime home root 通过 descriptor 发现到的 daemon authority；CLI 不得跨 home root 猜测或扫描别人的 daemon。
- 当同一 home root 上的 descriptor 已经指向健康 daemon，`start` 必须复用并直接返回，而不是再启动第二个 writer。
- daemon descriptor 与 `/health` 必须暴露 launcher identity（package、version、source kind、entrypoint/source id），让 CLI 能判断自己是否正在连接同一套启动来源。
- app launcher 与 core TUI 在复用 daemon 前必须校验 launcher identity compatibility；同一 package/version/sourceKind 的 workspace checkout 或 worktree 可复用同一 runtime home root daemon，但 package 版、workspace 版、不同版本或旧 daemon 缺少 identity 时必须给出明确错误并要求用户用当前命令执行 `agenter daemon restart`，不得静默连到错误 server。
- legacy descriptor 只能作为 stop/restart 的定位事实使用；缺少 identity 的 daemon 不得作为 app runtime authority 被复用。
