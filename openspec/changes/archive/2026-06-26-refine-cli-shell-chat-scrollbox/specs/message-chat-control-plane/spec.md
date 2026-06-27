## MODIFIED Requirements

### Requirement: Chat transport SHALL expose snapshot and incremental messages

A room transport endpoint SHALL deliver an initial room snapshot followed by incremental message updates for that global room, regardless of whether any session runtime is currently active. Authorized room page reads SHALL remain available as the stable source for loading older transcript windows in app views such as cli-shell Chat.

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

#### Scenario: App transcript views page older history from room truth
- **GIVEN** a app transcript view has loaded a recent room snapshot with `nextBefore` and `hasMoreBefore`
- **WHEN** the app needs older messages before the current window
- **THEN** it reads an authorized room page using `before = nextBefore`
- **AND** the returned page updates `nextBefore` and `hasMoreBefore`
- **AND** the app does not create a second durable transcript store to support incremental loading
