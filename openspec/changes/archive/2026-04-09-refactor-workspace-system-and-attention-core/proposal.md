## Why

The current kernel still mixes several incompatible laws into the same objects: `workspace` is simultaneously an avatar overlay root, a runtime identity key, a settings scope, and a WebUI workbench; `notification` is still modeled outside of attention; and focus is still projected from source adapters instead of being owned by `AttentionContext` itself. That model blocks the intended app direction of global Avatars, grant-based multi-workspace control, and a simpler human-like attention workflow.

This change replaces those old laws instead of extending them. The current phase is backend-only: it introduces a first-class `WorkspaceSystem`, global Avatar ownership, and attention-native push ingress as the new platform truth. WebUI restructuring is intentionally deferred to a follow-up frontend change once the backend contracts stabilize.

## What Changes

- Introduce an independent `WorkspaceSystem` that owns workspace mounts, directory grants, public/avatar-private workspace assets, and sandboxed workspace bash execution. **BREAKING**
- Globalize Avatar identity and replace `workspace + avatar` runtime identity with one canonical runtime per Avatar. **BREAKING**
- Extend `AttentionContext` with durable focus state and distinguish focused `commit` ingress from background `push` ingress. **BREAKING**
- Replace the standalone session-notification truth with attention-derived notification projections and hooks. **BREAKING**
- Replace the singular `.agenter/avatar/*` disk contract with plural `~/.agenter/avatars/*` and `$WORKSPACE/.agenter/{workspace,avatars}/*` roots. **BREAKING**
- Publish backend-facing runtime, workspace, attention, and notification contracts for frontend follow-up work. **BREAKING**

## Capabilities

### New Capabilities
- `workspace-system-capabilities`: independent workspace mounts, grants, public/avatar-private asset roots, and sandboxed bash execution.
- `avatar-runtime-topology`: canonical Avatar runtime identity and dynamic attachment of workspaces, rooms, and terminals.
- `attention-notification-push`: attention-native background push ingress and shell notification projection.

### Modified Capabilities
- `attention-context-state`: attention contexts gain durable focus state instead of being content/score-only records.
- `attention-runtime-kernel`: runtime ingress and scheduling become focus-aware and push-aware.
- `session-notifications`: standalone session notification projection is replaced by attention-derived notification surfaces.
- `workspace-avatar-management`: avatar catalog, default avatar resolution, and avatar-local credential paths move to the new global/plural contract.
- `workspace-resource-ownership`: workspace assets and mounts gain explicit public vs avatar-private ownership rules.

## Impact

- Affected code: `packages/app-server`, `packages/attention-system`, `packages/avatar`, `packages/settings`, plus message/terminal adapter hooks and the minimum backend-facing API surfaces used for verification.
- Affected APIs: runtime, workspace, settings, notification-projection, and minimal verification contracts.
- Affected storage: Avatar roots, workspace roots, seat credentials, runtime identity, and attention ingress durability.
- Affected UX: deferred to a follow-up frontend change that consumes the backend contracts produced here.
