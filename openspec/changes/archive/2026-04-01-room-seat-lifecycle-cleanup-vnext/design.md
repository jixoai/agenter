## Architecture Notes

### 1. Room seat membership is not actor identity kind

- `auth:` vs `session:` is actor identity provenance, not room permission.
- room participant lists should only answer: which seats belong to this room?
- room permissions stay in grants or admin assignment, not in `participant.role = avatar|user|system`

### 2. Archive and dissolve are different room lifecycle facts

- archive means the room is hidden from normal active lists but its durable history remains queryable
- dissolve/delete means the room truth is removed from message-system storage, including grants, messages, and read-state
- the UI must expose both explicitly instead of calling archive a delete

### 3. Actor picker should be conservative

- auth actors come from auth-system public catalog
- session seats come from valid session projections only
- archived or legacy residue must not auto-expand into a room membership draft
- room creation should start empty and let the operator add the intended seats

### 4. Avatar rendering must be correct on the default media path

- the semantic icon URL should stay stable
- fallback icons must render with color on the default raster path, not only when explicitly requesting raw SVG
- fix the renderer inputs rather than forcing WebUI to guess alternate query parameters

### 5. Backward cleanup rule

- old persisted participant entries may still carry deprecated `avatar|user|system` fields
- readers may tolerate that legacy field, but new writes should stop producing it
- quickstart and room metadata editors should normalize legacy data away on save

## Verification Slice

### Required scenarios

- room lifecycle and admin actions: room archive vs dissolve, active-list refresh, deleted room disappearance
- room participant editing: no legacy identity-role selector, no auto-seeded session flood, deduped seat persistence
- actor directory projection: auth actors render labels/icons, archived or stale session residue does not dominate picker UX
- avatar fallback rendering: default profile/session icon responses render non-black visible artwork

### Required evidence modes

- message-system/app-server/client-sdk tests for archive vs delete contracts
- WebUI unit or DOM tests for room create/edit participant UX and lifecycle actions
- profile-service tests covering default raster fallback output and SVG fallback structure
