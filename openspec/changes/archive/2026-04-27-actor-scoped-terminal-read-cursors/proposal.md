## Why

Terminal output is a shared collaboration surface, but git-log backed `terminal read` progress had behaved like terminal-owned state. In a multi-actor terminal, that makes read consumption non-orthogonal: actor A can consume a diff and actor B can then observe no diff even though B has never read it.

This conflicts with the terminal-system law that the PTY output is shared physical truth while actor interaction state must remain actor-scoped.

## What Changes

- Move read cursor ownership out of terminal-core and into actor-scoped control-plane/runtime state.
- Add durable read cursors keyed by `(terminalId, readerActorId)`.
- Keep `remark` as the public cursor consumption switch:
  - `remark:true` advances only the current actor cursor.
  - `remark:false` inspects without advancing that cursor.
- Keep `recordActivity` independent from cursor consumption.
- Resolve access-token reads to the token grant's participant actor.
- Publish read cursor metadata through runtime/client payloads.
- Teach WebUI and runtime CLI/help to pass and explain the cursor controls.

## Capabilities

### Modified Capabilities

- `terminal-control-plane`: actor-scoped terminal read cursors and separated activity recording.
- `runtime-terminal-contract`: terminal read payloads carry cursor metadata.
- `terminal-system-surface`: browser reads consume the selected actor cursor through the selected actor access token.
- `runtime-json-tool-descriptor-surface`: `terminal read` schema/help expose `remark` without breaking existing compact `recordActivity` position.

## Impact

- `packages/terminal-system/src/*`
- `packages/app-server/src/*`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/terminals/*`
- `packages/terminal-system/skills/terminal/*`
- `openspec/specs/terminal-control-plane/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/terminal-system-surface/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
