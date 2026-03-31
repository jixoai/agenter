## ADDED Requirements

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
