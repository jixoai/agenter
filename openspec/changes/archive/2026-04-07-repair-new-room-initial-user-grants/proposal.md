## Why

The current `New room` page no longer uses raw `participants`, but two critical gaps remain:

- room creation still allocates human-readable slug ids such as `room-jokes`, while the operator expects durable opaque ids
- running avatar runtimes can still react to room attention outside their granted room set, which means an unselected avatar can end up responding to a room it was never invited to

Those gaps break the create-room contract even though the `initialUsers` payload exists.

## What Changes

- Upgrade global room creation so one create request can declare initial users with role and auto-focus semantics instead of forcing the client to stitch together `participants`, `grant`, and `focus` as separate steps.
- Tighten session-runtime room wiring so a runtime only consumes room message/focus events for rooms its actor can actually access.
- Replace title-derived global room ids with opaque generated ids so the route always navigates via the returned room id instead of readable slugs.
- Update the `New room` route to render canonical Users through avatar-bearing item rows with inline role selection and user-centric copy.
- Keep the operator on the newly created room route and ensure the selected initial users are materialized as real room seats immediately after creation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-chat-control-plane`: room creation now accepts initial user grants plus focus so selected users join a room as real seats during the create flow, room ids are opaque, and runtime attention stays scoped to granted actors.
- `message-system-surface`: the `New room` surface now renders canonical User rows with avatars and role selection instead of checkbox-only participant toggles, then navigates by the returned opaque room id.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`
- Affected behavior: creating a room with selected users immediately grants and focuses only those users into the new room, while unselected avatars stay outside the room and its attention stream
- UI impact: `New room` route copy and row rendering move from participant wording to user wording
