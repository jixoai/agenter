## Why

The current room transcript violates three durable laws at once:

- message ownership in the UI can drift away from the actual `View as` actor because room send does not carry an explicit actor identity through the send path
- the shared message row regressed to ad hoc rendering primitives, including a fake context menu and a second nested markdown surface
- room read-state still depends on seat-level cursors, which means adding new users retroactively changes old message read progress

The user has explicitly chosen the breaking-path fix: sender identity must be explicit and validated, transcript rendering must return to the richer CodeMirror-based message surface, and read state must be frozen per message as actor arrays.

## What Changes

- Add explicit room `sendAsActorId` semantics from the Messages route through tRPC to the control plane, and validate that the chosen actor matches the credential being used.
- Repair `@agenter/web-chat-view` message rows so viewer-owned messages align by durable sender identity, use one visual bubble surface, use a real `ContextMenu` primitive, and render markdown through a CodeMirror-based preview component.
- Keep the per-message read-progress affordance anchored at the bubble inline-end, including viewer-owned rows, so the disclosure trigger matches the message it describes.
- Replace room read-state durability from room-seat cursor rows to per-message `readActorIds` / `unreadActorIds` arrays, with later reads moving actor ids between the two arrays instead of recalculating history from current membership.
- Stabilize room latest-visible acknowledgement so the WebUI tracks read floors by actor identity and durable message arrays, avoiding duplicate `/trpc/message.globalMarkRead` mutations when credentials or room projections refresh.
- **BREAKING** `message-system` may rebuild or migrate its database without backward compatibility for the old `chat_read_state` table.

## Capabilities

### New Capabilities

- `message-read-state`: room messages freeze collaborator read membership at send time and evolve by moving actor ids between read/unread arrays.

### Modified Capabilities

- `message-chat-control-plane`: global room send now preserves explicit sender identity chosen by the operator and validated against the grant token.
- `web-chat-view`: shared room transcript rows use a single bubble surface, standard context menu primitives, and CodeMirror-based markdown rendering.
- `message-system-surface`: room message alignment and inline read indicators resolve from durable sender identity and per-message read arrays.

## Impact

- Affected code: `packages/webui`, `packages/web-chat-view`, `packages/client-sdk`, `packages/app-server`, `packages/message-system`
- Affected UX: Messages room transcript alignment, message bubble/context menu rendering, room read progress, room send-as behavior
- Breaking storage change: `message-system` durable read-state schema
