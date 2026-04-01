## Why

The current message UI still leaks legacy chat/channel assumptions, inconsistent actor handling, and partial local state that does not fully align with the global room control plane. The new Svelte WebUI needs a room-first message-system surface that treats auth actors, grants, read state, and send-as flows as first-class behavior.

## What Changes

- Build a dedicated `/messages` system surface around global rooms rather than the old chat/session framing.
- Render room transcript, room list, and user/access management from the existing message-system and auth-system APIs.
- Require actor selection for sending messages and for managing room grants, using auth/profile-backed identities and tokens.
- Replace the old attention-oriented unread presentation with read progress visibility suitable for group chat.
- Support room lifecycle actions directly in the UI: create, edit metadata, archive, delete, and invalid-source presentation.

## Capabilities

### New Capabilities
- `message-system-surface`: Define the room-first operator surface, auth-backed actor flows, and read-state presentation for message-system.

### Modified Capabilities
None.

## Impact

- Affected packages: `@agenter/webui`, `@agenter/client-sdk`
- Affected systems: message-system, auth-system, profile identity/media
- Affected UX: room creation, room access management, transcript rendering, send-as composer, read progress indicators
