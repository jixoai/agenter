## MODIFIED Requirements

### Requirement: Session notifications SHALL project unread assistant replies

The app-server SHALL maintain an ephemeral unread-notification projection for assistant replies that are intended for the user and arrive while that session's Chat view is not visibly consumed. This projection remains distinct from durable room-local read-state.

#### Scenario: Session unread badge and room read-state coexist
- **WHEN** a room already exposes durable per-seat read-state and a hidden assistant reply also creates a session unread notification
- **THEN** the running-session unread badge is still derived from the ephemeral notification projection
- **THEN** the room-local read-state remains sourced from message-system instead of being overwritten by the session unread badge
