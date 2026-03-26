## Why

`packages/message-system` is still a transient dirty-queue. It cannot represent multi-channel chat, transport, metadata, or persistence, so it cannot be the sibling of `terminal-system`.

## What Changes

- Replace the queue with a control plane that owns chat channels, storage, focus state, and WebSocket transport.
- Add built-in `chat-channel` semantics with `chat-*` and `room-*` ids.
- Expose send / reply / query / snapshot / focus / config APIs.

## Capabilities

### New Capabilities
- `message-chat-control-plane`: Multi-channel control plane with DB-backed chat channels and WS transport.

## Impact

- Affected code: `packages/message-system`, `packages/app-server` adapters, future chat view packages.
