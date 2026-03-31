## Why

当前 WebUI 仍然是 `Quick Start + Workspaces + GlobalSettings + Running Sessions` 的 session-first 壳层，而用户要的已经是 `Chats / Terminals / Workspaces` 三个全局入口，加上一个围绕 Avatar 运行态组织起来的 secondary runtime rail。若不先把 workspace/global/runtime shell 的法则改写清楚，`auth`、`room`、`terminal` 三个 focused changes 落地后，前端路由、settings 分层、client runtime state 仍然会继续被旧页面模型拖住。

## What Changes

- **BREAKING** 移除 WebUI 中独立的 `Quick Start` 与 `GlobalSettings` 一级页面，统一收口到 `Workspaces`。
- **BREAKING** 把 `~/` 定义为 special global workspace；普通 workspace 默认继承它，UI 可以先隐藏 `extends` 字段，但 contract 必须支持该继承法则。
- 把 QuickStart 改写成 `Workspaces / Welcome` 里的 Avatar 启动编排器：选择或创建 Avatar、选择 global room / terminal 资源、配置角色与权限，并允许跳去 `Chats` / `Terminals` 创建资源后再返回继续。
- **BREAKING** `Running Sessions` 改名为 `Running Avatars`；同一 `workspace + avatar` 再次启动时，直接切回既有 session，不再创建重复 session。sessionId 需要稳定锚定到该 pair。
- `Workspaces` 固定保留 `Welcome` 与 `History` 两个入口；其余 tab 都是 workspace-scoped tabs，至少包括 `Settings` 与 `Avatars`。
- **BREAKING** Avatar 默认值改成 `default`，默认目录是 `.agenter/avatar/default`。
- regular workspace 修改 global Avatar 时，先完整复制一份到当前 workspace，再在复制体上修改，不做细粒度 overlay。
- attention detail 增加“跳转到来源”能力；当来源可解析为 room / terminal 时，用户可以直接跳回对应页面。
- settings graph 正式区分 shared / local：默认 Avatar 与 workspace/global 设置写入 `settings.json`；私钥、JWT、auth token 和本机敏感覆盖写入 workspace/global 的 `settings.local.json`；room / terminal 的 seat credential 则写入目标 Avatar 自己目录下的 `settings.local.json`。room / terminal 的真源和权限仍然留在各自系统里，Welcome 只保存它们的引用、当前 access state 与启动意图。
- running-avatar detail shell 默认页改成 `Attention`，并把原 Devtools 内部 tabs 与 `Settings` 打平成同一层 runtime tabs；`Cycles` tab 需要显示当前正在跑的轮次角标与运行呼吸态。
- `TaskSystem` 继续暂时剥离，不纳入本次 shell change。

## Capabilities

### New Capabilities
- `quickstart-avatar-orchestration`: Workspaces Welcome 中的 Avatar 启动编排器、返回流、去重启动与持久化引用。
- `workspace-avatar-management`: global/workspace Avatar 目录、复制分叉、默认 Avatar 与启动入口。
- `workspace-runtime-shell`: running-avatar detail shell 与 runtime-only panels。
- `attention-source-navigation`: attention detail 到 room / terminal source 的跳转能力。

### Modified Capabilities
- `webui-chat-navigation`: 一级导航改成 `Chats / Terminals / Workspaces`，并把 `Running Avatars` 定义为 secondary runtime rail。
- `workspace-shell-session-rail`: secondary rail 从 running sessions 改成 running avatars，并更新 desktop/mobile 导航契约。
- `workspace-chat-surface`: 直接 session chat 不再是 primary workspace surface。
- `workspace-devtools-surface`: Devtools 内容不再埋在二级 tabs 里，而是打平成 runtime detail shell 的 peer tabs。
- `workspace-resource-ownership`: workspace shell 只持有绑定、投影和 draft，不再把房间/终端真源当作 route-local 资源。
- `workspace-settings`: global workspace、默认继承、shared/local 分层与 source/view workbench 收口到同一模型。
- `global-user-settings`: user-level settings 不再是独立一级页面，而是 global workspace 的一部分。
- `client-runtime-store`: client state 改成 workspaces / running avatars / orchestration draft / global resources first。

## Impact

- Affected packages: `app-server`, `settings`, `avatar`, `client-sdk`, `webui`.
- Affected storage/contracts: `~/.agenter/settings.json`, `~/.agenter/settings.local.json`, workspace `.agenter/settings*.json`, avatar-local `settings.local.json` under `~/.agenter/avatar/*/` or `<workspace>/.agenter/avatar/*/`, workspace avatar roots, stable session identity by `workspace + avatar`, room/terminal references without workspace ownership.
- Verification: app-server integration tests, client runtime-store coverage, Storybook DOM tests for Workspaces/Welcome/Running Avatars, browser walkthrough for `Chats / Terminals / Workspaces`.
