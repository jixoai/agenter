## Why

当前系统把 provider `maxRetries` 与 runtime recovery/backoff 语义混在一起：前者本质上是单次模型请求的 transport retry，后者却是 Heartbeat/session runtime 持续工作的调度法则。这个混淆导致 Settings、接口、内核和 WebUI 都无法客观表达“第 N 次失败应等待多久、何时 reset、何时 blocked、何时允许 manual retry”的 durable truth。

## What Changes

- **BREAKING** Split provider transport retry from runtime recovery law, so provider metadata no longer doubles as the scheduler's retry or compact policy.
- Add durable structured runtime retry-policy and compact-policy contracts for backoff schedule, attempt progression, reset semantics, and objective compact triggers.
- Update resolved session config, runtime kernel, runtime interfaces, and WebUI to consume the explicit runtime policies instead of legacy provider-coupled heuristics.
- Keep Heartbeat quick config execution-scoped, and move durable retry/compact policy editing into the runtime Settings surface together with other durable runtime settings.

## Capabilities

### New Capabilities
- `runtime-retry-policy`: Durable runtime retry/backoff policy contract for session recovery, containment, and operator-visible recovery controls.

### Modified Capabilities
- `model-provider-standards`: Provider retry configuration becomes transport-only metadata rather than runtime recovery policy.
- `attention-runtime-error-containment`: Containment and next-wake behavior resolve from the explicit runtime retry policy instead of hard-coded retry math.
- `attention-prompt-window-compaction`: Compact triggers resolve from an explicit compact policy instead of a generic any-error fallback.
- `workspace-runtime-shell`: The runtime Settings surface owns durable recovery policy editing while Heartbeat quick config remains execution-scoped.

## Impact

- `packages/settings/src/schema.ts`
- `packages/settings/src/provider.ts`
- `packages/app-server/src/session-config.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/model-client.ts`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/runtime/*`
- `openspec/specs/runtime-retry-policy/spec.md`
- `openspec/specs/model-provider-standards/spec.md`
- `openspec/specs/attention-runtime-error-containment/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
