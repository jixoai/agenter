## Why

The frontend now tells an attention-first story, but the runtime protocol that feeds it still exposes `loopbus*` names, `runtime.loopbus.*` events, and an orphan `modelDebug` endpoint. That keeps the old architecture alive at the protocol boundary, increases cognitive cost, and forces the UI to keep translating legacy runtime facts into the new mental model.

## What Changes

- **BREAKING** Rename the frontend-facing runtime publication contract from `loopbus*` naming to scheduler/observability naming across realtime events, tRPC procedures, client-sdk types, runtime-store state, and WebUI paging keys.
- **BREAKING** Retire the orphan `modelDebug` runtime endpoint and client helpers; operator inspection will use draft resolution, model-call records, and API-call records instead.
- Update WebUI runtime consumers so Devtools and other heavy surfaces consume the renamed scheduler/observability resources directly instead of translating legacy protocol names.
- Audit residual protocol strings, tests, and fixtures so old `loopbus*` names no longer define the frontend-facing runtime contract.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `loopbus-runtime-publication`: the frontend-facing runtime publication contract moves to scheduler/observability naming and no longer exposes `runtime.loopbus.*` as the public protocol.
- `client-runtime-store`: normalized runtime state, loaders, and paging ownership move away from `loopbus*` names and orphan debug helpers.
- `runtime-ui-publication`: route consumers hydrate and subscribe to scheduler/observability slices directly, without legacy protocol translation.
- `session-history-pagination`: the reverse-time resource set uses an observability-first trace resource id instead of `loopbus-trace`.
- `model-provider-standards`: provider inspection metadata remains available through draft resolution and transport records, while the orphan model-debug endpoint is retired.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, `packages/webui`
- Affected APIs: tRPC runtime procedures, realtime event names, client-runtime-store state/method names, WebUI long-list resource ids
- Affected systems: runtime publication, Devtools observability, transport inspection, reverse-time paging
