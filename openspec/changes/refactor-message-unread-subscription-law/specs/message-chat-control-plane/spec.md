## MODIFIED Requirements

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

#### Scenario: Room read-state survives session stop
- **WHEN** a room has message-level durable read-state and one contributing session later stops
- **THEN** the room history and room read-state remain available in the global message store
- **THEN** a later actor reattaching to that room can still observe the current read progression without recomputing prior message membership

## ADDED Requirements

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
