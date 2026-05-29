## Self Review

### 1. CloseConfirmDialog 问题

结论：`Run in Background` 和 `Terminate terminal` 不是同一个按钮回调。

真正的问题是：之前 `ShellNextApp.finished` 只表达“UI 结束了”，没有表达“为什么结束”。所以 product runtime 在 `app.finished` 后只能走同一条 cleanup 路径。这会让 `background-run` 和 `terminate` 在外层生命周期上重新混到一起。

本轮修正：

- `ShellNextApp.finished` 现在返回 `normal | background-run | terminate`。
- `Run in Background` 返回 `background-run`；product-bound live terminal 走 `detach`，只断开 shell-next 的视图/transport，不 stop durable PTY。
- `Terminate terminal` 返回 `terminate`，并走 terminal source 的 `terminate` 语义；product-bound live terminal 会调用 `stopGlobalTerminal`。
- product attach runtime 看到 `background-run` 时跳过 `store.disconnect()` 这条显式 release 路径，让下一次 attach 还能复用原本的 terminal binding。

### 2. Input 迁移自审

结论：不是“所有 input 都迁移到内核”，这个说法太粗。更准确的边界是：

- 终端语义 input 已经沉到 source/backend 边界；
- 产品级 input 仍然应该留在 app/view 层；
- 视图层仍然需要做坐标转换和事件转发，但不能拥有终端语义状态。

当前分类：

- `packages/termless-backend-utils/src/terminal-host-input.ts`
  - 拥有终端键盘/鼠标语义：Option word movement、Shift selection、double click word、triple click line、drag selection、clear selection、follow cursor transaction。
- `extensions/shell-next/src/sources/bun-terminal-protocol-source.ts`
  - 本地 Bun PTY 的终端 source，绑定 `createTerminalHostInputController()`。
- `extensions/shell-next/src/sources/shell-next-live-terminal-source.ts`
  - product-bound live terminal source，绑定同一套 host input controller。
- `extensions/shell-next/src/app/shell-next-app.ts`
  - 仍然处理 `Ctrl+B` prefix、Help/Chat、top-layer、host copy shortcut、pane focus。
  - 这些是产品级输入，不应该下沉到终端内核。
- `extensions/shell-next/src/terminal-projection/framebuffer-terminal-pane.ts`
  - 仍然接收 mouse event，但只转成 pane-local terminal pointer intent 并转发给 source。
  - 这里不拥有 drag/word/line selection 的 durable truth。
- `extensions/shell-next/src/renderable-mux/renderer-selection.ts`
  - 只服务 renderer pane，比如 ChatPane 的可选 renderer selection plugin。
  - 它不属于 ShellPane terminal source 语义。

### 3. 偏移清单

- 之前把 `Run in Background` 的验证停在“terminal source 没有 dispose”，覆盖太浅，没有覆盖 product attach 的外层 cleanup。
- 旧说法把 `dispose` 和 `terminate` 混在一起了。现在的准确边界是：`detach` 释放 shell-next 视图连接，`terminate` 才是杀 durable PTY，`dispose` 只是 source 自身的资源释放入口。
- 之前说“input 都迁移到内核”不准确，应该说“终端语义 input 迁移到 source/backend；产品级 input 和 raw forwarding 保留在上层”。
- `live-terminal-mirror.ts` 仍然放在 `opencompose/terminal-frame` 路径下，行为上是 terminal mirror/source 边界，但命名上容易让人误会成 generic OpenCompose law。

### 4. 未来任务

- 如果 shell-next 继续收口架构，可以把 terminal-specific mirror/projection 文件从 `opencompose/terminal-frame` 迁到更明确的 `terminal-projection` 或 `terminal-kernel` 路径，降低命名误导。
- 如果真实环境中 `client.close()` 本身仍然会触发 server-side binding release，则需要补一个 server/client 明确的 `background detach` API；本轮已经把 shell-next 自己的 detach/terminate 语义拆开。
- 不需要回头改 `extensions/cli-shell`，这次仍然保持 read-only。
