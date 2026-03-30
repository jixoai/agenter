## Context

现在的代码和 durable specs 仍然默认以下几条旧法则：

- `Quick Start` 是独立一级页面；
- `GlobalSettings` 是独立一级页面；
- `Running Sessions` 是围绕 sessionId 的 secondary rail；
- workspace 更像“会话容器”，而不是全局资源与运行态编排器的宿主；
- QuickStart 的 bootstrap 还停留在 `chat-main + boot terminals` 的 session-first 设计。

但用户要的画面已经变了：

- 一级导航固定为 `Chats / Terminals / Workspaces`；
- `~/` 是 special global workspace；
- `Workspaces` 要吸收 Welcome、全局设置、workspace 设置、avatar 管理；
- QuickStart 不再只是“发第一条消息”，而是一个围绕 Avatar、room、terminal、权限、角色的启动编排器；
- `session = avatar + workspace`，同一 pair 再次启动时必须复用，而不是复制。
- room 与 terminal 仍然是各自独立的 global systems，可以跨多个 workspace 的 AvatarSession 一起协作，不能重新退化成 workspace 资源。

## Goals / Non-Goals

**Goals:**
- 把 `Workspaces` 定义成新的 shell 聚合面，而不是旧 Quick Start 的替身。
- 让 `~/` 成为 global workspace 的正式 contract，并让普通 workspace 默认继承它。
- 明确 shared / local settings 分层，以及哪些编排数据必须持久化。
- 定义 Avatar 目录、默认 Avatar、session 去重与 running-avatar detail shell。
- 明确 workspace 只消费 room / terminal 引用，不拥有它们的 durable truth。
- 为 attention -> room/terminal 跳转补齐正式导航 contract。

**Non-Goals:**
- 不在这个 change 里定义 auth challenge / JWT 细节；这些由 `auth-control-plane-vnext` 负责。
- 不在这个 change 里定义 room / terminal 的 durable truth；这些由 `global-room-control-plane-vnext` 与 `global-terminal-collaboration-vnext` 负责。
- 不在这个 change 里引入 `TaskSystem` 的全局协作 UI。
- 不在这个 change 里规定 running-avatar detail shell 的每一个像素级布局。

## Decisions

### 1. `Workspaces` 成为统一的 global/workspace shell

- 一级导航只保留 `Chats`、`Terminals`、`Workspaces`。
- `Workspaces` 自身承担三类职责：
  - `Welcome`：启动编排器与最近运行态入口；
  - `History`：workspace/history session 浏览；
  - workspace-scoped tabs：至少包含 `Settings`、`Avatars`。
- `~/` 作为 special global workspace，使用同一套 detail shell，而不是继续单独保留 `GlobalSettings` 一级页面。

为什么：
- 用户已经明确要求把 Avatar、GlobalSettings/Workspace、QuickStart 融成一个面。
- 若继续保留独立 `GlobalSettings`，会让“global workspace”这条法则从第一天就失真。

备选方案：
- 保留 `GlobalSettings` 一级路由，只在 Workspaces 里加 `Avatars`。
- 放弃，因为这会让 global 与 workspace 的继承关系在 UI 上继续断裂。

### 2. 普通 workspace 默认继承 `~/`

- `~/` 的设置图谱是所有普通 workspace 的默认基线。
- UI 第一版可以不暴露手工修改 `extends`，但 settings graph 与 provenance 必须把该继承当作正式事实。
- global workspace 与普通 workspace 使用同一套 `Settings` API shape、同一套 source/view workbench。

为什么：
- 用户已经明确要求把 global 看成 special workspace，而不是独立的配置宇宙。
- 这能让 settings graph、avatar sources、默认 topology 共用一套法则。

备选方案：
- 继续区分“global settings API”和“workspace settings API”。
- 放弃，因为这会迫使 client/webui 维护两套 shape 和两套跳转语义。

### 3. QuickStart 改写成可往返的 Avatar 启动编排器

- `QuickStart` 嵌入 `Workspaces / Welcome`，不再是 standalone 一级页面。
- 编排器最少需要以下状态：
  - workspace；
  - avatar（选择已有或创建新 avatar）；
  - global room 引用；
  - global terminal 引用；
  - room/terminal 的角色与权限配置。
- 若缺 room 或 terminal，用户可以跳去 `Chats` / `Terminals` 创建，再回到 `Welcome` 继续当前 draft。
- 这些 draft 必须跨 primary-view navigation 保留，直到成功启动、成功附加、或用户显式清空。
- `Welcome` 的 room / terminal 列表直接复用当前 global catalog 的顺序；每一项的 access state 由当前 AvatarSession 的本地凭证校验结果派生，至少区分 `joined`、`available`、`credential-invalid`。

