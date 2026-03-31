# web-chat-view Specification

## Purpose
Define the room-backed Web chat transport contract, including websocket hydration, pending-message presentation, and reverse-time paging.
## Requirements
### Requirement: Web chat view SHALL connect to one chat channel over websocket
The web chat view SHALL build its runtime state from one room transport websocket plus reverse-time history paging.

#### Scenario: Connect and hydrate a room
- **WHEN** the component receives an authorized room transport URL
- **THEN** it renders the initial room snapshot
- **THEN** it can load older room history without replacing newer messages

#### Scenario: Pending queue stays above the composer until attention reads it
- **WHEN** a room contains queued unread user messages
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

### Requirement: Web chat view SHALL support large chat histories
The web chat view SHALL use virtualized rendering and reverse-time pagination for long-lived room conversations.

#### Scenario: Years of room history remain navigable
- **WHEN** the room has a long history
- **THEN** the viewport only renders the visible message window
- **THEN** older history is loaded by time-based reverse pagination
