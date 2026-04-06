## MODIFIED Requirements

### Requirement: Room creation SHALL materialize initial user grants and focus

The message control plane SHALL allow room creation to declare initial users with canonical actor identity, role, and focus intent so those users join the room as real seats during the create flow.

#### Scenario: New room creates initial user grants
- **WHEN** the client creates a room with initial users `auth:alice` and `session:jj`
- **THEN** the room persists canonical participant membership for those actors
- **AND** the control plane issues real room grants for those actors with the requested roles

#### Scenario: New room auto-focuses selected users
- **WHEN** a room is created with an initial user marked as focused
- **THEN** that user's focused-room state includes the new room immediately
- **AND** the operator does not need a second follow-up focus mutation to make the room visible to that user
