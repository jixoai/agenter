# message-chat-control-plane Specification

## Purpose
Define the global room-first message control plane, its transport contract, and the model-facing semantics for collaboration across auth actors and session actors.
## Requirements
### Requirement: Message-system SHALL manage multiple chat channels
The message control plane SHALL manage multiple global room resources independently from session lifecycles. Auth actors and session actors MAY attach to the same room, room durability SHALL NOT depend on any single session remaining alive, and room-local read-state SHALL remain durable per actor seat.

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

#### Scenario: Queued user input stays visible while awaiting attention
- **WHEN** a member sends a text message through an authorized chat transport
- **THEN** the message is persisted in a queued attention state
- **AND** it remains visible in the room transcript in send order while still being editable until attention loads it

#### Scenario: Assistant-visible output is immediately visible
- **WHEN** the runtime or assistant writes a visible reply or structured error through the control plane
- **THEN** the message is persisted as already loaded and visible
- **AND** it does not enter any queued-only room presentation mode

#### Scenario: Room read-state survives session stop
- **WHEN** a room has actor-scoped read-state and one contributing session later stops
- **THEN** the room history and room read-state remain available in the global message store
- **THEN** a later actor reattaching to that room can still observe the current read progression

### Requirement: Room lifecycle SHALL distinguish archive from dissolve

Room lifecycle APIs SHALL expose archive as a reversible visibility action and dissolve/delete as a destructive removal action, and room provenance metadata such as `builtIn` SHALL NOT by itself suppress global cleanup affordances.

#### Scenario: Admin dissolves a legacy bootstrap room
- **WHEN** an admin deletes a room that still carries legacy bootstrap provenance metadata
- **THEN** the room can still be dissolved through the normal room lifecycle API
- **AND** the room's provenance metadata does not by itself block destructive cleanup

### Requirement: Room participant membership SHALL not encode actor-kind identity roles

Room participant lists SHALL model room seat membership only, not `avatar|user|system` identity-role labels, and message-system SHALL persist only canonical actor-backed participant ids.

#### Scenario: New room write strips legacy participant ids
- **WHEN** the client creates or updates a room participant list containing legacy ids such as `avatar:*` or bare `user`
- **THEN** the write persists only canonical `auth:` / `session:` / `system:` participant ids
- **AND** invalid legacy ids are removed instead of being preserved in durable room truth

#### Scenario: Bootstrap repair rewrites an old room with canonical participants
- **WHEN** app-server reattaches to an existing room whose stored participant list still contains invalid legacy ids
- **THEN** the room is rewritten with the normalized canonical participant list
- **AND** subsequent room reads stop surfacing those invalid legacy participants

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
- **WHEN** a queued message is later edited or marked as attention-loaded
- **THEN** the transport pushes the updated message record with the same `messageId`
- **AND** the client can update pending/transcript placement without reloading the whole channel

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

