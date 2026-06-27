## Why

Local `followUpAfterMs` ownership has already shifted away from session-local runtime watches toward durable `message-system` follow-up tasks, but repo truth, spec truth, and inspection surfaces have not fully caught up.

At the same time, two adjacent architecture questions must be recorded explicitly instead of being solved with local glue:

- managed-seat remote sends cannot truthfully preserve follow-up ownership through today's RPC bridge; adding one more transport field would pollute the wrong boundary
- room and `AttentionContext` are companion surfaces; when the companion context enters a muted lifecycle state, the room should project to `archived` instead of disappearing or being deleted

## What Changes

- Promote the local `followUpAfterMs` law to message-system durability: room message send + follow-up task write happen together, and message-system runtime owns due timers for local paths.
- Record managed-seat remote follow-up as an explicit architecture debt that must be solved later through AsyncContext + RPC context propagation, not by extending the current bridge contract.
- Define room/archive lifecycle as a companion projection from `AttentionContext` lifecycle: muting a room-backed context archives the room, while preserving room history and send capability.
- Define frontend follow-up work so room catalogs and runtime inspection surfaces distinguish active rooms from archived rooms and stop presenting legacy watch/delivery wording as if it were the source of truth.

## Capabilities

### Modified Capabilities

- `session-runtime-attention-message`
- `attention-context-state`
- `message-chat-control-plane`
- `message-system-surface`

## Impact

- Affected packages: `@agenter/message-system`, `@agenter/app-server`, `agenter-app-studio`
- Compatibility:
  - local message follow-up continues to work, but its ownership is message-system owned rather than session-runtime watch owned
  - remote managed-seat follow-up remains intentionally unsupported until the lower-level AsyncContext + RPC architecture exists
  - archive remains a reversible room state, not deletion and not a send restriction
