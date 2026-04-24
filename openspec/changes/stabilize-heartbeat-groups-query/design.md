## Context

当前 Heartbeat grouped query 的问题不是一个点，而是三层叠加：

1. `app-kernel` 的 `heartbeatGroupsPage` 先 `readAllAiCalls + readAllHeartbeatInspectionMessages`，最后才分页。
2. `SessionDb.pageAiCalls` / `pageMessagesByScopes` 虽然名字叫 page，但内部仍有 `select all -> sort/filter/slice in JS` 的实现。
3. `projectHeartbeatGroups` 的当前实现依赖全历史顺序来判断：
   - loose heartbeat rows 属于哪个 call 前
   - auxiliary payload 是否相对前一个 durable baseline 真的变化
   - 哪些 pending rows 还没有被任何 ai_call 引用

4. Heartbeat route 的冷启动还在顺手 hydrate 不属于 Heartbeat 自身的数据：
   - `chat.list`
   - `runtime.schedulerLogs`
   - `runtime.observabilityTraces`
   - `runtime.requestAuxPage`
   - `runtime.apiCallsPage`
   - `runtime.modelCallsPage(limit = 200)` 这种 devtools 级重载 timeline

这让“分页视图”退化成“全历史重放后再切一页”。

## Goals / Non-Goals

**Goals**

- 让 grouped Heartbeat recent page 在深历史 session 上仍然是 bounded 的
- 保留 grouped Heartbeat 的现有语义与 UI truth
- 把分页边界和投影边界拆开，形成可测试的独立层
- 让冷启动 Heartbeat 在 query 成功或失败后都能显式收口

**Non-Goals**

- 不重新设计 Heartbeat UI 样式或交互
- 不把 grouped Heartbeat 改成新的 durable truth table，除非实现过程中证明 query-time bounded projection 不足以满足 contract
- 不修改 message / ai_call ledger 的客观事实模型

## Decisions

### 1. Storage boundary must page first

Heartbeat grouped query 依赖的 storage reads 必须先在数据库边界完成 `before + limit/window`，不能再把全表拉到 JS 内存里切页。

这意味着：

- `SessionDb.pageAiCalls` 不能再 `select all`
- Heartbeat inspection message 读取不能再先聚合全量 envelopes 再排序切页
- 如果通用 page helper 仍不足以表达 Heartbeat 需要的窗口读取，就补一个 Heartbeat 专用 bounded reader，而不是让 `app-kernel` 再写 `readAll*`

### 2. Grouped Heartbeat query becomes a bounded projection pipeline

Grouped Heartbeat page 将被实现为独立 query module，按“足够返回这一页”的原则拉取事实，而不是全量重建：

- 先从最新或 cursor 之前的 `ai_call` 反向读取 batch
- 为了保持 auxiliary diff truth，只额外读取最小必需的 predecessor baseline
- inspection rows 只读取当前可见 call window 和 loose/pending window 所需的事实
- 一旦已经收集到足够的 grouped rows，就停止继续向更老历史扩张

如果某些 grouped semantics 需要额外 look-behind，只允许补最小比较窗口，不允许退回全历史 replay。

### 3. Projection law and storage law stay separated

`projectHeartbeatGroups` 的“怎么分组”与“读多少历史”是两层不同职责：

- storage/query layer 负责给出一个有界但语义充分的事实窗口
- projection layer 负责把这个窗口投影成 `before-call / call / compact / before-call-pending`

这样测试也能分层：

- query 层测试 bounded reads
- projection 层测试分组 truth
- router/store 层测试 API 与 loading state

### 4. Client load state must settle explicitly

`client-runtime-store` 已经有 grouped Heartbeat cached resource state，但这次 change 要把验收写清楚：

- 冷启动 grouped query 成功时进入 loaded
- 冷启动 grouped query 失败时进入 error
- warm refresh 期间保留已有 data，只标记 refreshing

也就是说，`Loading Heartbeat…` 只能表示“请求尚未 settle”，不能成为“服务端全量重建过慢”的永久掩体。

### 5. Heartbeat route must only hydrate route-owned facts

Heartbeat 页面不是 message transcript，也不是 devtools timeline。它的冷启动只能拉：

- Heartbeat grouped page
- 最小 attention / delivery / notification / channel facts
- Heartbeat status bar 需要的最小 model-call window

它不能再把 `chat.list` 或 devtools 级 `scheduler / traces / apiCalls / requestAux / 200 model calls` 顺手预取进来，否则即便 grouped query 已经 bounded，页面仍会因为 unrelated heavy history 而把 RSS 顶爆。

## Acceptance Strategy

### 1. Backend regression

- 构造 deep history session，包含大量 `ai_call`、`heartbeat_part`、`request_aux`
- 证明 `heartbeatGroupsPage(limit = small)` 不再依赖 full-history materialization 才能返回第一页
- 验证 grouped semantics 在 bounded query 下仍正确

### 2. Client regression

- 验证 grouped Heartbeat resource 在 cold load / refresh 下都能显式收口
- 验证 refresh 期间 warm data 保持可见

### 3. Real walkthrough

- 启动真实 runtime / WebUI
- 打开 Heartbeat 页面
- 确认不再长期停留在 `Loading Heartbeat…`
- 确认 Heartbeat route 不再隐式请求 `chat.list` 与 devtools 级重载历史
- 记录冷启动前后 RSS，证明不再出现启动后即冲到 GB 级别的内存膨胀
- 记录真实验证结果与风险说明
