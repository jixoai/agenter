## Self Review

### 1. CloseConfirmDialog 问题

结论：`Run in Background` 和 `Terminate terminal` 不是同一个按钮回调。

真正的问题是：之前把 `Run in Background` 建模成 shell-next/SDK 的特殊资源生命周期动作，但用户给出的产品法则更简单：它就是关闭 shell-next 前台 UI 附着进程，等价于关闭原生 terminal window/tab。

本轮复核后确认，导致“下一次 selector 消失”的强根因在 CLI app launcher：当没有可复用 daemon 时，它启动了 in-process daemon，并在 app 退出后 stop。`AppKernel.stop()` 会 dispose TerminalSystem control plane，进而停止 live terminal，所以 selector 只能看到 terminal 消失。

本轮修正：

- app command launcher 不再暴露/持有 `startDaemon()` 返回的 local daemon handle；它改为 `ensureManagedDaemonAuthority()`，启动或复用 managed background daemon authority。
- foreground app 退出后不再 stop daemon；daemon shutdown 只属于显式 `agenter daemon stop/restart`。
- `ShellNextApp.finished` 收回成纯 UI 完成信号，不再返回 `background-run | terminate` outcome。
- `Run in Background` 只调用普通 `destroy()`，释放本地 renderer/source/client 资源。
- `Terminate terminal` 仍然先调用 terminal source `terminate()`；app-bound live terminal 会调用 `stopGlobalTerminal`。
- app attach runtime 一律在 app 结束后调用 `store.disconnect()`，因为它只是本地 SDK transport/subscription cleanup，不是 terminal/resource lifecycle cleanup。

### 2. Input 迁移自审

结论：不是“所有 input 都迁移到内核”，这个说法太粗。更准确的边界是：

- 终端语义 input 已经沉到 source/backend 边界；
- 产品级 input 仍然应该留在 app/view 层；
- 视图层仍然需要做坐标转换和事件转发，但不能拥有终端语义状态。

当前分类：

- `packages/termless-backend-utils/src/terminal-host-input.ts`
  - 拥有终端键盘/鼠标语义：Option word movement、Shift selection、double click word、triple click line、drag selection、clear selection、follow cursor transaction。
- `apps/shell-next/src/sources/bun-terminal-protocol-source.ts`
  - 本地 Bun PTY 的终端 source，绑定 `createTerminalHostInputController()`。
- `apps/shell-next/src/sources/shell-next-live-terminal-source.ts`
  - app-bound live terminal source，绑定同一套 host input controller。
- `apps/shell-next/src/app/shell-next-app.ts`
  - 仍然处理 `Ctrl+B` prefix、Help/Chat、top-layer、host copy shortcut、pane focus。
  - 这些是产品级输入，不应该下沉到终端内核。
- `apps/shell-next/src/terminal-projection/framebuffer-terminal-pane.ts`
  - 仍然接收 mouse event，但只转成 pane-local terminal pointer intent 并转发给 source。
  - 这里不拥有 drag/word/line selection 的 durable truth。
- `apps/shell-next/src/renderable-mux/renderer-selection.ts`
  - 只服务 renderer pane，比如 ChatPane 的可选 renderer selection plugin。
  - 它不属于 ShellPane terminal source 语义。

### 3. 偏移清单

- 之前把 `Run in Background` 的验证停在“terminal source 没有 terminate”，覆盖太浅，没有覆盖 app launcher 的 daemon ownership。
- 旧说法把 `dispose`、`detach` 和 `terminate` 混在一起了。现在的准确边界是：`dispose` 释放本地 source/client 资源，`terminate` 才是杀 durable PTY；shell-next 不再需要独立 `detach` lifecycle API。
- 之前说“input 都迁移到内核”不准确，应该说“终端语义 input 迁移到 source/backend；产品级 input 和 raw forwarding 保留在上层”。
- `live-terminal-mirror.ts` 仍然放在 `opencompose/terminal-frame` 路径下，行为上是 terminal mirror/source 边界，但命名上容易让人误会成 generic OpenCompose law。

### 4. 未来任务

- 如果 shell-next 继续收口架构，可以把 terminal-specific mirror/projection 文件从 `opencompose/terminal-frame` 迁到更明确的 `terminal-projection` 或 `terminal-kernel` 路径，降低命名误导。
- 如果真实环境中 `client.close()` 本身被证明会触发 server-side resource stop，那才需要在 server/client contract 里修正 close semantics；当前代码证据显示 `store.disconnect()` / `client.close()` 是本地 transport cleanup，不应跳过。
- 不需要回头改 `apps/cli-shell`，这次仍然保持 read-only。
