# Agenter SPEC

> 本文档只记录仓库级长期有效的系统法则、正交边界与 durable contract。
> 进行中的变更看 `openspec/changes/*`，能力级规格看 `openspec/specs/*`，包级长期细节看 `packages/*/SPEC.md`。

## 0. 文档角色

- `SPEC.md`：项目级 durable spec，只保留长期成立的规则。
- `packages/*/SPEC.md`：对应包的长期职责与公共契约。
- `openspec/changes/*`：进行中的 change proposal / design / tasks / delta specs。
- `openspec/specs/*`：已经沉淀出的 capability spec。
- `TASKS.md`：已退役，不再作为真源。

## 1. 项目定位

Agenter 是一个 attention-first 的 Agent runtime platform。

它的目标不是把更多业务规则硬编码进单个 agent 类，而是提供一套稳定的底层法则，让 message、terminal、task、future browser/os 等 source adapter 都能在统一 runtime 中演化，并最终通过 attention 驱动模型决策、工具执行与状态收敛。

## 2. 平台法则

- Attention 是内核语义货币。外部熵增必须先被表达为 attention debt，再决定是否进入下一轮模型调用。
- LoopBus 是持续存在的 runtime core。它负责等待输入、收集输入、持久化 cycle、调用模型与协调 adapter side-effects，但不拥有 source-specific 业务语义。
- Session DB 只存事实，不存可推导快照。projection、view model、UI 结构都属于派生层。
- Room 历史的 durable truth 属于全局 `message-system`；session 只保留 room binding、message refs 与推理所需 projection facts，不复制 room history 当作自己的真源。
- Room 文本消息对人类 transcript 默认立即可见；`attentionState=queued` 只表示它仍欠 AI/automation attention，不再表示“先隐藏，等 attention 后再显示”。
- Room 级 read progress / read receipt 的 durable truth 属于全局 `message-system`，并按 actor seat 维护，而不是退化成 session unread badge。
- Terminal truth、grant、approval、lease、activity history 的 durable truth 属于全局 `terminal-system`；session 只保留 terminal binding、focus refs、approval subscription 与推理所需 projection facts，不复制 terminal history 当作自己的真源。
- Terminal focus truth 属于 actor-scoped seat state；inspection tab、UI 选中态、以及别的 actor 的 focus 都不能被错误投影成当前 session actor 的 terminal attention 输入。
- WebUI 的用户可见滚动所有权必须统一委托给共享 `ScrollView` 原语；feature code 不得再直接以 raw `overflow-auto/scroll` 充当主滚动 owner。
- Search / FTS index 只能是可重建 projection，不能升级成 durable truth；删除索引后系统仍必须能从事实库或 attention durable state 重建搜索能力。
- Attention search 的默认面向未完成工作，但显式 `score/hash` 查询属于历史事实定位：普通文本默认 active-only，`score:` / `hash:` 若未显式提供 `minscore`，默认应包含历史提交。
- Cancellation、stop、abort、timeout 必须共享同一套显式语义，并持久化为事实。
- Provider 请求保持纯度。HTTP/model body 只表达真实 provider 参数，循环事实进入 `session_cycle` / trace。

## 3. 正交设计边界

- `message-system`、`terminal-system`、`task-system`、未来的 `browser-system` / `os-system` 都是 source adapter，不得把自己的私有语义硬编码进 LoopBus core。
- `AgenterAI` 是 attention-first decision engine，不应直接绑定 terminal/task 等 source-specific gateway、payload 结构或 stage 语义。
- source adapter 与内核只通过协议、hook、tool provider、attention commit、message dispatch 这类明确边界协作，不能跨层偷写规则。
- Auth identity 与 Avatar/business role 永远分层：auth 只表达“谁可以认证并持有授权声明”，Avatar 只表达 workspace/session 的业务角色与提示词行为。
- `profile-service` 是 durable profile identity、proof-bearing auth 与 icon/media fallback 的 canonical owner；`app-server` 只负责 child-runtime 生命周期与 endpoint 发现，`client-sdk`、`webui` 必须直连该 service 的公开接口，不能重新引入第二套本地 authority。
- room / terminal seat credential 属于 Avatar seat 的本地状态，而不是 workspace root state；它们必须落在目标 Avatar 自己的 `settings.local.json` 中。
- 新能力优先以“新增原子 + 复用平台法则”的方式接入；当现有法则无法优雅容纳时，应优先升级法则，而不是补 source-specific glue。

