## MODIFIED Requirements

### Requirement: Default avatar remains discoverable through nickname while storage stays principal-keyed
The system SHALL define `default` as the default avatar nickname in the global avatar catalog, but its durable storage root SHALL be principal-keyed. Global avatar discovery SHALL happen through a nickname alias layer instead of using the nickname as the canonical folder name.

#### Scenario: Default avatar resolves through a nickname alias
- **WHEN** the avatar catalog resolves the default avatar
- **THEN** the nickname `default` remains visible in the catalog
- **AND** the canonical directory resolves under `~/.agenter/avatars/by-principal/<principalId>`
- **AND** the nickname alias resolves under `~/.agenter/avatars/by-nickname/default`

### Requirement: Avatar seat credentials SHALL live under principal-keyed canonical roots
Room and terminal credentials for an Avatar SHALL be persisted in that Avatar's canonical principal directory rather than in nickname-keyed folders. Nickname paths only act as symlink aliases that resolve to those canonical roots.

#### Scenario: Workspace seat persistence provisions canonical root and nickname alias
- **WHEN** a workspace avatar seat is first initialized for nickname `helper`
- **THEN** the system creates or uses `<workspace>/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** it provisions `<workspace>/.agenter/avatars/by-nickname/helper` as an alias to that canonical root

#### Scenario: Global seat persistence uses the same principal-keyed law
- **WHEN** the global avatar seat for nickname `default` stores a credential
- **THEN** the system writes it under `~/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** `~/.agenter/avatars/by-nickname/default` resolves to that same canonical root
