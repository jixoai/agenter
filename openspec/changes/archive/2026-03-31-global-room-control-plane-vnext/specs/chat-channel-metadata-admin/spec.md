## MODIFIED Requirements

### Requirement: Admin access SHALL mutate chat-channel metadata
A caller with current room-admin access SHALL be able to update mutable global room metadata, including title, room metadata fields, participant actor bindings, and the ordered room admin-group candidate list, while non-admin callers remain read-only for those concerns.

#### Scenario: Admin updates title, participant actors, and candidate order
- **WHEN** a room admin updates the room title, participant actor list, or admin-group candidate order
- **THEN** the room metadata is persisted in the global message authority for subsequent reads
- **THEN** connected clients observe the updated metadata through the shared room surface

#### Scenario: Member cannot mutate metadata
- **WHEN** a caller with `member` access attempts to update room title or participant bindings
- **THEN** the control plane rejects the request
- **THEN** existing room metadata remains unchanged

### Requirement: Admin access SHALL issue and revoke channel tokens
A caller with current room-admin access SHALL be able to issue and revoke room grants for `admin`, `member`, or `readonly` access, and grants SHALL be attachable to an auth actor or a session actor.

#### Scenario: Admin issues a member grant for a session actor
- **WHEN** a room admin requests a new `member` grant for a specific session actor
- **THEN** the control plane returns a new room credential scoped to that room and role
- **THEN** the session actor can use that grant immediately through room-scoped APIs and transport

#### Scenario: Revoked grant loses access
- **WHEN** an admin revokes a previously issued room grant
- **THEN** subsequent API or transport requests using that grant are rejected
- **THEN** the revoked grant no longer appears in room admin listings
