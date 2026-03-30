## MODIFIED Requirements

### Requirement: Message-system SHALL manage multiple chat channels

The message control plane SHALL allow multiple chat-channel instances to coexist under one runtime.

#### Scenario: Queued user input stays pending until attention reads it

- **WHEN** a member sends a text message through an authorized chat transport
- **THEN** the message is persisted in a queued attention state
- **AND** it remains editable and out of the main transcript until attention loads it

#### Scenario: Assistant-visible output is immediately visible

- **WHEN** the runtime or assistant writes a visible reply or structured error through the control plane
- **THEN** the message is persisted as already loaded and visible
- **AND** it does not enter the queued pending strip

### Requirement: Chat transport SHALL expose snapshot and incremental messages

A chat transport endpoint SHALL deliver an initial snapshot followed by incremental message updates.

#### Scenario: Message lifecycle updates arrive as incremental upserts

- **WHEN** a queued message is later edited or marked as attention-loaded
- **THEN** the transport pushes the updated message record with the same `messageId`
- **AND** the client can update pending/transcript placement without reloading the whole channel
