## Context

terminal backend 的底层法则已经成立：

- terminal-system 把 `backend` 作为 durable launch truth 持久化。
- app-runtime 可以在 create/reuse contract 中读写 `backend`。
- cli-shell 已经通过 `--backend=ghostty-native` 消费这条平台法则。

现在剩下的不是新范式，而是 `app-server` 的投影断层。runtime/public surface 里有些 terminal 结果带 `backend`，有些没有；有些 mutation schema 可以接受 backend，有些仍然没有开放；remote placeholder terminal 甚至没有一个显式的 backend 占位值。这样会让 client store、browser-authenticated operator、runtime-local descriptor caller 分别看到不同版本的 terminal truth。

因此这次 change 的任务不是再发明 backend layer，而是把现有 terminal-system truth 忠实投影穿过 `app-server`。

## Goals / Non-Goals

**Goals:**

- 让 `app-server` 的 runtime/public terminal surface 全部显式暴露 `backend`。
- 让 runtime-local descriptor schema 与 browser-authenticated tRPC schema 复用同一 backend enum law。
- 保持 backend truth 与 renderer truth 分离，不允许 `resolvedRenderer`/`rendererPreference` 反向污染 backend。
- 用最小实现收口当前残留 diff，并补上相应测试与 OpenSpec delta。

**Non-Goals:**

- 不把 `ghostty-native` 提升为默认 backend。
- 不重做 cli-shell bottom TUI。
- 不引入 Agenter-private backend ownership layer。
- 不实现 `extend-attention-cli-self-evolution-runtime`。

## Decisions

### 1. `app-server` 只做投影，不重定义 backend law

`app-server` 不拥有 terminal backend authority。它只把 terminal-system 已有的 `backend` durable truth投影到：

- runtime terminal view
- runtime terminal create ack
- runtime terminal get-config / set-config mutation
- browser-authenticated global terminal create / set-config
- remote placeholder terminal projection

理由：

- backend authority 已经在 terminal-system。
- 再在 app-server 定义一套 backend 默认、alias 或 renderer 推断，只会制造第二真相。

### 2. runtime-local 与 browser-authenticated schema 共享同一 backend enum

runtime-local tool descriptor 和 browser-authenticated tRPC route 都必须复用 terminal-system 的 backend enum，而不是在 app-server 本地写死字符串联合或额外 alias。

理由：

- schema 是平台法则的一部分。
- create / set-config 都需要同一条 backend validation law。

### 3. remote placeholder 也必须提供显式 backend 占位

当 runtime 需要为 remote seat 构造 placeholder terminal view 时，也必须提供显式 `backend` 字段。当前可接受的占位事实是 `xterm`，因为 remote placeholder 只是最小 hydration truth，不拥有远端 renderer 解析事实。

理由：

- 缺字段会迫使 client 写 `backend ?? "xterm"` 这类 route-local 补丁。
- placeholder 也属于 projection，projection 必须完整而不是半结构化。

### 4. 测试按可观察 surface 收口

这次验收不追求大而全，而是聚焦以下 surface：

- runtime terminal view projection
- managed terminal constructor compatibility
- app-server typecheck / targeted tests
- `bun agenter shell --backend=ghostty-native` 回归不被 app-server surface 改动破坏

理由：

- 变更面集中在 app-server projection。
- 现有 cli-shell / terminal-system 更深层 backend law 已在上一 change 验证过，不应重复铺大测试面。

## Risks / Trade-offs

- `[Projection still omits one call path]` -> 用 runtime/public focused tests 覆盖 create/list/get-config/set-config 四条主要观察路径。
- `[Schema drift between runtime-local and browser-authenticated surfaces]` -> 两边都复用 terminal-system backend enum，避免手写字符串联合再漂移。
- `[Placeholder backend looks too concrete]` -> 保持它只是 projection default，不把 remote placeholder 的 `backend = xterm` 解读成远端 renderer truth。

## Migration Plan

1. 新建 OpenSpec change，明确这是 app-server projection 收口，不是 backend ownership 重构。
2. 补齐 proposal / design / tasks / delta specs。
3. 审计并完成 `app-server` 残留 backend projection diff。
4. 运行 targeted tests 与 `openspec validate ... --strict`。
5. 做一次 `bun agenter shell --backend=ghostty-native` 回归走查，确认 app-server surface 没有破坏既有产品行为。

Rollback:

- 回滚本次 app-server projection commit。
- terminal-system / client-sdk / cli-shell 的 backend law 保持不动，因此 rollback 只影响 app-server surface completeness，不需要做数据迁移。
