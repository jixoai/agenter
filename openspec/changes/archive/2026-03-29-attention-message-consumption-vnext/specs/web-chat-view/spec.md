## MODIFIED Requirements

### Requirement: Web chat view SHALL connect to one chat channel over websocket

The web chat view SHALL build its runtime state from a chat transport websocket plus reverse-time history paging.

#### Scenario: Pending queue stays above the composer until attention reads it

- **WHEN** a channel contains queued unread user messages
- **THEN** the view renders them in a pending strip above the composer
- **AND** those queued messages do not appear in the main transcript until `visibleAt` is set

#### Scenario: Transcript ordering follows visibility, not raw creation time

- **WHEN** a delayed queued message becomes visible after a later assistant reply already exists
- **THEN** the transcript orders the visible rows by `visibleAt` and stable tie-breakers
- **AND** the pending strip only contains messages that still lack visibility

#### Scenario: Unread queued messages stay editable

- **WHEN** a queued unread message is still in pending state
- **THEN** the user can edit and resend that message in place
- **AND** the updated content is reflected through the same `messageId`
