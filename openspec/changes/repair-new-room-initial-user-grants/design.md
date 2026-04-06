## Context

The message-system law currently separates room membership truth (`participants`) from permission truth (`grants`) and focus truth. That separation is correct, but the `New room` flow only writes `participants`, so a room can be created in a partially materialized state where the UI says users were selected but the control plane has not actually granted or focused them.

The right fix is not a client-side cascade of follow-up calls. Room creation itself needs to own initial grant/focus materialization so the create flow is atomic from the operator's perspective.

## Goals / Non-Goals

**Goals:**
- Let room creation accept initial users with role and focus intent.
- Materialize selected users as actual room grants during creation.
- Auto-focus the newly created room for the relevant users.
- Rebuild the `New room` user picker as avatar-rich item rows with inline role selection and user wording.

**Non-Goals:**
- Redesign the post-create room management dialog.
- Rename every internal `participantId` type in the stack; the user-facing surface changes first.
- Introduce a second room-creation API just for WebUI.

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

## Risks / Trade-offs

- [Risk] Initial-user create semantics change multiple packages at once. → Mitigation: keep the new payload additive and preserve existing create callers.
- [Risk] A selected user could already have a prior grant if a duplicate room id is reused in tests. → Mitigation: reuse the existing grant replacement semantics in the control plane.
- [Risk] Auto-focus on create could be surprising for special callers. → Mitigation: keep `focused` explicit in the create payload and default it from the WebUI route instead of hardcoding it for every caller.

## Migration Plan

1. Add OpenSpec deltas for room-create initial-user grants and NewRoom UI requirements.
2. Extend message-system/app-server/client create-room payloads with `initialUsers`.
3. Rebuild the `New room` route to collect user role/focus choices and submit them through the new payload.
4. Verify that creation lands on the new room and that selected users appear as granted seats immediately.

Rollback is straightforward: remove `initialUsers` handling and revert the NewRoom UI changes.

## Open Questions

- None for this change.
