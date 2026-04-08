## ADDED Requirements

### Requirement: Typed entity icon media SHALL remain semantically separated
The media system SHALL keep typed entity icon owners in separate semantic URL spaces even when one backend authority serves them. Room icon media SHALL use a distinct semantic URL family from session and profile/avatar media, and future typed owners SHALL follow the same rule.

#### Scenario: Room icon URL stays distinct from session and profile media
- **WHEN** the client resolves icon URLs for a room, a session, and a profile
- **THEN** each request uses a distinct semantic URL pattern for its owner type
- **THEN** the caller can distinguish room identity media from session or profile media without inspecting implementation details

#### Scenario: Typed entity icons do not collapse into a generic bucket
- **WHEN** a new typed icon owner is introduced
- **THEN** its media reads and writes remain under an owner-specific semantic URL family
- **THEN** the system does not expose a single untyped icon bucket that hides ownership semantics
