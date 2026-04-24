## Why

打开 `Terminals` 页面里的 stopped terminal 时，前端会触发一条错误的风暴链路：

1. terminal websocket transport 在连接/bootstrap 期间产生 snapshot/status 帧；
2. `app-kernel` 把这些 render tick 误当成 terminal catalog mutation，持续发出 `catalogChanged`;
3. browser/client 反复重拉 `terminal.globalList`;
4. `terminal-view` 还会继续吃同几何的冗余 snapshot，导致 Lit/xterm 反复更新。

结果不是单点慢，而是整个 terminal route 在加载阶段内存、CPU 一起爆涨，最后卡死或崩溃。

这不是数据库 schema 的问题，核心是三层法则没有隔离：

- transport 机械帧
- runtime surface invalidation
- renderer fallback hydration

## What Changes

- 把 terminal websocket transport 收口成：
  - connect 时发送一份 bootstrap snapshot
  - live 阶段优先流 output/status
  - 没有几何变化时，不再持续推 full snapshot
- 把 `app-kernel` terminal surface invalidation 收口成：
  - `created/updated/deleted/focus/presence` 才能升级成 `catalogChanged`
  - `snapshot/status` 只属于 live render truth，不得再触发 catalog refetch storm
- 把 `terminal-view` fallback hydration 收口成：
  - live transport 已经接管后，同几何冗余 snapshot 不再写回 reactive snapshot state
  - 只在首次 hydration、geometry 变化、或 live 落后时才重新吃 fallback snapshot
- 增加 transport / kernel / view 三层回归测试，并补真实浏览器走查验收。

## Capabilities

### Modified Capabilities

- `terminal-pty-transport`: transport bootstrap 与 live snapshot law
- `runtime-terminal-contract`: terminal surface invalidation 只表达真实 resource-family 变化
- `terminal-view-component`: live transport 期间的 fallback snapshot 去抖与 viewport 稳定性

## Impact

- Affected systems:
  - `@agenter/terminal-system`
  - `@agenter/app-server`
  - `@agenter/terminal-view`
  - terminal route / browser terminal consumers
- Intended behavior change:
  - 打开 stopped terminal 仍然可以收到 bootstrap snapshot 并继续接 live output
  - 但不会再因为 snapshot/status 心跳把 catalog 请求打成风暴
  - terminal route 必须能稳定完成 hydration，而不是在加载阶段把前端拖死
