## MODIFIED Requirements

### Requirement: Message-system SHALL manage multiple chat channels

The message control plane SHALL manage multiple global room resources independently from session lifecycles. Auth actors and session actors MAY attach to the same room, and room durability SHALL include room-local read-state per actor seat in addition to history and grants.

#### Scenario: Room read-state survives session stop
- **WHEN** a room has actor-scoped read-state and one contributing session later stops
- **THEN** the room history and room read-state remain available in the global message store
- **THEN** a later actor reattaching to that room can still observe the current read progression
