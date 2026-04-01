## Context

The backend already exposes global room listing, room snapshots/pages, grants, room updates, archive/delete operations, auth actor catalogs, and profile projections. The frontend problems have been mostly around incorrect product modeling: mixing room with chat, allowing non-auth-backed identities, keeping stale local state, and prioritizing attention-style unread hints that do not fit group chat.

## Goals / Non-Goals

**Goals:**
- Build a room-first message-system UI on top of existing SDK APIs.
- Use auth/profile projections as the single source of actor identity and avatar rendering.
- Make grant management and send-as flows explicit in the UI.
- Show room read progress instead of session-style attention hints.

**Non-Goals:**
- Do not reintroduce session-bound chat routes as the primary room UI.
- Do not add TaskSystem integration.
- Do not implement every future room feature beyond core messaging and access control.

## Decisions

### 1. `/messages` is a global room surface
The new route will present the room catalog, transcript, and access/users panel as a standalone message-system product surface.

Alternative considered:
- Keep `/chats` semantics and adapt them. Rejected because it preserves the wrong product vocabulary.

### 2. Actor identity comes only from auth/profile sources
The UI will use `listAuthActors`, `listProfiles`, and profile/icon projections for actor selection and presentation. Room membership will not invent local placeholder actors.

Alternative considered:
- Keep local fake participants and backfill later. Rejected because it reproduces the exact identity drift the user reported.

### 3. Send-as and grant flows are explicit operator actions
The composer and access dialogs will require an actor selection, and their actions will thread the chosen actor's token/grant context through the SDK APIs.

Alternative considered:
- Infer the acting user from the current operator session. Rejected because rooms intentionally support independent seats and tokens.

### 4. Group chat read state uses progress semantics
Unread presentation will be based on read progress/ring semantics and read timestamps per participant, not on attention-oriented pending labels.

Alternative considered:
- Preserve "Pending for attention". Rejected because it models single-recipient attention, not group reading state.

## Risks / Trade-offs

- **Room detail state can drift after mutations** → Reuse the runtime store plus targeted refreshes rather than local duplicated collections.
- **Access dialog becomes too complex** → Keep one room access dialog with searchable actor selection and explicit seat/grant actions.
- **Large transcripts may regress performance** → Consume the shared `ScrollView`/virtualization primitives from the shell change.
