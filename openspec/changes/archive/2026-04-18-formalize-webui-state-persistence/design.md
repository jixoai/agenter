## Context

当前 WebUI 对 durable state 还没有一个统一的平台法则。相同类别的状态分散在三种地方：

1. 纯内存 `$state`
2. feature-local `localStorage`
3. 后端 durable truth（settings、runtime publication、catalog/resource）

这导致两个问题同时出现：

- 一些真正有跨设备价值的 UI 状态还停留在浏览器本地，例如 running-avatar pins。
- 一些本来只是设备本地投影的状态，例如 open tabs，又容易被误判成“应该统一同步”的东西。

与此同时，avatar create flow 已经暴露出另一类更难的问题：它并不是一个简单 preference，而是一个带生命周期的 draft。现在 draft id、tab 元数据、表单内容混在浏览器本地状态里，无法形成真正可恢复的 durable resource。

本次 change 的约束是：

- 不把 WebUI state 硬塞进 settings graph。
- 不把纯 UI state 镜像进 runtime snapshot。
- 不把 draft 继续塞进 opaque KV。
- 保持前端 feature code 的接入成本足够低，避免每个 feature 自己手搓 trpc + subscribe + storage plumbing。

## Goals / Non-Goals

**Goals:**
- 定义 WebUI state ownership 的四层法则：`memory`、`client-local persistent`、`server-synced KV`、`draft resource`。
- 以“跨设备同步是否有价值”作为 client-vs-server 的唯一判断标准。
- 将 running-avatar pins 迁移到 actor-private server KV。
- 明确 workbench open tabs 继续作为 device-local projection，不做统一跨端 tab strip。
- 将 avatar create flow 升级为 first-class draft resource，并让 route/form 以 draft resource 为 truth source。

**Non-Goals:**
- 不在本阶段把所有现有 `localStorage` helper 一次性迁走。
- 不在本阶段重构 settings graph 或 global workspace settings surface。
- 不在本阶段为所有 create/edit flows 一次性接入 draft resource。
- 不在本阶段做多客户端协同编辑；draft 更新先按单作者 last-write-wins 处理。

## Decisions

### 1. WebUI state ownership 固定为四层，而不是“localStorage vs server”二分法

先判断是否需要持久化，再判断跨设备同步是否有价值：

- `memory`: 只影响当前挂载期 UI 读态，例如 Heartbeat compact/detailed
- `client-local persistent`: 需要跨刷新但不值得跨端同步，例如 open tabs、split ratios、local panel mode
- `server-synced KV`: 值得跨端同步、但仍然只是简单 UI preference/collection 的状态，例如 running-avatar pins
- `draft resource`: 具有独立生命周期、可恢复、可删除、可完成的长寿命表单/创建流状态

Alternative considered:
- 继续按“状态大就上服务端，小就留前端”做经验式判断
  - Rejected，因为这没有 durable 的判断标准，后续一定继续漂移。

### 2. 服务端简单 UI 状态继续使用独立 auth-scoped KV plane

已经落地的 auth-scoped KV plane 继续作为 server-synced simple UI state 的唯一平台入口。后端只理解 actor-private 分区、opaque key namespace、snapshot/set/delete/events；它不理解具体业务 scope。

首批 key namespace 采用固定前缀：

- `webui/avatars/pinned-runtime-ids`

后续如果接入更多 server-synced simple UI state，继续沿同一 namespace law 扩张，而不是让 feature 自己建新表或塞进 settings。

Alternative considered:
- 把 synced UI state 合并进 settings graph
  - Rejected，因为 settings 是 durable config truth，不是 UI projection truth。
- 把 synced UI state 直接混进 runtime publication
  - Rejected，因为 runtime snapshot 不应承载 actor-private UI chrome state。

### 3. Workbench tabs 明确保持设备本地投影

