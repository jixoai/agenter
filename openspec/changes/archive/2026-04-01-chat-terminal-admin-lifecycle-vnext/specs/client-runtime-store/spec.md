## MODIFIED Requirements

### Requirement: Runtime store SHALL expose chat and terminal lifecycle methods
Client runtime store MUST provide first-class methods for the new backend lifecycle contracts.

#### Scenario: Store archives chat channel and updates cache
- **WHEN** caller archives a channel through store API
- **THEN** store updates cached channel list without full reconnect
- **AND** archived channel is removed from default active cache

#### Scenario: Store proxies terminal lifecycle operations
- **WHEN** caller requests terminal list/create/focus/delete
- **THEN** store calls matching TRPC procedures and returns normalized payloads
