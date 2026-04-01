## MODIFIED Requirements

### Requirement: Room lifecycle SHALL distinguish archive from dissolve

Room lifecycle APIs SHALL expose archive as a reversible visibility action and dissolve/delete as a destructive removal action.

#### Scenario: Admin archives a room
- **WHEN** an admin archives a room
- **THEN** the room disappears from default active room lists
- **AND** its durable messages, grants, and read-state remain available to archived queries

#### Scenario: Admin dissolves a room
- **WHEN** an admin deletes a room
- **THEN** the room channel record is removed from message-system storage
- **AND** grants, messages, and read-state owned by that room are removed with it

### Requirement: Room participant membership SHALL not encode actor-kind identity roles

Room participant lists SHALL model room seat membership only, not `avatar|user|system` identity-role labels.

#### Scenario: New room write omits legacy identity role field
- **WHEN** the client creates or updates a room participant list
- **THEN** the write persists participant ids and optional labels
- **AND** it does not need to emit legacy actor-kind role markers
