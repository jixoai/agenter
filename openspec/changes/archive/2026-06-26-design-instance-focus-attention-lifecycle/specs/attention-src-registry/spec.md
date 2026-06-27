## MODIFIED Requirements

### Requirement: Protocol-native `src` addresses SHALL be owned by their namespace

Every shared attention source identity SHALL be represented as a protocol-native `src` string. The owning namespace SHALL provide the only authoritative `parse(src)` and `format(ref)` operations for that source family. Room lifecycle and room transcript addresses SHALL be owned by the `room` namespace. Message delivery/contact addresses SHALL be owned by the `msg` namespace and SHALL NOT be used as room transcript row identity.

#### Scenario: Room namespace formats and parses room plus room-entry sources

- **WHEN** room-management registers namespace `room`
- **THEN** it formats room-scope sources as `room:<roomId>`
- **AND** it formats room-entry sources as `room:<roomId>#<entryId>`
- **AND** callers resolve `entryId` only after resolving the owning room context
- **AND** shared consumers resolve those addresses only by delegating to the `room` namespace registration

#### Scenario: Message namespace formats and parses contact locator sources

- **WHEN** message-system registers namespace `msg`
- **THEN** it formats contact locator sources as `msg:<superadminAddress>/<contact>`
- **AND** the first segment represents the canonical superadmin address even if older discussion used `domain` or `source` as naming variants
- **AND** `msg` sources identify delivery/contact capability rather than room lifecycle or room transcript entries

#### Scenario: Terminal namespace formats and parses a terminal source

- **WHEN** terminal-system registers namespace `tty`
- **THEN** it formats terminal sources according to terminal-owned address rules such as `tty:<terminalId>/<eventId>`
- **THEN** shared runtime code does not need a terminal-specific parsing branch

### Requirement: Namespace registrations SHALL provide projection semantics without shared source switches

Namespace registrations SHALL be able to provide stable keys plus optional bucket and comparison semantics so notification, visibility, and source-navigation layers can consume protocol-native sources without hard-coded `message`, `room`, or `terminal` branches in the shared kernel.

#### Scenario: Notification projection groups room entries by room namespace bucket

- **WHEN** the notification projection receives unread sources `room:13#154` and `room:13#155`
- **THEN** it groups them through the room namespace bucket rule for room `13`
- **THEN** the shared notification layer does not infer that grouping from a hard-coded chat field

#### Scenario: Source cursor comparison comes from the owning namespace

- **WHEN** a caller asks to consume notifications through `room:13#155`
- **THEN** the notification layer delegates ordering to the `room` namespace comparison rule
- **THEN** shared runtime code does not parse the trailing `155` with a generic message-specific helper
