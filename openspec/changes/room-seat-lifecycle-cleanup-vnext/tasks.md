## 1. Room lifecycle control-plane

- [x] 1.1 Add true room dissolve/delete APIs in message-system, app-server, and client-sdk, keeping archive as a separate action.
- [x] 1.2 Update global room WebUI affordances so admins can explicitly archive or dissolve a room.

## 2. Seat membership cleanup

- [x] 2.1 Remove legacy `avatar|user|system` participant role editing from room create/edit flows.
- [x] 2.2 Stop auto-populating new rooms with every session seat, and tighten actor option projection to avoid stale session residue flooding the picker.
- [x] 2.3 Normalize quickstart room bootstrap participant writes so deprecated identity-role fields stop being emitted.

## 3. Avatar rendering fix

- [x] 3.1 Fix profile-service fallback icon rendering so default raster responses produce usable colored avatars.
- [x] 3.2 Ensure WebUI actor cards continue to resolve auth-backed and session-backed icons through the same semantic URLs.

## 4. Verification

- [x] 4.1 Add/update backend and client tests for room dissolve/delete semantics.
- [x] 4.2 Add/update WebUI coverage for room participant editing without legacy identity roles.
- [x] 4.3 Add/update profile-service coverage for visible fallback icon rendering.
