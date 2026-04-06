## Why

The current `New room` page only persists room `participants`, which means checked users do not receive room grants or focus state and therefore do not actually join the new room. The UI also cannot express initial user roles, avatars, or a durable user-centric vocabulary.

## What Changes

- Upgrade global room creation so one create request can declare initial users with role and auto-focus semantics instead of forcing the client to stitch together `participants`, `grant`, and `focus` as separate steps.
- Update the `New room` route to render canonical Users through avatar-bearing item rows with inline role selection and user-centric copy.
- Keep the operator on the newly created room route and ensure the selected initial users are materialized as real room seats immediately after creation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-chat-control-plane`: room creation now accepts initial user grants plus focus so selected users join a room as real seats during the create flow.
- `message-system-surface`: the `New room` surface now renders canonical User rows with avatars and role selection instead of checkbox-only participant toggles.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`
- Affected behavior: creating a room with selected users immediately grants and focuses those users into the new room
- UI impact: `New room` route copy and row rendering move from participant wording to user wording
