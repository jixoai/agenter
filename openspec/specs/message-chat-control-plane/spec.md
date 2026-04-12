# message-chat-control-plane Specification

## Purpose
Define the global room-first message control plane, its transport contract, and the model-facing semantics for collaboration across auth actors and session actors.
## Requirements
### Requirement: Message-system SHALL manage multiple chat channels
The message control plane SHALL manage multiple global room resources independently from session lifecycles. Auth actors and session actors MAY attach to the same room, room durability SHALL NOT depend on any single session remaining alive, room-local read-state SHALL remain durable as per-message frozen read membership rather than mutable actor read cursors, and durable room messages SHALL NOT encode AI scheduling or cycle queue state.

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

#### Scenario: Authorized text input becomes a durable visible room fact without AI state
- **WHEN** a member sends a text message through an authorized chat transport
- **THEN** the message is persisted immediately as a durable visible room fact in send order
- **THEN** the stored room message keeps canonical sender identity and frozen read arrays
- **THEN** the stored room message does not add an AI-specific queue or load field

#### Scenario: Assistant-visible output is immediately visible
- **WHEN** the runtime or assistant writes a visible reply or structured error through the control plane
- **THEN** the message is persisted as already loaded and visible
- **AND** it does not enter any queued-only room presentation mode

#### Scenario: Room read-state survives session stop
- **WHEN** a room has message-level durable read-state and one contributing session later stops
- **THEN** the room history and room read-state remain available in the global message store
- **THEN** a later actor reattaching to that room can still observe the current read progression without recomputing prior message membership

### Requirement: Message control plane SHALL expose unread room summaries and unread subscriptions
The message control plane SHALL expose authorized unread summary reads and actor-scoped unread subscriptions so runtimes can discover unread room work without scanning whole room histories.

#### Scenario: Authorized runtime reads unread room summaries
- **WHEN** an authorized runtime reads unread summaries for actor `A`
- **THEN** the control plane returns per-room unread counts, latest unread ordering facts, and the latest durable read floor for `A`
- **THEN** the runtime can rank rooms without paging the full message history of every room

#### Scenario: Authorized runtime waits on unread state instead of polling room rows
- **GIVEN** actor `A` currently has no unread rooms
- **AND** a runtime is waiting on `A`'s unread subscription through the control plane
- **WHEN** a new unread room message is persisted for `A`
- **THEN** the unread wait resolves
- **THEN** the runtime can perform one new unread summary read instead of polling all room rows

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

### Requirement: Global room ids SHALL be principal ids

New global rooms SHALL be allocated from managed room principals, and the control plane SHALL reject legacy non-principal room ids for new durable room writes.

#### Scenario: New room id is a room principal
- **WHEN** the client creates a new global room without an explicit `chatId`
- **THEN** the returned room id is a lowercase `0x...` principal id
- **AND** that room id is backed by persisted managed principal material

#### Scenario: New room write rejects legacy `room-*` ids
- **WHEN** a caller attempts to create a new room with a legacy synthetic id such as `room-main-*` or `room-team`
- **THEN** the write is rejected instead of creating new durable room truth under that legacy id
- **AND** only lowercase `0x...` principal ids remain valid for new room creation

#### Scenario: Breaking schema reset removes legacy room durability
- **WHEN** message durability is opened after the principal-only room-id migration
- **THEN** older durable rows that may still contain legacy `room-*` room ids are cleared by the breaking reset
- **AND** new durability created after that reset stores only principal-backed room ids

### Requirement: Principal ids SHALL be accepted as room actors

Room actor validation SHALL accept raw principal ids for new runtimes and authenticated users.

#### Scenario: Avatar runtime joins a room as a principal
- **WHEN** a session runtime binds to an avatar principal id
- **THEN** room focus, grants, and message visibility can use that principal id directly
- **AND** the control plane does not require `session:<id>` for new runtimes

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

### Requirement: Room messages SHALL preserve durable acting actor identity
The message control plane SHALL persist the canonical acting actor identity for each room message in addition to any display label, and every snapshot, page, and incremental transport payload SHALL expose that durable sender identity unchanged.

#### Scenario: Same-label actors send distinct room messages
- **WHEN** two different actors with the same visible label both send messages into one room
- **THEN** the persisted message records keep distinct canonical actor identities for each send
- **THEN** room transport consumers can distinguish those sends without inferring identity from labels

#### Scenario: Send-as authority becomes durable message fact
- **WHEN** an operator chooses a room token and sends a message as that actor
- **THEN** the resulting room message persists the selected acting actor identity
- **THEN** later snapshot or page reads preserve that identity even after refresh or reconnect

### Requirement: Global room messages SHALL persist attachment references from room-owned assets
The global room message control plane SHALL allow room text messages to reference previously uploaded room-owned asset identifiers. When a room message is sent with authorized room asset ids, the persisted room message record MUST expose the corresponding attachment metadata through snapshot, page, and incremental transport reads.

#### Scenario: Room send stores attachment references
- **WHEN** an authorized caller sends a global room message with one or more uploaded room asset identifiers
- **THEN** the stored room message includes those attachment references
- **THEN** later room snapshot, page, and transport reads expose the same attachment metadata for transcript rendering

#### Scenario: Room attachment history survives reconnect
- **WHEN** a client reconnects to a room that already contains messages with room-owned attachments
- **THEN** the control plane still returns those attachment references with the durable room history
- **THEN** the client does not need a running session runtime to reconstruct the room attachment timeline

### Requirement: Message-system SHALL define communication semantics through skills and attention
The message control plane SHALL express room-facing obligations through durable message facts and attention items, and the owning message skill guidance SHALL describe message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch instead of reducing room CLI usage to mechanical quote forwarding.

#### Scenario: Message skill teaches role-aware relay
- **WHEN** room work requires the assistant to use message-system
- **THEN** the message skill explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Message attention items preserve assistant role boundaries
- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the message skill and message-shaped attention items remind it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime
