## Why

当前 `Heartbeat` 只投影 user / assistant 消息，看不到 compact cycle 在什么位置切断并重建了 prompt window。结果是：

- operator 无法从 Heartbeat 判断“上下文从哪里重开了”
- compact 只能在 cycles / model call 侧被动推断，违背了 Heartbeat 作为主运行流的职责
- session ledger 已经有 compact cycle 事实，但 Heartbeat 没有一个 durable boundary row 去表达它

用户已经明确授权：compact 边界应该作为特殊 `message-parts(type=compact)` 进入 durable ledger，并在 Heartbeat 中显示为分隔符，而不是继续让前端猜测 cycle 结构。

## What Changes

- Session runtime 在 compact cycle 完成时，额外持久化一个 `scope=heartbeat`、`role=system`、`partType=compact` 的边界消息
- Heartbeat ledger projection 升级为“消息 + compact separator”的混合行流
- client-sdk 与 WebUI Heartbeat surface 接受 compact separator 行，并用专用 separator primitive 渲染
- 增加 app-server 回归测试与 Storybook DOM contract，确保 compact 边界既能持久化恢复，也能在真实 DOM 中稳定显示

## Capabilities

### Modified Capabilities
- `workspace-runtime-shell`: Heartbeat stream now includes compact separators between runtime message spans
- `session-ai-call-ledger`: compact cycles persist dedicated heartbeat boundary message parts

## Impact

- Affected code:
  - `packages/app-server/src/session-runtime.ts`
  - `packages/app-server/src/session-ledger-view.ts`
  - `packages/app-server/src/app-kernel.ts`
  - `packages/client-sdk/src/*`
  - `packages/webui/src/lib/features/runtime/*`
- Affected APIs:
  - runtime snapshot `chatMessages`
  - `chat.list`
- Systems:
  - session durable ledger
  - runtime heartbeat projection
  - runtime heartbeat UI
