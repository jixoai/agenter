## MODIFIED Requirements

### Requirement: Room lifecycle SHALL distinguish archive from dissolve

Room archive SHALL remain a reversible lifecycle state, and room-backed `AttentionContext` lifecycle MAY become one of the canonical causes that drive a room into that archived state.

#### Scenario: Companion muted context archives the room without dissolving it

- **WHEN** a room-backed `AttentionContext` enters `muted`
- **THEN** message-system may mark the companion room as `archived`
- **AND** the room remains readable, addressable, and durable
- **AND** the room is not dissolved or deleted by that lifecycle change
