## Why

The current chat surfaces still leak AI-centric "pending for attention" semantics into a group messaging app. In a room, the user needs to know who has read the message, who has not, and when they read it; that is a message-system concern, not an attention-strip concern.

## What Changes

- Add actor-scoped room read-state to message-system, including read cursors and read timestamps per room seat.
- Expose a read-progress ring and read-state inspector for group chat instead of using "pending for attention" as the primary room feedback affordance.
- Keep navigation unread counts as app-runtime notification projection, but stop using that projection as a substitute for room-local read-state.
- Surface room users together with credential state, read state, and read time so the room roster becomes the main collaboration status surface.
- **BREAKING** chat-first room UI stops presenting pending-attention status as the primary room completion indicator.

## Capabilities

### New Capabilities
- `message-read-state`: actor-scoped room read cursors, read timestamps, and read-progress projection for collaboration UIs.

### Modified Capabilities
- `message-chat-control-plane`: room truth must include durable actor-scoped read-state mutations and projections.
- `chat-surface-presentation`: group chat must render read progress as a message-system concern instead of an attention debt strip.
- `session-notifications`: session unread projection remains app-level runtime state and must stay distinct from room-local read-state.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected UX: global Chats, room header or footer status, room users panel, unread badges.
- Cross-change dependency: durable actor labels and icons are expected to come from `auth-superadmin-identity-vnext`.
