## ADDED Requirements

### Requirement: Message command surfaces SHALL use explicit room identity or explicit message-source routing

User-facing and operator-facing message sends SHALL require an explicit room target unless the runtime is replying from an existing message-origin attention/source path that already identifies the destination room. Session existence alone MUST NOT be used to synthesize a room target.

#### Scenario: Operator send without room target fails directly

- **GIVEN** a caller asks to send a visible room message without specifying a room target
- **WHEN** the command surface validates the request
- **THEN** the request fails with a direct "room must be specified" style error
- **AND** the system does not synthesize or guess a destination room from session state

#### Scenario: Runtime follow-up reply routes from the originating message source

- **GIVEN** an attention cycle was triggered from a message-system source that identifies a room
- **WHEN** the runtime produces a visible reply without an explicit override room id
- **THEN** the reply routes back to the originating room identified by that source
- **AND** routing does not depend on a session-level default room field

#### Scenario: Non-message source cannot emit a room reply without an explicit room target

- **GIVEN** an attention cycle was triggered only by terminal/task/other non-message sources
- **WHEN** a visible room send is attempted without an explicit room target
- **THEN** the send fails with a direct missing-room error
- **AND** the runtime does not fall back to a built-in/default room

### Requirement: Explicit room errors SHALL reflect explicit room state instead of hidden fallback rules

When a caller specifies a room id, the result SHALL be determined only by that explicit room's real state and grants. Unknown room ids, archived rooms, deleted rooms, and missing grants MUST surface as their own errors. The system SHALL NOT use a hidden "protected room" or "built-in room" concept to block ordinary room lifecycle actions.

#### Scenario: Archived room send reports archived-room failure

- **GIVEN** a caller explicitly targets an archived room
- **WHEN** a send or interactive room mutation is requested
- **THEN** the command fails because that explicit room is archived
- **AND** the failure does not redirect or retry through another room

#### Scenario: Unknown or deleted room reports explicit lookup failure

- **GIVEN** a caller explicitly targets an unknown room id or a room that was already deleted
- **WHEN** the command surface resolves the target
- **THEN** the command fails because that explicit room does not exist
- **AND** the failure is not masked by any session-level default room

#### Scenario: Ordinary room lifecycle has no hidden protected-room exception

- **GIVEN** a room is otherwise eligible for archive or delete under its explicit grants and state
- **WHEN** the lifecycle mutation is requested
- **THEN** the decision is made from those explicit grants and state only
- **AND** the system does not reject the mutation just because the room used to be treated as a default or built-in room

### Requirement: Public control plane SHALL retire `chat.*` as a first-class truth-facing surface

The public control plane SHALL NOT expose top-level `chat.*` surfaces as the contract for room transcript truth or runtime cycle truth. Room transcript reads/writes belong to room/message surfaces. Runtime cycle and heartbeat inspection belong to runtime/heartbeat projection surfaces and MUST remain visibly identified as projections rather than transcript truth.

#### Scenario: Room transcript and runtime cycle surfaces stay semantically distinct

- **GIVEN** an operator inspects room transcript history and runtime cycle history
- **WHEN** the public control plane serves those reads
- **THEN** room transcript data comes from room/message surfaces
- **AND** runtime cycle or heartbeat data comes from projection-oriented inspection surfaces
- **AND** neither surface is labeled or routed through top-level `chat.*`
