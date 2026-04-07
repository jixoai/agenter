## MODIFIED Requirements

### Requirement: Mark-read SHALL move actor ids between frozen message arrays

Message-system SHALL advance room read-state by moving actor ids from `unreadActorIds` to `readActorIds` on the addressed visible message and earlier visible messages, instead of recomputing history from mutable seat cursors.

#### Scenario: Read progress advances without changing frozen membership
- **WHEN** a room user reads up to message `m3`
- **THEN** that user's actor id moves from unread to read on `m3` and earlier visible messages
- **THEN** later room membership changes do not alter the already-frozen arrays on those messages

#### Scenario: Viewport churn does not resend the same read acknowledgement
- **WHEN** the client has already acknowledged message `m3` for a given room seat
- **AND** virtualization or observer churn briefly reports no visible message before `m3` becomes visible again
- **THEN** the client does not emit another mark-read mutation for `m3`
- **THEN** later acknowledgements still advance normally when a newer visible message is reached

### Requirement: Room projections SHALL expose latest-visible read progress from frozen arrays

Room-facing projections SHALL derive aggregate progress from the latest visible message's frozen read arrays and SHALL expose a detailed actor breakdown that distinguishes `read` from `unread` and `joined later`.

#### Scenario: Read ring shows partial progress
- **WHEN** some tracked actors have read the latest visible message and others have not
- **THEN** the projection exposes aggregate counts or progress that can render as a compact read ring
- **THEN** the detailed view still exposes the actor breakdown behind that compact summary

#### Scenario: Joined-later actor is not counted retroactively
- **WHEN** the latest visible message was sent before a newly granted user joined the room
- **THEN** the aggregate progress excludes that user from the tracked total for that message
- **THEN** the detailed view marks that user as `joined later` instead of `unread`
