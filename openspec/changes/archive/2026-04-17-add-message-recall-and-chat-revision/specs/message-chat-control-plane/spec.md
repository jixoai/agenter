## ADDED Requirements

### Requirement: Durable room messages SHALL support sender-authored recall
The message control plane SHALL let the original sender recall their own durable room message without changing that message's `messageId`, frozen read membership, or place in the room timeline. A recalled message SHALL expose explicit recall metadata and SHALL no longer expose its stale user-visible body as if it were still the active room truth.

#### Scenario: Sender recalls their own durable room message
- **WHEN** the original sender recalls a previously sent room message through an authorized room credential
- **THEN** the control plane keeps the same `messageId`, `createdAt`, and frozen read arrays
- **THEN** the updated room record exposes explicit recall metadata
- **THEN** the room record no longer returns the stale original body as the current visible message content

#### Scenario: Different participant cannot recall another sender's room message
- **WHEN** a different ordinary room member attempts to recall someone else's durable room message
- **THEN** the control plane rejects the mutation
- **THEN** the target message remains unchanged in durable room truth

#### Scenario: Recalled message remains a durable room fact
- **WHEN** a room snapshot, page read, or incremental transport update includes a recalled message
- **THEN** that recalled message still appears in its original timeline position
- **THEN** consumers can tell that the message was recalled from the durable record itself instead of inferring it from a synthetic follow-up row

## MODIFIED Requirements

### Requirement: Chat transport SHALL expose snapshot and incremental messages
A room transport endpoint SHALL deliver an initial room snapshot followed by incremental message updates for that global room, regardless of whether any session runtime is currently active.

#### Scenario: Web client connects to a room endpoint
- **WHEN** a websocket client connects to an authorized room transport endpoint
- **THEN** the server sends the room snapshot first
- **THEN** later sends append or upsert events for new or updated messages in that room

#### Scenario: Room transport stays available without a running session
- **WHEN** a client reads or pages a room whose prior contributing session is no longer running
- **THEN** the message control plane still returns the durable room snapshot and history
- **THEN** the client does not depend on reviving the old session to read that room

#### Scenario: Message lifecycle updates arrive as incremental upserts
- **WHEN** a room message is later edited, recalled, or marked as attention-loaded
- **THEN** the transport pushes the updated message record with the same `messageId`
- **AND** the client can update transcript placement and lifecycle state without reloading the whole channel

### Requirement: Message-system SHALL define communication semantics through skills and attention
The message control plane SHALL express room-facing obligations through durable message facts and attention items, and the owning message skill guidance SHALL describe message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch and message correction semantics instead of reducing room CLI usage to mechanical quote forwarding.

#### Scenario: Message skill teaches role-aware relay
- **WHEN** room work requires the assistant to use message-system
- **THEN** the message skill explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Message attention items preserve assistant role boundaries
- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the message skill and message-shaped attention items remind it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime

#### Scenario: Message skill distinguishes send edit and recall
- **WHEN** the assistant already has a durable room message and later learns it is incomplete, stale, or should be withdrawn
- **THEN** the skill explains when to send a second message, when to edit the prior message in place, and when to recall it before replying again
- **AND** the guidance treats `send`, `edit`, and `recall` as separate message-system actions rather than as one overloaded command
