## Context

Room identity is currently split across three incompatible laws:

1. `principal-identity-core` and `message-chat-control-plane` say room ids are managed principal ids.
2. `app-kernel.createGlobalRoom()` already allocates managed room principals for explicit global rooms.
3. session primary rooms and runtime-created rooms still synthesize `room-*` ids, and message-system still accepts them.

The result is durable identity drift. Even after new room creation was repaired, old and new room laws coexist in the same workbench.

## Decision

Treat room identity as a single principal-backed law across app-server and message-system:

- `MessageControlPlane` accepts only principal room ids.
- `MessageDb` bumps schema version and performs a breaking reset when older durability might still contain legacy `room-*` channels.
- `SessionMeta` persists `primaryRoomId`, just like avatar binding persists `avatarPrincipalId`.
- `AppKernel` ensures a managed room principal exists for every session before runtime start or session-facing room reconstruction.
- `SessionRuntime` no longer synthesizes room ids locally; it receives an async room-id allocator from app-server.

## Consequences

- This is intentionally destructive for legacy global message durability that still uses `room-*`.
- Tests and fixtures that hard-code `room-*` ids must migrate to principal ids or principal generators.
- Session-facing fallbacks become explicit: stopped-session projections must use persisted `primaryRoomId`, not a derived legacy pattern.

## Verification

- `packages/message-system` tests cover principal-only room creation and schema reset behavior
- `packages/app-server` tests cover session primary room persistence and runtime-created room allocation
- targeted `typecheck`
- browser verification that Messages no longer surfaces newly created legacy `room-*` ids after reset
