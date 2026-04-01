## ADDED Requirements

### Requirement: Message control plane SHALL persist typed channel messages
The message control plane MUST persist channel messages as typed records so websocket snapshots/pages preserve message intent without Chat-side inference.

#### Scenario: Text, error, and interactive rows survive paging
- **WHEN** a channel stores mixed `text`, `error`, and `interactive` messages
- **THEN** snapshot and reverse-time page APIs return each row with its original kind and payload
- **THEN** clients do not need markdown/tool parsing to infer row semantics

### Requirement: Message control plane SHALL expose dedicated send intents
The control plane MUST expose explicit send intents for normal text, admin error notices, and interactive cards.

#### Scenario: Interactive send appends an interactive row
- **WHEN** a caller sends an interactive payload to a channel
- **THEN** the channel appends one `interactive` message row
- **THEN** connected websocket clients receive that row in incremental updates
