## MODIFIED Requirements

### Requirement: Room-backed muted contexts SHALL be able to drive companion archive projection

When a room-backed `AttentionContext` is explicitly moved to `muted`, the system SHALL preserve that context's durable history while allowing the bound room surface to project into `archived` lifecycle state.

#### Scenario: Muting a room-backed context archives the companion room

- **WHEN** a room-backed `AttentionContext` is explicitly changed to `muted`
- **THEN** the context remains durable and queryable
- **AND** the bound room may transition to `archived`
- **AND** that transition does not delete room history

#### Scenario: Archive projection does not erase room capability

- **WHEN** a room is archived because its companion context became `muted`
- **THEN** the room still keeps its durable transcript and identity
- **AND** archive is treated as lifecycle/visibility state rather than implicit delete or send prohibition