Tabs 参考 Chrome 桌面版和移动版的思路处理：底层资源可以跨端存在，但 open-tab strip 本身不做统一同步。这样 desktop 和 mobile 可以保留完全不同的阅读上下文和 density，而不互相覆盖。

因此本次不把 `avatar session tabs`、`workspace tabs`、`avatar create tabs` 迁进 server KV。它们继续走 client-local persistence，只是和 durable resource truth 解耦：

- tab list 只表达“本设备当前打开了什么”
- resource/draft truth 由后端控制

Alternative considered:
- 把所有 tabs 全量同步到 server KV
  - Rejected，因为这会把设备本地阅读上下文误建模成 actor-global truth。

### 4. Draft 必须升格为 first-class resource，而不是放进 KV

Draft 与 KV 的根本区别是：draft 拥有稳定 identity、kind、生命周期和删除/完成语义。它不是一条匿名 preference。

因此新增独立的 auth-scoped draft resource plane：

- stable `draftId`
- typed `kind`
- typed `state`
- `version` / `createdAt` / `updatedAt`
- `create` / `get` / `list` / `save` / `delete`
- optional event replay/subscription for future resume surfaces

第一阶段只实现 `avatar_create` kind，并让 avatar create route 的 nickname/source fields 以该 resource 为 truth source。

Alternative considered:
- 用 KV key `webui/avatars/drafts/<id>` 存 draft
  - Rejected，因为 draft lifecycle、listing、completion、discard 都会退化成 feature 自己拼 key 的胶水代码。

### 5. WebUI 接线提供共享 source/client，而不是让每个 feature 直连 TRPC

为了避免 feature 代码里反复复制 `snapshot + subscribe + normalize + retry`，前端新增共享 persistence adapters：

- auth KV source: 固定 key、负责 hydrate / subscribe / save
- draft client: 负责 create/get/save/delete avatar-create draft

feature 只保留本地 normalize 和 UI transition，不直接编排 transport 细节。

Alternative considered:
- 让每个 Svelte route 直接写自己的 trpc 调用和 websocket subscription
  - Rejected，因为这会重复制造 transport glue，破坏 state law 的统一入口。

## Risks / Trade-offs

- [Risk] draft resource 虽然支持跨端 resume，但第一阶段还没有“draft inbox/list”入口。 → Mitigation: 先让 route id 与 local tabs 解耦，后续再补 list surface。
- [Risk] open tabs 继续本地化，可能让某些用户期待“跨端继续同一个 tab strip”。 → Mitigation: 明确 tabs 是 device-local projection，真正需要同步的是 resource truth 与 pinned collections。
- [Risk] 第一阶段 draft save 采用单作者 last-write-wins，两个设备同时编辑时可能出现覆盖。 → Mitigation: 资源层保留 version 字段，为后续冲突提示或 optimistic concurrency 留接口。
- [Risk] 如果继续保留大量 feature-local `localStorage` helper，法则容易再次漂移。 → Mitigation: 后续把剩余 client-local persistent state 收敛到统一 local KV/source primitive。

## Migration Plan

1. 固化 OpenSpec：state ownership、tabs local projection、draft resource lifecycle。
2. 在 app-server 增加 auth-scoped draft resource store，并暴露 typed TRPC contract。
3. 在 client-sdk 增加 auth KV 与 draft resource 的共享 client methods。
4. 在 WebUI 增加共享 persistence adapters。
5. 迁移 running-avatar pins 到 server KV。
6. 迁移 avatar create flow 到 draft resource，同时保留 avatar create tabs 为 device-local projection。
7. 补 targeted tests，覆盖 auth-scoped draft store、TRPC contract、pins sync、avatar draft resume。

## Open Questions

- 后续是否需要一个显式的 draft inbox/list surface，让跨设备创建的 draft 在另一台设备上可发现。
- 当更多 create/edit flows 接入后，draft kind schema 是否需要从应用层 union 继续提升为独立注册表。
