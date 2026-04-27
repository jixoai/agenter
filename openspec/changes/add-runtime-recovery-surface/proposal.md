## Why

当前 runtime 已经完成 provider transport retry、runtime retry policy、runtime compact policy 的拆分：Settings 负责 durable recovery law，scheduler publication 负责发布 `waiting/backoff/blocked` 等客观状态。

剩下的问题是 live recovery control 还没有正式收口。操作者看到 runtime `backoff`、`blocked`、latest error 或下一次唤醒信息时，仍然缺少一个清晰入口来判断“现在是在等策略自动恢复，还是需要人工介入”，也缺少正式的 `Retry now` 控制路径。继续把这些内容塞进 Heartbeat quick config 会再次混淆三层职责：

- next-call execution knobs
- durable retry / compact policy
- live recovery diagnostics and one-shot control

## What Changes

- Add a runtime recovery surface inside the existing runtime shell so operators can inspect policy-resolved recovery diagnostics without inferring them from transcript noise.
- Add a formal `Retry now` action path through the runtime control plane as a one-shot live control.
- Keep durable retry/compact policy editing in Runtime Settings.
- Keep Heartbeat quick config limited to next-call execution knobs.
- Add focused tests for runtime recovery publication, control-path behavior, and runtime-shell rendering.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-ui-publication`: Runtime consumers must receive objective recovery diagnostics plus a formal manual retry control path.
- `workspace-runtime-shell`: The runtime shell must keep Heartbeat quick config execution-scoped, keep durable policy in Settings, and expose live recovery diagnostics/actions through a separate surface.

## Impact

- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/app-kernel.ts`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/runtime/*`
- `openspec/specs/runtime-ui-publication/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
