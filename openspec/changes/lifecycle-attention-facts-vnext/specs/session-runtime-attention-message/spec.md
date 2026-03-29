## MODIFIED Requirements

### Requirement: Session runtime SHALL route chat through attention and message adapters

Session runtime SHALL also publish room lifecycle changes into the same room-owned attention context, with structure-changing events kept active until explicitly settled.

#### Scenario: Room create enters active attention
- **WHEN** session runtime creates a new room or direct chat channel
- **THEN** it appends a `channel_create` lifecycle commit into that room context
- **AND** that lifecycle commit remains active attention debt by default

#### Scenario: Room update and archive stay recoverable
- **WHEN** session runtime updates or archives a room
- **THEN** it appends `channel_update` or `channel_archive` lifecycle commits into that room context
- **AND** those commits remain active attention debt by default

#### Scenario: Room focus change stays passive
- **WHEN** session runtime changes focused rooms
- **THEN** it appends a `channel_focus` lifecycle fact
- **AND** that fact does not create unresolved attention debt by default
