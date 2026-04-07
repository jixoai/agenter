## Why

The `Messages` primary workbench currently fails during initial mount and renders a blank page for `/messages`, `/messages/new`, and `/messages/room/*`.

- The crash happens before the room catalog finishes hydrating, so the operator cannot reach room creation, room browsing, or any message workflow at all.
- This breaks the shell law that each primary destination must always render its own window chrome, even while backing data is still loading.

## What Changes

- Define a durable contract for the `Messages` workbench so its fixed chrome can mount safely before room data resolves.
- Repair the `Messages` workbench tab composition so the fixed `New room` tab and later hydrated room tabs no longer trigger a runtime teardown crash.
- Add focused regression coverage for the empty-room and initial-mount path so the workbench stays renderable before the first room list response arrives.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `message-system-surface`: The message workbench chrome must remain renderable during initial mount and room-catalog hydration instead of blanking the page.

## Impact

- `packages/webui/src/lib/features/messages`
- `packages/webui/src/lib/features/navigation`
- `openspec/specs/message-system-surface`