为什么：
- 用户已经明确说过：“如果没有房间或者合适的 terminal，就去 Chats / Terminals 配完再回来。”
- 如果 draft 不跨页面保留，这个流程在 UX 上就会塌掉。
- 但 room / terminal 本体仍然属于各自系统，Welcome 只是在编排“让谁去加入哪个 global resource”。

备选方案：
- QuickStart 只负责启动，不负责资源往返与权限草稿。
- 放弃，因为这会把用户真实的编排路径打碎成多个彼此不连续的小页面。

### 4. room / terminal 是 global systems，不是 workspace 拓扑

- room 和 terminal 的 durable truth、命名、权限、在线状态都留在各自系统。
- `Workspaces / Welcome`、running-avatar detail shell、attention jump 都只能持有稳定 id/ref，不得把它们建模成 workspace 所属资源。
- 多个不同 workspace 的 AvatarSession 可以共同加入同一个 room，也可以共同围观或协作同一个 terminal。

为什么：
- 用户已经明确纠正过：message-system 与 terminal-system 是独立软件，不和 workspace 建立所有权关系。
- 若这里说错，后面 settings、QuickStart、runtime-store 都会重新长回 session/workspace 私有资源的老路。

备选方案：
- 把 room/terminal 默认关系写成 workspace 拓扑。
- 放弃，因为这会让“跨项目 Avatar 一起开会/一起围观同一个 terminal”变成反直觉的例外。

### 5. session 唯一键改成 `workspace + avatar`

- active session 的唯一键是 `workspacePath + avatarNickname`。
- sessionId 仍然表现为 UUID，但实现上采用基于 `workspacePath + avatarNickname` 规范化后的 deterministic UUID（优先 `uuidv5` 或等价稳定 hash 映射），而不是每次都创建新的随机身份。
- 用户再次启动同一 pair 时：
  - 不新建 session；
  - 直接切回已有 running/stopped session；
  - 若这次带了新的 room/terminal 引用，则把它们作为加入动作统一应用到该 session。
- 默认 Avatar 名字固定为 `default`，默认目录固定为 `.agenter/avatar/default`。

为什么：
- 用户已经明确给出 `session = avatar + workspace`，并要求重复启动时切换到既有 tab。
- 用户也明确要求 session root 在全局存储下仍然能稳定对应这同一 pair。

备选方案：
- 保留当前“每次启动都新建 session”，只在 UI 层做重名提示。
- 放弃，因为这仍然违背用户定义的 session 身份法则。

### 6. shared / local settings 按“共享设置 vs 本机敏感信息 vs Avatar seat credential”分层

- `settings.json` 存 shared settings：
  - 默认 Avatar；
  - workspace/global workspace 的设置结果；
  - 可以跨机器共享的默认视图或配置。
- workspace/global workspace 的 `settings.local.json` 存 machine-local/sensitive data：
  - 私钥；
  - JWT / auth token；
  - 不应跨机器共享的覆盖项。
- room / terminal 的 seat credential 不写进 workspace 根部的 `settings.local.json`，而是写进目标 Avatar 自己目录下的 `settings.local.json`：
  - regular workspace: `<workspace>/.agenter/avatar/<avatar>/settings.local.json`
  - global workspace (`~/`): `~/.agenter/avatar/<avatar>/settings.local.json`
- 即使 regular workspace 仍在直接使用 global-source Avatar、尚未 fork 出共享定义，也允许先在当前 workspace 的 avatar 目录里创建这个本地 seat credential 文件。
- 若某个 room / terminal credential 校验失败，系统默认保留原始 credential，并在同一 Avatar-local 文件里把它标记成 `credential-invalid`；第一版不自动清除旧 token。
- room / terminal 的真源、成员关系、权限、是否仍然存在，都不写进 workspace ownership 模型；若 Welcome 需要持久化引用，也只能保存 stable id/ref、当前 access state 与启动意图，而不是冒充资源归属。

为什么：
- 启动编排器天然会遇到“有些东西该同步、有些东西不该同步”的边界。
- 若不在 spec 里写死，后续实现极易把 token、私钥误写进 shared layer。

备选方案：
- 所有 QuickStart 配置都写入 shared，敏感值由调用方自觉避开。
- 放弃，因为这不是平台法则，而是危险的使用约定。

### 7. Avatar 的 workspace 修改走“完整复制后分叉”

