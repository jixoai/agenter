## MODIFIED Requirements

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management surface, send-as options, and room seat metadata SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses. Room management MAY show seat role, focus, presence, and credential state, but it SHALL NOT present room-level latest-visible read labels for those seats.

#### Scenario: Room manage users stays seat-oriented

- **WHEN** the operator opens room management for `Users`
- **THEN** each visible user row is resolved from canonical actor truth
- **AND** the surface may show role, focus, presence, and credential status for that seat
- **AND** it does not show `Read`, `Unread`, or `Joined later` badges derived from the latest visible room message

### Requirement: Room read state SHALL use message-level group read progress semantics

The room transcript SHALL present collaboration read state as message-level facts attached to message rows. The route SHALL NOT reintroduce room-level read summaries in the room toolbar, management shell, or any auxiliary room seat surface.

#### Scenario: Room surfaces avoid room-level read summary chrome

- **WHEN** the operator views a room toolbar, room-management dialog, or room seat list
- **THEN** those surfaces do not summarize the room as `x/y read`
- **AND** they do not present “current room latest progress” as a separate room-level fact
- **AND** read inspection remains attached to the relevant message row
