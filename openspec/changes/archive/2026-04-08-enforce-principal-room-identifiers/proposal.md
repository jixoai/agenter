## Why

The repository already declares that global room ids SHALL be principal ids, but the implementation still violates that law in multiple places:

- `MessageControlPlane.createChannel()` still accepts `room-*`
- `SessionRuntime` still generates new room ids from `room-${slug}`
- session primary rooms still default to `room-main-${sessionId}`
- `message.db` schema upgrades do not clear schema-2 rows that still use legacy room ids

That mismatch is now user-visible in the Messages workbench: the same UI can show a new `0x...` room beside an older `room-uuid` room. This is not a presentational bug; it means the identity law is still split.

## What Changes

- Enforce principal-only room ids in the message control plane.
- Persist a session-level `primaryRoomId` so runtimes and stopped-session read paths stop deriving `room-main-*`.
- Inject an async room-id allocator into session runtime so new runtime-created rooms also use managed room principals.
- Upgrade message durability to a new breaking schema reset that clears legacy `room-*` channels and grants.

## Impact

- `packages/message-system`
- `packages/app-server`
- `openspec/specs/message-chat-control-plane/spec.md`
- `openspec/specs/room-session-projection/spec.md`
