## MODIFIED Requirements

### Requirement: Message-system route SHALL derive room users and viewer choices from canonical actor truth

The room viewer selector, room management surface, send-as options, and read-progress details SHALL resolve actors from canonical auth/profile or session actor identity instead of local label-only guesses.

#### Scenario: Viewer selector lists canonical actors
- **WHEN** the operator opens the room viewer selector
- **THEN** each option is keyed by canonical actor identity
- **THEN** duplicate visible labels remain selectable as separate actors

#### Scenario: Message read disclosure uses canonical actor projection
- **WHEN** the operator opens a room message's read-progress disclosure
- **THEN** each `read` / `unread` entry resolves the actor label and avatar from canonical auth/profile or session truth
- **THEN** the disclosure does not fall back to raw actor ids unless no canonical projection exists

### Requirement: Room read state SHALL use message-level group read progress semantics

The room transcript SHALL present participant read progress and read timestamps as message-level collaboration facts, and SHALL NOT project latest-read progress as a room-header aggregate chip or as an attention-style pending label.

#### Scenario: Participant read progress
- **WHEN** room messages contain read-state projections
- **THEN** the UI shows a per-message inline-end progress indicator for that message
- **THEN** a fully read message upgrades that indicator into a completed check state instead of a room-level `x/y read` badge

#### Scenario: Read detail remains attached to the message row
- **WHEN** the operator needs to inspect which users read a specific room message
- **THEN** the detail disclosure opens from that message's inline-end read indicator
- **THEN** the room route does not reintroduce a separate toolbar or header-level aggregate read panel
