## Context

The message-system law correctly separates room membership truth (`participants`) from permission truth (`grants`) and focus truth. The first repair added `initialUsers`, but two deeper law violations are still visible:

1. session runtimes still subscribe to room message/focus invalidations too broadly, so an avatar can react to queued room work without holding room access
2. global room ids still derive from room titles, so the route contract leaks presentation text into durable identifiers

The right fix is still platform-first: keep room create atomic, then tighten the runtime subscription boundary and replace the id allocator law instead of patching around the symptoms in WebUI.

## Goals / Non-Goals

**Goals:**
- Let room creation accept initial users with role and focus intent.
- Materialize selected users as actual room grants during creation.
- Auto-focus the newly created room for the relevant users.
- Ensure unselected avatars cannot consume message or focus attention for that room.
- Allocate new global rooms with opaque ids instead of title-derived slugs.
- Rebuild the `New room` user picker as avatar-rich item rows with inline role selection and user wording.

**Non-Goals:**
- Redesign the post-create room management dialog.
- Rename every internal `participantId` type in the stack; the user-facing surface changes first.
- Introduce a second room-creation API just for WebUI.
- Change the built-in per-session primary room id law (`room-main-*`) in this change.

## Decisions

### 1. Extend create-room control plane with initial user grants

Global room creation will accept an additional `initialUsers` payload that carries `{ actorId, label, role, focused }`. The control plane will still persist canonical `participants`, but it will also issue grants and apply focus for those users during the same room-create operation.

Alternative considered: create the room first, then let WebUI call `issueGlobalRoomGrant` and `focusGlobalRooms` for each user. Rejected because it creates a multi-step partial-failure window and pushes a control-plane concern into feature glue.

### 2. Derive durable participants from initial users, but do not collapse grants into participants

The room record should still keep normalized `participants` because room truth and grant truth are different laws. The create flow will therefore synthesize `participants` from the selected initial users while still issuing explicit grants for access and focus.

### 3. Keep focus explicit per initial user

The create payload will allow focus to be set per initial user. The `New room` route will default newly selected users to focused so the new room appears in their room workspace immediately.

### 4. Use shared item/avatar primitives in NewRoom

The `New room` route will use shared `Item.Root`, `ProfileAvatar`, and role selection controls so the initial-user picker stays visually aligned with the rest of the message-system management UI.

### 5. Runtime room attention must stay actor-scoped

`session-runtime` must treat the message-system as a shared bus, not a personal inbox. Message and focus events therefore need actor-scoped filtering before they become loop inputs or attention wakeups:

- queued room messages only enter a runtime if that runtime actor can access the room
- room focus changes only wake the runtime whose actor focus set changed

This preserves the orthogonality between shared room truth and per-actor runtime wakeups.

### 6. Global room ids become opaque

`allocateGlobalRoomId()` will stop deriving ids from room titles. New ids should be generated from an opaque, collision-resistant token so route stability is not coupled to UI labels. The UI continues to route using the returned `chatId`, but that `chatId` is no longer human-authored text.

## Risks / Trade-offs

- [Risk] Initial-user create semantics change multiple packages at once. → Mitigation: keep the new payload additive and preserve existing create callers.
- [Risk] A selected user could already have a prior grant if a duplicate room id is reused in tests. → Mitigation: reuse the existing grant replacement semantics in the control plane.
- [Risk] Auto-focus on create could be surprising for special callers. → Mitigation: keep `focused` explicit in the create payload and default it from the WebUI route instead of hardcoding it for every caller.
- [Risk] Tightening runtime message/focus filtering could hide legitimate room wakeups. → Mitigation: gate on actual room access/focus truth, then add regression tests with selected vs unselected avatars.
- [Risk] Opaque room ids change test fixtures and copy-to-clipboard expectations. → Mitigation: keep explicit `chatId` override support for tests and admin tooling, and only change the default allocator.

## Migration Plan

1. Add OpenSpec deltas for room-create initial-user grants, actor-scoped runtime attention, opaque room ids, and NewRoom UI requirements.
2. Extend message-system/app-server/client create-room payloads with `initialUsers`.
3. Tighten session-runtime message/focus subscriptions so only granted actors consume room work.
4. Replace the default global room allocator with an opaque id generator.
5. Rebuild the `New room` route to collect user role/focus choices and submit them through the new payload.
6. Verify that creation lands on the returned room id, selected users appear as granted seats immediately, and unselected avatars stay outside the room and its attention stream.

Rollback is straightforward: remove `initialUsers` handling and revert the NewRoom UI changes.

## Open Questions

- None for this change.
