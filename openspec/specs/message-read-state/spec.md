# message-read-state Specification

## Purpose

Define message-level room read membership and read-progress projection for group chat collaboration surfaces.

## Requirements

### Requirement: Room creation SHALL materialize the creator as a durable tracked seat

Room creation flows SHALL persist the creator as a durable room user seat before any room message, read projection, or `View as` projection is derived. Privileged bootstrap flows MAY add authority, but they SHALL NOT replace the creator with a synthetic viewer-only identity because frozen read arrays derive from durable seats.

#### Scenario: Privileged room creation still freezes the creator into message membership
- **WHEN** a privileged actor creates a room whose creator is user `A`
- **THEN** the room persists `A` as a durable admin seat before the room accepts messages
- **THEN** the first durable message tracks `A` inside `readActorIds` or `unreadActorIds` according to send-time state
- **THEN** the UI does not invent a second synthetic `View as` identity for that same creator

### Requirement: Room messages SHALL freeze read membership at send time

Message-system SHALL persist `readActorIds` and `unreadActorIds` on each durable room message. Those arrays SHALL capture the relevant collaborators at send time and SHALL NOT be rewritten when new users join later.

#### Scenario: New room user does not rewrite old messages
- **WHEN** a room message is sent while the room has users `A` and `B`
- **AND** user `C` joins later
- **THEN** the older message keeps only `A` and `B` in its read/unread arrays
- **THEN** `C` only participates in the arrays for messages sent after `C` joined

### Requirement: Mark-read SHALL move actor ids between frozen message arrays

Message-system SHALL advance room read-state by moving actor ids from `unreadActorIds` to `readActorIds` on the addressed visible message and earlier visible messages, instead of recomputing history from mutable seat cursors.

#### Scenario: Read progress advances without changing frozen membership
- **WHEN** a room user reads up to message `m3`
- **THEN** that user's actor id moves from unread to read on `m3` and earlier visible messages
- **THEN** later room membership changes do not alter the already-frozen arrays on those messages

### Requirement: Client mark-read acknowledgement SHALL stay monotonic per room actor

Room clients SHALL treat latest-visible mark-read acknowledgement as monotonic progress for each `room + actor identity`. Transient viewport churn, observer resets, or temporary `null` visibility events SHALL NOT clear previously acknowledged progress or trigger duplicate `globalMarkRead` writes for the same or older durable message row, and credential-source churn for the same actor SHALL NOT create a second acknowledgement track.

#### Scenario: Visibility churn does not resend the same mark-read mutation
- **WHEN** the transcript briefly reports no visible message and then reports the previously acknowledged message again
- **THEN** the client keeps the previously acknowledged row floor
- **THEN** it does not resend `globalMarkRead` for that same or older message

#### Scenario: Credential refresh does not duplicate actor acknowledgement
- **WHEN** the Room route rehydrates and resolves a different credential source for the same viewer actor
- **AND** the current visible message already includes that actor inside `readActorIds`
- **THEN** the client keeps one actor-scoped acknowledgement floor
- **THEN** it does not emit another `globalMarkRead` for that same actor and message

### Requirement: Room projections SHALL expose latest-visible read progress from frozen arrays

Room-facing projections SHALL derive aggregate progress from the latest visible message's frozen read arrays and SHALL expose a detailed actor breakdown that distinguishes `unread` from `joined later`.

#### Scenario: Read ring shows partial progress
- **WHEN** some tracked actors have read the latest visible message and others have not
- **THEN** the projection exposes aggregate counts or progress that can render as a compact read ring
- **THEN** the detailed view still exposes the actor breakdown behind that compact summary

#### Scenario: Joined-later actor is not counted retroactively
- **WHEN** the latest visible message was sent before a newly granted user joined the room
- **THEN** the aggregate progress excludes that user from the tracked total for that message
- **THEN** the detailed view marks that user as `joined later` instead of `unread`
