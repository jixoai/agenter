## 1. Global room authority

- [x] 1.1 Remove durable `chat-*` semantics and define `room-*` as the only message resource type.
- [x] 1.2 Move room definitions, grants, history, and assets into the global `.message` authority.
- [x] 1.3 Define room discovery and lifecycle APIs that work without any active session runtime.

## 2. Actor-bound room access

- [x] 2.1 Bind room grants to auth actors and session actors instead of free-form participant ids.
- [x] 2.2 Define global superadmin recovery behavior plus single-current-admin and ordered admin-group failover for room-local admin behavior.
- [x] 2.3 Define room metadata, grant administration, and pending-admin-work reassignment around the new actor model.

## 3. Session projection and Web room view

- [ ] 3.1 Define room-to-session projection facts so `session.db` stores refs instead of full room history truth.
- [x] 3.2 Update the Web chat view contract from channel-first to room-first transport and paging semantics.
- [x] 3.3 Define app-server read-model joining behavior for room truth plus session facts.

## 4. Verification

- [x] 4.1 Add message-system tests for room creation, room grants, admin-group failover, explicit invalid-credential errors, and superadmin recovery.
- [x] 4.2 Add app-server tests for session projection reads and room survival after session stop/delete.
- [x] 4.3 Add Web chat view tests for room transport hydration and reverse-time paging.
