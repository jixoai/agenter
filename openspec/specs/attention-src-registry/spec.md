# attention-src-registry Specification

## Purpose
TBD - created by archiving change adopt-attention-src-registry. Update Purpose after archive.
## Requirements
### Requirement: Attention source namespaces SHALL register uniquely
The attention system SHALL expose a namespace registry for source addresses. Each namespace registration SHALL be unique within one runtime, and duplicate namespace registration MUST fail fast instead of silently overriding an existing source family.

#### Scenario: Duplicate namespace registration is rejected
- **WHEN** one system has already registered namespace `msg`
- **AND** another system attempts to register `msg` again
- **THEN** the registry rejects the second registration
- **THEN** runtime setup fails explicitly instead of keeping an ambiguous source parser

### Requirement: Protocol-native `src` addresses SHALL be owned by their namespace
Every shared attention source identity SHALL be represented as a protocol-native `src` string. The owning namespace SHALL provide the only authoritative `parse(src)` and `format(ref)` operations for that source family.

#### Scenario: Message namespace formats and parses room-scope plus row-scope message sources
- **WHEN** message-system registers namespace `msg`
- **THEN** it formats room-scope message sources as `msg:<chatId>`
- **THEN** it formats room-message row sources as `msg:<chatId>/<messageId>`
- **THEN** any shared consumer resolves that address only by delegating to the `msg` namespace registration

#### Scenario: Terminal namespace formats and parses a terminal source
- **WHEN** terminal-system registers namespace `tty`
- **THEN** it formats terminal sources according to terminal-owned address rules such as `tty:<terminalId>/<eventId>`
- **THEN** shared runtime code does not need a terminal-specific parsing branch

### Requirement: Namespace registrations SHALL provide projection semantics without shared source switches
Namespace registrations SHALL be able to provide stable keys plus optional bucket and comparison semantics so notification, visibility, and source-navigation layers can consume protocol-native sources without hard-coded `message` or `terminal` branches in the shared kernel.

#### Scenario: Notification projection groups room sources by namespace bucket
- **WHEN** the notification projection receives unread sources `msg:13/154` and `msg:13/155`
- **THEN** it groups them through the message namespace bucket rule for room `13`
- **THEN** the shared notification layer does not infer that grouping from a hard-coded chat field

#### Scenario: Source cursor comparison comes from the owning namespace
- **WHEN** a caller asks to consume notifications through `msg:13/155`
- **THEN** the notification layer delegates ordering to the `msg` namespace comparison rule
- **THEN** shared runtime code does not parse the trailing `155` with a generic message-specific helper

