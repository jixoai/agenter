## Why

`Heartbeat` 当前的 grouped query 在冷启动时会把整段 session 历史重新读一遍：

- 先把全部 `ai_call` 读入内存
- 再把全部 `heartbeat_part + request_aux` inspection rows 读入内存
- 然后重建整份 grouped Heartbeat 视图
- 最后才做分页

这条路径在短历史上是“正确但偷懒”的实现，在长历史上会直接违反系统的 bounded-history 法则。结果就是：

- runtime 启动后内存快速上涨
- `heartbeatGroupsPage` 长时间不返回
- WebUI 只能停留在 `Loading Heartbeat…`

这不是单纯 UI loading 态问题，而是 grouped Heartbeat 查询边界设计错误。

## What Changes

- 把 Heartbeat grouped query 改成有界查询：先在存储边界做 paging/windowing，再做 grouped projection。
- 保持现有分组语义不变：`before-call`、`call`、`compact`、`before-call-pending` 仍然成立。
- 拆出可单测的 Heartbeat grouped query 模块，让“分页策略”和“分组算法”分层。
- 增加回归验收，覆盖深历史数据集、router query、client loading/error 收口，以及真实 Heartbeat 走查。

## Capabilities

### Modified Capabilities

- `runtime-ui-publication`: grouped Heartbeat page 必须来自 bounded storage reads，而不是 full-history rebuild
- `client-runtime-store`: grouped Heartbeat cold hydration 必须显式收口到 loaded 或 error，不能长期卡在 loading

## Impact

- Affected systems: `@agenter/session-system` paging helpers, `@agenter/app-server` Heartbeat query/projection path, `@agenter/client-sdk` grouped Heartbeat resource hydration, WebUI Heartbeat route verification
- No durable product behavior change is intended beyond performance/stability; the operator should still see the same Heartbeat truth, but without startup blow-up
