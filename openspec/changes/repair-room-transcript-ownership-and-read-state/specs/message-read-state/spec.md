## ADDED Requirements

### Requirement: Room messages SHALL freeze read membership at send time

Each durable room message SHALL persist two actor arrays, `readActorIds` and `unreadActorIds`, representing the room collaborators that were relevant when that message was created.

#### Scenario: New room user does not rewrite old messages
- **WHEN** a room message is sent while the room has users `A` and `B`
- **AND** user `C` joins later
- **THEN** the older message keeps only `A` and `B` in its read/unread arrays
- **THEN** `C` only participates in the arrays for messages sent after `C` joined

### Requirement: Mark-read SHALL move actor ids between message arrays

Room read updates SHALL move actor ids from `unreadActorIds` to `readActorIds` on the addressed visible message and earlier visible messages, rather than recomputing history from mutable seat state.

#### Scenario: Read progress advances without changing frozen membership
- **WHEN** a room user reads up to message `m3`
- **THEN** that user's actor id moves from unread to read on `m3` and earlier visible messages
- **THEN** later room membership changes do not alter the already-frozen arrays on those messages