## 4. Durable Runtime Contract

- LoopBus phase 固定为：`waiting_commits -> collecting_inputs -> persisting_cycle -> calling_model -> stopped`。
- `waitCommitted(fromHash)` 风格的等待必须清理 race losers，避免 waiter / listener 泄漏。
- `score > 0` 只表示义务仍然存在，不表示允许无限重试；重复等价失败必须进入 containment / backoff，直到新证据或人工干预。
- Context compact 是强制的内核能力；它只重写 bounded `promptWindow`，可以丢弃已完成噪音，但不得丢弃未完成 attention debt 或 durable facts。
- 用户可见回复与内部推进必须分离：attention/internal activity 不自动等于 user-visible reply。

## 5. 产品表面长期法则

- 一级导航固定为 `Workspaces`、`History`、`Messages`、`Terminals`、`Settings`。
- `Workspaces` 是统一的 global/workspace shell；`Quick Start` 是该路由中的启动编排区，不再是独立主路由。
- `History` 是全局 workspace 历史索引页，只列出已有启动记录的 workspace，并支持按最近使用、路径、名字排序。
- `Messages` 是 `message-system` 的全局 surface；其中 `room` 是当前聊天 channel 的承载概念，不能把 `room` 与 `chat`、`message-system` 混为一个概念。
- `Terminals` 是 `terminal-system` 的全局 surface；右侧固定表达 `Actions + Users` 两类事实，focus 永远属于 seat，而不是 terminal 对象本身。
- `Settings` 同时承担超级管理员入口、root key 绑定、profile 编辑和全局身份管理；壳层 footer 中的 profile 入口只是一条通往这里的导航。
- `~/` 是 special global workspace。canonical avatar catalog 与用户级默认配置通过它暴露，但 room / terminal 自身不从属于 workspace。
- `Quick Start` 是 Avatar 启动编排器，而不是“发第一条消息”的快捷页；它持有 workspace、avatar 与未来可扩展的全局系统引用，并在用户 detour 到 `Messages` / `Terminals` 后继续保留当前草稿。
- `Running Avatars` 是 secondary runtime rail。进入单个 avatar 后，默认页固定为 `Attention`，runtime tabs 在同一层打平，`Chats` / `Terminals` 只作为 link-out 的全局资源页存在。
- `workspace + avatar` 是 durable active-session identity；再次启动同一 pair 时必须复用同一个稳定 session id，而不是创建重复 session。
- `default` 是默认 avatar nickname，也是永远可见的空白起点；regular workspace 修改 global-source avatar 时，先完整复制再修改，不做 overlay 式局部覆盖。
- Chat 是 conversation-first surface；cycle、tool trace、attention runtime 属于 Devtools / inspector surface。
- `Terminals` 是 app-level global workbench，不是 session-private surface；session route 只允许链接或投影该工作台，不能重新定义第二套 terminal truth。
- Devtools 是技术事实的独立检查面板，不把技术结构反向污染主聊天流。
- regular workspace 与 global workspace 共用同一套 settings API shape：shared defaults 落到 `settings.json`，machine-local secret 落到 workspace/global `settings.local.json`，Avatar seat 的 room / terminal credential 落到 avatar-local `settings.local.json`。
- Session icon 与 profile/avatar icon 必须通过 profile-service 的语义 URL 消费，fallback 由服务端统一解析（uploaded asset > eligible external fallback > deterministic renderer），默认读返回服务端光栅化结果，前端不得再承担 fallback rasterization authority。
- 桌面端与移动端都是一等验收对象；能力必须双端可达，但导航结构可以不同。

## 6. 测试与验收法则

- 默认工程实践是 BDD-first；TDD 是落地手段，不是替代行为描述。
- 关键链路改动必须有 integration 或 e2e 证据；WebUI 复杂交互优先 Storybook DOM contract。
- 真实流程优先于主观推断；对模型、终端、runtime 的判断必须先跑证据链。
- durable 行为变化的完成标准包含：实现、测试、SPEC/AGENTS 同步，而不是只看代码通过。

## 7. 变更纪律

- 任何改变平台法则、系统边界、durable contract 的实现，在 archive OpenSpec change 之前必须同步更新 `SPEC.md` 或对应包级 `SPEC.md`。
- `SPEC.md` 保持精简，不记录短期任务、阶段性收口状态、执行流水账。
- 若 `openspec/changes/*` 与 durable spec 不一致，以“先补 durable spec，再 archive”为强制流程。
