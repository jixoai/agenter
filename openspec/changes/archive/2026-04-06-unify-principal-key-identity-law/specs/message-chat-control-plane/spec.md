## MODIFIED Requirements

### Requirement: Global room ids SHALL be principal ids

New global rooms SHALL be allocated from managed room principals.

#### Scenario: New room id is a room principal
- **WHEN** the client creates a new global room without an explicit `chatId`
- **THEN** the returned room id is a lowercase `0x...` principal id
- **AND** that room id is backed by persisted managed principal material

### Requirement: Principal ids SHALL be accepted as room actors

Room actor validation SHALL accept raw principal ids for new runtimes and authenticated users.

#### Scenario: Avatar runtime joins a room as a principal
- **WHEN** a session runtime binds to an avatar principal id
- **THEN** room focus, grants, and message visibility can use that principal id directly
- **AND** the control plane does not require `session:<id>` for new runtimes
