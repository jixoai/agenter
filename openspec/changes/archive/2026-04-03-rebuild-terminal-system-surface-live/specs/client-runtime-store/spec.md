## MODIFIED Requirements

### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics
The client runtime store SHALL normalize workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment bindings as first-class resource maps. It SHALL NOT collapse those resources back into session-owned `*BySession` stores as the primary identity axis, and it SHALL continue to preserve terminal focus-set semantics.

#### Scenario: Store receives global resources plus running avatars
- **WHEN** the runtime store ingests snapshots containing workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment metadata
- **THEN** it preserves workspace ids, avatar/session ids, room ids, and terminal ids as distinct primary identities
- **THEN** selectors can derive workspace and running-avatar views without copying those resources into session-owned authority maps

#### Scenario: Terminal live resources update by terminal id
- **WHEN** the store receives a live terminal snapshot, status, activity, grant, approval, or focus event
- **THEN** it updates the affected terminal resource slices keyed by terminal id
- **THEN** unrelated terminals remain unchanged and selected route views can refresh from the normalized state without polling
