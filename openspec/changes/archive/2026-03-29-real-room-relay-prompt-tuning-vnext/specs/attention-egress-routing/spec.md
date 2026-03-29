## MODIFIED Requirements

### Requirement: Chat visibility SHALL require successful message egress

A reply SHALL appear in Chat only after a message egress adapter has accepted and successfully dispatched it into a chat channel. For chat-backed work that requires a round trip across rooms, successful egress into the secondary relay room does NOT complete the task by itself; the work remains unresolved until successful message egress also reaches the originating requester room.

#### Scenario: Internal attention stays out of Chat

- **WHEN** the runtime commits or patches an internal attention item without a successful message egress dispatch
- **THEN** the Chat transcript does not render that item as an assistant reply
- **THEN** the activity remains available only through technical inspection surfaces

#### Scenario: Failed message egress does not create a transcript row

- **WHEN** a committed attention item matches a chat adapter but dispatch fails
- **THEN** the runtime records the failed egress attempt for technical inspection
- **THEN** Chat does not render a user-visible assistant reply from that failed delivery

#### Scenario: Relay work stays unresolved until the requester room receives the final answer

- **GIVEN** a chat-backed task begins in `chat-main`
- **AND** the assistant relays part of the task through another room
- **WHEN** the relay room receives the intermediate question but `chat-main` has not yet received the final answer
- **THEN** the runtime still treats the task as unresolved
- **THEN** the originating-room answer remains a required egress before completion can be recorded
