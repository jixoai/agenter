## Why

Heartbeat 的 AI Config 面板已经暴露了“修改下一次 call 的 runtime knobs”这个能力，但当前实现把 `temperature`、`topK`、`maxToken`、`thinking` 写进了 `ai.providers.*`。这既破坏了 provider 默认配置和 runtime 覆写的分层法则，也让 avatar 级 durable settings 无法成为 Heartbeat 配置的真实落点。

## What Changes

- Repair Heartbeat AI Config persistence so runtime knobs write to avatar-scoped durable settings instead of mutating provider defaults.
- Move runtime sampling knobs to top-level `ai.temperature` / `ai.topK` / `ai.maxToken` / `ai.thinking`, while keeping `ai.providers.*` focused on provider registry defaults.
- Ensure scoped settings graphs and jump targets treat avatar settings files as first-class editable layers for runtime configuration.
- Add focused tests for settings loading, session config resolution, settings scope graph resolution, and Heartbeat config state serialization.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-ui-publication`: Heartbeat config saves must persist runtime knobs into the avatar settings layer under root `ai.*` fields instead of mutating `ai.providers.*`.

## Impact

- `packages/settings/src/*`
- `packages/app-server/src/session-config.ts`
- `packages/app-server/src/settings-scope.ts`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-config-state.ts`
- `packages/webui/src/lib/features/runtime/runtime-shell.svelte`
- `openspec/specs/runtime-ui-publication/spec.md`
