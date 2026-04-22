## MODIFIED Requirements

### Requirement: Client mark-read acknowledgement SHALL stay monotonic per room actor

Room clients SHALL treat mark-read acknowledgement as monotonic progress derived from the durable message rows currently in the room snapshot. Transient viewport churn, observer resets, or temporary `null` visibility events SHALL NOT clear previously acknowledged progress or trigger duplicate `globalMarkRead` writes for the same or older durable message row, and room-level projection fields SHALL NOT be required to recover that floor.

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
