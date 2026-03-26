Define the canonical control plane for built-in chat channels.

## ADDED Requirements

### Requirement: Message-system SHALL manage multiple chat channels
The message control plane SHALL allow multiple chat-channel instances to coexist under one runtime.

#### Scenario: One avatar owns two active channels
- **WHEN** two chat channels are created for the same avatar owner
- **THEN** both channels can receive and query messages independently
- **THEN** focus state can include one or both channel ids

### Requirement: Chat channels SHALL use canonical id prefixes
One-to-one channels SHALL use `chat-` ids and group channels SHALL use `room-` ids.

#### Scenario: Invalid group prefix is rejected
- **WHEN** a caller tries to create a group channel with a `chat-` id
- **THEN** the control plane rejects the request
- **THEN** persisted metadata remains prefix-consistent

### Requirement: Chat transport SHALL expose snapshot and incremental messages
A chat transport endpoint SHALL deliver an initial snapshot followed by incremental message updates.

#### Scenario: Web client connects to a chat endpoint
- **WHEN** a websocket client connects to `/chat/$CHAT_ID`
- **THEN** the server sends the channel snapshot first
- **THEN** later sends append events for new messages in that channel
