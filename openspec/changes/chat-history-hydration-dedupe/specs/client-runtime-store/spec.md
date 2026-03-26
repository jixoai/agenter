## MODIFIED Requirements

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource
The client runtime store SHALL maintain explicit reverse-time page state for each long-history session resource and SHALL hydrate only recent windows by default.

#### Scenario: Hydration keeps a recent window
- **WHEN** the client hydrates a session with existing chat, cycles, LoopBus, or model history
- **THEN** it loads only the newest configured window for each resource
- **THEN** older history remains available through the resource paging state

#### Scenario: Loading older pages preserves order and identity
- **WHEN** the client prepends an older history page for a session resource
- **THEN** the merged list remains ordered from oldest to newest
- **THEN** already-known items are not duplicated

#### Scenario: Persisted history replaces equivalent runtime chat rows
- **WHEN** `runtime.snapshot` already contains in-memory chat rows and `chat.list` later hydrates the same messages with persisted ids
- **THEN** the client runtime store collapses those semantic duplicates into one row per message
- **THEN** the persisted record wins over the in-memory runtime copy
