## MODIFIED Requirements

### Requirement: Channel metadata admin flows SHALL support create, focus, and archive lifecycle
Chat channel admin tooling MUST support explicit create metadata capture, focus actions, and archive (hide-only) operations through tokenized APIs.

#### Scenario: Pre-create metadata is captured before channel creation
- **WHEN** an admin creates a chat channel from WebUI
- **THEN** metadata/title/participants/admin-token inputs are collected before backend create call
- **THEN** backend creates channel with those fields and returns admin projection

#### Scenario: Built-in chat-main archive is blocked
- **WHEN** archive is requested for the default built-in channel
- **THEN** backend rejects the archive request
- **AND** channel remains visible in active list

#### Scenario: Non built-in channel archive hides from default list
- **WHEN** archive succeeds for a non built-in channel
- **THEN** channel is excluded from default list calls
- **AND** channel remains queryable only when includeArchived is requested
