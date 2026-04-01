## Architecture Notes

### 1. Room participant truth belongs to message-system

- Room participants are durable room membership facts, so their normalization belongs in message-system.
- `createChannel()` and `updateChannelAuthorized()` must share one participant normalization helper.
- The helper keeps only canonical actor ids (`auth:` / `session:` / `system:`), trims labels, and de-duplicates by actor id.
- This is destructive by design: legacy ids are not migrated or mapped, they are dropped.

### 2. Bootstrap repair is forward cleanup, not migration

- Some old built-in rooms already exist in `.message` with invalid participant ids.
- app-server bootstrap paths (`ensureSessionPrimaryRoom`, `ensureDefaultChatChannel`) should detect those invalid ids and immediately rewrite the room with normalized participants.
- This keeps repair orthogonal:
  - message-system defines legal room truth
  - app-server only triggers repair when it touches old room truth
  - WebUI no longer needs to preserve or reason about invalid participants

### 3. Metadata draft sync must key off durable revision

- The metadata disclosure currently resets local draft state whenever the parent passes a new `channel` object.
- Global room polling makes that happen even when the durable room content did not change.
- The disclosure should only resync local `title / participants / metadata` drafts when the durable room revision changes, which is sufficiently expressed by `chatId + updatedAt`.
- This preserves unsaved edits during passive refresh while still accepting server truth after a real save or external admin update.

### 4. Focus is a room-seat action, not a room action

- Room tab selection is an inspection concern.
- Room focus is collaboration truth owned by message-system per actor seat.
- Therefore:
  - the tab trailing area must not expose `Focus/Unfocus`
  - the metadata disclosure must not expose `Focus/Unfocus`
  - the Users panel becomes the mutation surface for focus because it already carries seat, token, and state
- Each focus mutation must use that seat's own room token, not a global room toggle.

### 5. Provenance is not a front-end lifecycle lock

- `builtIn` or source provenance is metadata about how a room was created, not a reason for the UI to hide cleanup actions.
- On the global Chats route, old broken rooms must remain archivable/deletable so operators can clean bad data.
- Server-side protection, if any, should stay explicit in the server contract rather than being guessed by the UI from metadata shape.

## Verification Slice

This change owns the room repair and Chats admin regression slice of the BDD matrix.

### Required scenarios

- Legacy room participant cleanup and room lifecycle recovery
- Metadata draft stability under passive refresh
- Per-seat focus mutation from the Users panel
- Global cleanup of legacy built-in rooms

### Required evidence modes

- message-system tests for normalization on create/update
- app-server tests for bootstrap repair of old rooms
- WebUI unit/story coverage for metadata disclosure draft stability and per-seat focus controls
