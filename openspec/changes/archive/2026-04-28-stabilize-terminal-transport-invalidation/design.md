## Context

这次 terminal 页面卡死，本质上是“一个机械层事件，被上升成了错误的系统层语义”。

当前链路里混淆了三种完全不同的事实：

1. **transport bootstrap / render tick**
   - websocket 刚连上时，需要给 renderer 一份可渲染 snapshot
   - terminal 启动或输出时，也可能伴随 snapshot/status 更新
2. **catalog mutation**
   - terminal 的 identity / presence / focus / grants / listing truth 真的发生了变化
   - 这种变化才应该让 browser 刷新 `terminal.globalList`
3. **renderer fallback hydration**
   - `terminal-view` 需要在 live output 接管前，用 snapshot 快速把 viewport 画出来
   - 但 live 已经稳定后，fallback snapshot 不能继续主导渲染

旧实现的问题是：

- transport 层继续镜像 full snapshot；
- kernel 层把 `snapshot/status` 误判成 `catalogChanged`;
- renderer 层对同几何 snapshot 继续做 reactive 更新。

于是三层叠加成 storm。

## Goals / Non-Goals

**Goals**

- 保持 terminal transport 可冷启动、可恢复、可 render
- 明确 transport truth、catalog truth、renderer fallback truth 的边界
- 让 stopped terminal 在 desktop/mobile 上都能稳定打开
- 用分层测试锁定这条 law，避免以后再出现“render tick 升级成 catalog storm”

**Non-Goals**

- 不重做 terminal route UI 结构
- 不改变 terminal catalog、grant、approval 的 durable owner
- 不把问题转嫁成 browser 端 debounce/缓存补丁

## Decisions

### 1. Transport snapshot 只负责 bootstrap，不负责每一帧 live truth

terminal websocket transport 的正式法则改为：

- connect 后先发一份 bootstrap snapshot，保证 renderer 能立即 hydration；
- live 阶段以 output/status 为主；
- full snapshot 只在几何变化或明确需要重建 viewport 时再发。

原因：

- full snapshot 是昂贵的 fallback truth；
- output/status 才是 live truth；
- 同几何 snapshot 连续发送，只会把 renderer 和上层响应式系统拖入无意义重算。

### 2. Catalog invalidation 只能由 catalog mutation 驱动

`app-kernel` 的 `terminal.surface.updated` 需要严格区分：

- `created/updated/deleted/focus/presence` => `catalogChanged`
- `activity/grants/approvals` => 对应 resource family invalidation
- `snapshot/status` => **不触发** `catalogChanged`

原因：

- snapshot/status 是 live render 层事实，不是 listing/catalog 事实；
- 如果把 render tick 升级成 catalog invalidation，browser 会把 terminal route 退化成“边渲染边全量刷新列表”的架构错误。

### 3. terminal-view 只在 fallback 真有意义时才接受 snapshot

`terminal-view` 需要把 snapshot 当作 fallback primitive，而不是 live 主数据源：

- 首次 live hydration 前：接受 snapshot
- geometry 变化：接受 snapshot
- live 已接管且 geometry 未变：忽略冗余 snapshot，只维护 seq 前进

原因：

- renderer 的真正 live source 是 websocket output；
- reactive `snapshot` 属性继续抖动，只会制造 Lit 更新风暴和 xterm reset 风险。

## Rejected Alternatives

### 1. 只在 browser 端给 `terminal.globalList` 做 debounce

Rejected.

这会掩盖症状，但保留错误的法则：render tick 仍被当成 catalog mutation。问题会换个入口继续爆。

### 2. 继续允许 transport 推 full snapshot，再让 terminal-view 自己“更聪明”

Rejected.

如果底层 transport 仍不断发送昂贵帧，renderer 再聪明也只是被动止血，transport contract 依然错误。

### 3. 把问题解释成数据库 schema 缺陷

Rejected.

这次核心不是 terminal durable truth 存储错误，而是事件语义分层错误：机械帧、catalog invalidation、renderer fallback 被串成了一条错误的反馈回路。

## Acceptance Strategy

### 1. Layered regressions

- `terminal-system`: 证明 transport connect 后保留 bootstrap snapshot，但 output 期间不会继续刷同几何 full snapshot
- `app-server`: 证明 stopped terminal 的 live snapshot/status 更新不会再升级成 `catalogChanged`
- `terminal-view`: 证明 live hydration 后，同几何 snapshot 不再触发 reactive fallback 更新

### 2. Real browser walkthrough

- 真实启动 app-server / WebUI
- 打开一个 stopped terminal 的 route
- desktop 与 `iPhone 14` mobile 都要验证
- 记录 `terminal.globalList` 请求次数，确认不再 storm
- 记录 route 是否成功完成 hydration，而不是卡死在加载阶段

### 3. Durable law sync

- 更新 OpenSpec main specs：
  - `terminal-pty-transport`
  - `runtime-terminal-contract`
  - `terminal-view-component`
- 更新 package specs：
  - `packages/terminal-system/SPEC.md`
  - `packages/app-server/SPEC.md`

只有这三层 law 都同步完成，这次修复才算不是一次临时止血。
