# room-session-projection Specification

## Purpose
Define how session runtimes project global room truth into session facts without duplicating room-owned history.

## Requirements
### Requirement: Session runtimes SHALL persist room references instead of duplicating room truth
Session runtimes SHALL record room-message refs and projection metadata needed for runtime reasoning, but they SHALL NOT persist full copies of global room history as session-owned source records.

#### Scenario: Cycle consumes a room message
- **WHEN** a session cycle consumes a message from an attached room
- **THEN** the session fact store records the room id, message id, and projection metadata needed to reconstruct that cycle input
- **THEN** the full room message remains owned by the global message authority instead of being copied into session-owned history truth

#### Scenario: Deleting a session does not delete attached rooms
- **WHEN** a session that previously attached to one or more rooms is deleted
- **THEN** app-server removes only the session facts and bindings owned by that session
- **THEN** the underlying rooms and their durable histories remain intact

### Requirement: App-server SHALL compose session-facing room views from room truth and session facts
App-server SHALL rebuild session-facing room histories by joining session facts with global room truth instead of replaying room history out of `session.db` alone.

#### Scenario: Session inspector resolves room-backed history after runtime stop
- **WHEN** a session is no longer running but its cycle facts reference room messages
- **THEN** app-server can still reconstruct the relevant session-facing timeline by loading those room message refs from the global message store
- **THEN** the read path does not require the runtime to be resumed

#### Scenario: Session primary room id is persisted instead of derived from session id
- **WHEN** app-server creates or reuses a session
- **THEN** it persists a managed principal-backed `primaryRoomId` in session durability
- **AND** later runtime starts and stopped-session read paths reuse that stored room id instead of deriving `room-main-${sessionId}`

#### Scenario: Runtime-created rooms use managed room principal allocation
- **WHEN** a running session creates an additional room through runtime tooling
- **THEN** app-server allocates a managed room principal for that room id
- **AND** session runtime does not synthesize durable `room-*` ids locally

### Requirement: Runtime boot SHALL not auto-ensure an implicit default room
Session runtimes SHALL attach rooms only through explicit durable room bindings or recovery of previously attached room facts. Runtime boot MUST NOT manufacture a default room attachment merely because the session started.

#### Scenario: Fresh runtime boot does not create a hidden room attachment
- **WHEN** a fresh runtime starts without any previously attached room fact
- **THEN** app-server does not auto-ensure or auto-focus a default room for that runtime
- **AND** room attachment appears only after explicit room orchestration

#### Scenario: Recovery boot reuses explicit room bindings only
- **WHEN** a runtime restarts after one or more rooms were explicitly granted and attached earlier
- **THEN** recovery restores only those room bindings whose durable grant/token facts remain valid
- **AND** it does not synthesize a fallback default room if no valid binding remains
