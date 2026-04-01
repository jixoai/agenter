## MODIFIED Requirements

### Requirement: ChatApp metadata disclosure SHALL honor channel access role

The ChatApp metadata disclosure surface SHALL expose read-only channel facts for all valid roles and SHALL only expose metadata mutation or participant administration controls when the current channel access role is `admin`.

#### Scenario: Metadata disclosure does not own room focus
- **WHEN** the user opens room metadata from the Chats tab row
- **THEN** the disclosure shows room facts, metadata, participants, and grant administration
- **AND** it does not expose a room-global `Focus/Unfocus` action

### Requirement: ChatApp channel metadata SHALL use passive signal disclosure

The ChatApp surface SHALL expose channel metadata through a passive signal disclosure aligned with the channel tabs instead of dedicating a full metadata row above the transcript.

#### Scenario: Tabs remain inspection-only while Users panel owns seat focus
- **WHEN** the user inspects a room from the Chats page
- **THEN** the tab row is used to select which room is being viewed
- **AND** any focus or unfocus mutation is triggered from the Users panel for a specific seat token rather than from the tab chrome
