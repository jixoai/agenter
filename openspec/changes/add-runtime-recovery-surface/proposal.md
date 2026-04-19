## Why

当前 runtime 已经具备 scheduler containment、latest error、backoff 等客观事实，但 WebUI 仍缺少一个职责清晰的 recovery surface。操作者在 `Heartbeat` 里只能看到状态摘要，既无法直接检查最近一次异常与下一次唤醒，也没有正式的 `Retry now` 控制路径；如果继续把这些内容塞进 Heartbeat quick config，就会把“下一次 call 的执行旋钮”“durable settings”“live recovery control”三种职责继续混在一起。

## What Changes

- Add a non-breaking runtime recovery surface inside the existing runtime shell so operators can inspect latest recovery diagnostics without inferring them from transcript noise.
- Add a formal manual retry action path through the runtime control plane, without rewriting durable settings and without forcing stop/start as a workaround.
- Keep Heartbeat quick config limited to next-call execution knobs, and keep recovery diagnostics/actions separate from the Settings tab.
- Add focused tests for runtime recovery publication, control-path behavior, and runtime-shell rendering.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-ui-publication`: Runtime consumers must receive objective recovery diagnostics plus a formal manual retry control path.
- `workspace-runtime-shell`: The runtime shell must keep Heartbeat quick config execution-scoped while exposing recovery diagnostics/actions through a separate surface.

## Impact

- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/app-kernel.ts`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/runtime/*`
- `openspec/specs/runtime-ui-publication/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