- global workspace 里的 Avatar 是 canonical source。
- regular workspace 可以直接使用 global Avatar。
- 当用户在 regular workspace 中修改一个 global Avatar 时，系统先完整复制一份到当前 workspace，再对复制体做修改。
- 第一版不做细粒度 `extends/override` 叠加。

为什么：
- 用户已经明确回答：当前要完整复制，这样兼容性最好，也最简单。
- 若现在上 overlay/inherit，会把 Avatar 行为和 settings graph 复杂度一起拉高。

备选方案：
- regular workspace 只保存局部 override，没改的继续回退到 global。
- 放弃，因为这与当前“先把事情做简单、兼容、稳定”的目标相反。

### 8. running-avatar detail shell 只负责 runtime panels

- `Running Avatars` 是 secondary navigation，不是新的 primary navigation。
- 从 rail 或 workspace avatar list 进入 detail shell 后，页面只承载 runtime-specific panels。
- 第一批 peer tabs 至少包括 `Attention`、`Cycles`、原 Devtools 里的技术面板，以及 `Settings`。
- 默认页固定是 `Attention`。
- `Cycles` tab 需要显示当前正在跑的轮次角标；当 session 正在运行时，角标背景色跟最后一个 cycle 类型的图标色一致，并带呼吸态。
- global `Chats` / `Terminals` 不再作为 running-avatar detail shell 的主 tab；若需要看某个 room/terminal，要通过 source jump 或 link out 进入全局页面。

为什么：
- 用户已经明确说过：Chats/Terminals 提到外面之后，session 页面剩下的就是 runtime-oriented 内容，而且默认页仍然要是 Attention。
- 这能把“全局资源浏览”和“单个运行中 avatar 的技术状态”做清楚分层。

备选方案：
- 保留旧的 `/session/:id/chats|terminals|devtools|settings` 四联路由。
- 放弃，因为它会让全局资源页和 session 页继续双轨并存。

### 9. attention source jump 依赖稳定的 source ref，而不是 UI 猜测

- attention detail 上的“跳回来源”按钮只依赖 durable source descriptor。
- 第一批至少支持：
  - room source -> `Chats`，并选中对应 room；
  - terminal source -> `Terminals`，并选中对应 terminal。
- 若 source 已失效或当前不可访问，按钮显示 disabled/不可达状态，而不是静默消失。
- source 失效时，attention 也不能被直接删除；后续应支持把它标成“源不可用”并进入归档流。

为什么：
- 这类跳转一旦靠 UI 猜测，就会在 room/terminal 全局化后迅速失真。
- 明确 source ref 才能让 app-server、client-sdk、webui 各层分工清楚。

备选方案：
- 由前端根据 attention 文本内容做启发式跳转。
- 放弃，因为这既不稳定，也无法做权限和存在性判断。

## Risks / Trade-offs

- [global workspace 的语义路径是 `~/`，但服务端最终处理的是绝对路径] → UI 统一显示 `~/` 作为 semantic id，服务端负责归一化到真实 home 目录。
- [把 QuickStart、Settings、Avatars 融进 Workspaces 可能让单页过重] → 通过固定 `Welcome / History` 与 workspace-scoped tabs 分层，不把所有能力堆进同一滚动面。
- [room/terminal 被误写成 workspace 拓扑] → 所有 shell/spec 文案都必须用 “global resource ref/attachment intent” 语言，而不是 ownership 语言。
- [同一 `workspace + avatar` 复用 session 可能让用户误以为 Start 失败] → UI 必须在成功路径里明确提示“已切换到现有运行中的 Avatar”。
- [完整复制 Avatar 后，用户可能忘了自己改的是 fork 不是 global] → workspace Avatar surface 必须明显标出来源，并提供回到 global source 的入口。
- [running-avatar detail shell 与 global Chats/Terminals 的边界如果说不清，会重新长回双轨路由] → spec 明确 detail shell 只能承载 runtime panels，资源浏览只能去全局页。

## Migration Plan

1. 先完成 shell/spec 层收口，让 `auth`、`room`、`terminal` 三个 focused changes 有统一的 WebUI 落点。
2. 先实现 `~/` global workspace、shared/local settings 分层与 default-avatar contract。
3. 再实现 `Workspaces / Welcome` 启动编排器与 workspace Avatar 复制分叉模型。
4. 再把 running-session rail 改成 `Running Avatars`，并收口默认 `Attention` 的 runtime detail shell。
5. 最后补 attention source jump 与 dual-viewport walkthrough。

## Open Questions

- 无。当前 shell change 对 Welcome 的列表来源、草稿保留方式、Avatar seat credential 落点与 `credential-invalid` 显示语义都已有明确答案。
