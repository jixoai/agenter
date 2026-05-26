# @agenter/client-sdk SPEC

> 本文件记录 `@agenter/client-sdk` 的长期 client contract。

## 1. 角色

`@agenter/client-sdk` 是 daemon/app-server 的 typed client surface：

- 暴露 tRPC client、runtime store、product-extension-runtime client
- 为 TUI、WebUI、cli-shell 这类外部 surface 提供同一份 projection / subscription contract
- 保持 client-only position：它消费后端 authority truth，但自己不是 authority owner

## 2. 长期法则

- product packages 通过 `client-sdk` 消费 runtime、room、terminal、attention 与 TerminalSystem authorization projection；不得因为共仓开发就回退到 import server internals。
- runtime store 只缓存或投影后端可观察事实；local view-model、toolbar state、product memory 不是 client-sdk 的 durable truth。
- runtime store 的订阅发布必须在非浏览器 runtime 中同步落地；只有同时提供 DOM `document`、`requestAnimationFrame` 与 `cancelAnimationFrame` 的真实浏览器帧环境才允许做 frame batching，OpenTUI/TTY 这类 synthetic window 不得等待输入事件才发布 room/terminal/runtime 事实。
- product-extension-runtime client 固定暴露 generic ensure/query/mutate surface；cli-shell-specific naming、managed UX、prompt policy 留在 product package。
- typed router coupling 只允许服务于 shared contract discoverability；authority grammar 与 durable truth 始终由 server-side systems 拥有。
