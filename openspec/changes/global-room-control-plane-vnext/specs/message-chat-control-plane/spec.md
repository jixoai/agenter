## REMOVED Requirements

### Requirement: Chat channels SHALL use canonical id prefixes
**Reason**: durable message resources no longer distinguish `chat-*` and `room-*`; only `room-*` remains.
**Migration**: all new durable message resources use `room-*`; any built-in direct-chat semantics move to session bindings over a primary room.

## MODIFIED Requirements

### Requirement: Message-system SHALL manage multiple chat channels
The message control plane SHALL manage multiple global room resources independently from session lifecycles. Auth actors and session actors MAY attach to the same room, and room durability SHALL NOT depend on any single session remaining alive.

#### Scenario: One room is shared by human and session actors
- **WHEN** an auth actor and one or more session actors are granted access to the same room
- **THEN** each actor can observe or contribute according to its grant
- **THEN** the room history remains one shared durable timeline instead of per-session copies

#### Scenario: Same avatar label can appear as separate session seats
- **WHEN** two different session actors that happen to share the same avatar label join one room
- **THEN** the room transport and access model still treat them as separate session actors
- **THEN** collaboration state is keyed by actor identity rather than by the visible label alone

#### Scenario: Room survives session stop
- **WHEN** the last attached session for a room stops or is deleted
- **THEN** the room definition, grants, history, and assets remain available in the global message store
- **THEN** a later auth actor or session actor can reattach to that same room

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
