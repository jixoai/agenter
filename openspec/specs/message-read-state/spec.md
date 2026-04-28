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

Message-system SHALL advance room read-state by moving actor ids from `unreadActorIds` to `readActorIds` on the addressed visible message and earlier visible messages, instead of recomputing history from mutable seat cursors. The same durable mark-read mutation SHALL also update actor-global unread totals and actor-room unread counters from the affected message range.

#### Scenario: Read progress advances without changing frozen membership
- **WHEN** a room user reads up to message `m3`
- **THEN** that user's actor id moves from unread to read on `m3` and earlier visible messages
- **THEN** later room membership changes do not alter the already-frozen arrays on those messages

#### Scenario: Mark-read shrinks actor unread aggregates from the same mutation
- **WHEN** actor `A` marks room `R` read through visible message `m3`
- **THEN** `A`'s room unread counter for `R` is reduced to exclude `m3` and earlier visible unread messages
- **THEN** `A`'s global unread total is reduced by the same number
- **THEN** the unread aggregate update does not require rescanning unrelated rooms

### Requirement: Joined-later actors SHALL remain excluded from retroactive unread obligations while still being allowed to appear as readers

Message-system SHALL keep joined-later actors excluded from retroactive unread obligations on older messages, but an explicit later mark-read MAY append those actors to `readActorIds` on previously visible history without rewriting frozen `unreadActorIds`.

#### Scenario: Joined-later actor does not inherit old unread debt
- **WHEN** actor `C` joins after message `m1` was sent
- **THEN** `m1` does not contribute to `C`'s unread room counter
- **THEN** `m1` remains outside `C`'s retroactive unread obligation set

#### Scenario: Joined-later actor can later become a historical reader
- **WHEN** actor `C` later opens old history containing `m1` and marks that history read
- **THEN** `C` MAY be appended to `m1.readActorIds`
- **THEN** `m1.unreadActorIds` remains frozen to the original send-time membership

### Requirement: Client mark-read acknowledgement SHALL stay monotonic per room actor

Room clients SHALL treat mark-read acknowledgement as monotonic progress derived from the durable message rows currently in the room snapshot. Transient viewport churn, observer resets, or temporary `null` visibility events SHALL NOT clear previously acknowledged progress or trigger duplicate `globalMarkRead` writes for the same or older durable message row, and room-level projection fields SHALL NOT be required to recover that floor.

#### Scenario: Visibility churn does not resend the same mark-read mutation
- **WHEN** the transcript briefly reports no visible message and then reports the previously acknowledged message again
- **THEN** the client keeps the previously acknowledged row floor
- **THEN** it does not resend `globalMarkRead` for that same or older message

#### Scenario: Credential refresh does not duplicate actor acknowledgement
- **WHEN** the Room route rehydrates and resolves a different credential source for the same viewer actor
- **AND** the current visible message already includes that actor inside `readActorIds`
- **THEN** the client keeps one actor-scoped acknowledgement floor
- **THEN** it does not emit another `globalMarkRead` for that same actor and message

#### Scenario: Warm snapshot suppresses duplicate acknowledgement without room progress

- **WHEN** the room snapshot already contains message `m3`
- **AND** `m3.readActorIds` already includes the current viewer actor
- **AND** the room route replays or re-observes `m3` as the latest visible message
- **THEN** the client does not emit another `globalMarkRead` for `m3`
- **AND** it does not need a room-level latest-visible progress field to make that decision

#### Scenario: Viewer switch replays the latest durable message once

- **WHEN** the selected viewer changes while the current room snapshot already contains the newest durable message
- **THEN** the client may replay that newest durable message once for the new viewer
- **AND** any duplicate acknowledgement is still suppressed by the message-level read arrays in the snapshot

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

### Requirement: Message read truth SHALL remain independent from AI delivery truth

Message-system read-state SHALL continue to express room-view progress only. Runtime kernels, inspection surfaces, and clients MUST NOT interpret message read membership or room-level read progress as proof that AI delivery succeeded.

#### Scenario: Runtime read acknowledgement does not imply AI acceptance
- **WHEN** the acting runtime or viewer marks a room message read before the related delivery attempt has recorded an `accepted` receipt
- **THEN** message read-state advances according to message-system law
- **AND** the related delivery projection remains `pending` or `dispatching` until receipt truth exists

#### Scenario: Inspection surfaces keep read and delivery as separate facts
- **WHEN** Heartbeat or Devtools renders work for a room-backed attention item
- **THEN** message read-state remains visible only as message truth
- **AND** delivery state is rendered from dispatch and receipt facts instead of from read arrays or room progress summaries

### Requirement: Room projections SHALL expose seat metadata without synthesizing room read progress

Room or channel projections MAY expose room seat metadata needed for current membership, presence, authority, and credential surfaces, but they SHALL NOT publish a room-level `latest visible` read-progress summary or per-seat latest-visible read flags. Message-level `readActorIds` / `unreadActorIds` remain the only public read truth.

#### Scenario: Room snapshot omits synthetic latest-visible progress

- **WHEN** a client reads a room snapshot or room catalog entry
- **THEN** the channel projection may include current seat metadata such as role, focus, online state, and credential validity
- **AND** it does not include a room-level latest-visible read progress object
- **AND** it does not include per-seat booleans that mean “has read the latest visible message”

#### Scenario: Joined-later seat stays a seat fact, not a room progress label

- **WHEN** a user joined the room after older messages were sent
- **THEN** that user can still appear in the current room seat metadata
- **AND** the projection does not invent a room-level `joined later` read badge for that seat
- **AND** whether the user read an older message is determined only from that message's durable arrays
