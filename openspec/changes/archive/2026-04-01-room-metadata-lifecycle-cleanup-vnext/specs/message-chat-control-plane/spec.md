## MODIFIED Requirements

### Requirement: Room lifecycle SHALL distinguish archive from dissolve

Room lifecycle APIs SHALL expose archive as a reversible visibility action and dissolve/delete as a destructive removal action, and room provenance metadata such as `builtIn` SHALL NOT by itself suppress global cleanup affordances.

#### Scenario: Admin dissolves a legacy bootstrap room
- **WHEN** an admin deletes a room that still carries legacy bootstrap provenance metadata
- **THEN** the room can still be dissolved through the normal room lifecycle API
- **AND** the room's provenance metadata does not by itself block destructive cleanup

### Requirement: Room participant membership SHALL not encode actor-kind identity roles

Room participant lists SHALL model room seat membership only, not `avatar|user|system` identity-role labels, and message-system SHALL persist only canonical actor-backed participant ids.

#### Scenario: New room write strips legacy participant ids
- **WHEN** the client creates or updates a room participant list containing legacy ids such as `avatar:*` or bare `user`
- **THEN** the write persists only canonical `auth:` / `session:` / `system:` participant ids
- **AND** invalid legacy ids are removed instead of being preserved in durable room truth

#### Scenario: Bootstrap repair rewrites an old room with canonical participants
- **WHEN** app-server reattaches to an existing room whose stored participant list still contains invalid legacy ids
- **THEN** the room is rewritten with the normalized canonical participant list
- **AND** subsequent room reads stop surfacing those invalid legacy participants
