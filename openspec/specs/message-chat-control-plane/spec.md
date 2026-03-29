# message-chat-control-plane Specification

## Purpose
TBD - created by archiving change message-system-chat-control-plane. Update Purpose after archive.
## Requirements
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

### Requirement: Message-system SHALL define communication semantics for model work
The message control plane SHALL contribute provider-owned system guidance that describes message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch instead of reducing message tools to mechanical quote forwarding.

#### Scenario: Prompt guide teaches role-aware relay
- **WHEN** a model call includes message-system tools
- **THEN** the system prompt explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Prompt guide preserves assistant role boundaries
- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the system prompt reminds it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime
