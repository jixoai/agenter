## MODIFIED Requirements

### Requirement: Session notifications SHALL project unread assistant replies
The app-server SHALL maintain an ephemeral unread-notification projection for assistant replies that are intended for the user and arrive while that session's Chat view is not visibly consumed.

#### Scenario: Hidden chat reply creates unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is not visible and focused
- **THEN** the notification projection records an unread entry for that session and increments its unread count

#### Scenario: Visible chat reply does not create unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is visible and the app window is focused
- **THEN** the notification projection does not create or increment an unread notification for that message

#### Scenario: Multiple hidden replies preserve the true unread count
- **WHEN** multiple distinct assistant messages with `channel = to_user` arrive while the session's Chat view is not visibly consumed
- **THEN** the unread projection retains one unread entry per message
- **THEN** the session unread count reflects the true number of unread messages rather than a collapsed per-session flag

### Requirement: Session notifications SHALL be consumed by visible chat
The app-server SHALL clear unread notifications for a session when the client reports that the session's Chat view is visible and has consumed messages up to a specific message id.

#### Scenario: Consume unread notifications for a session
- **WHEN** the client consumes notifications for a session up to a visible assistant message id
- **THEN** the session's unread count is reduced to exclude consumed entries and those entries no longer appear in the notification list

#### Scenario: Message-first chat consumes only what became visible
- **WHEN** the message-first Chat viewport reports the last visible assistant `to_user` message id for a session
- **THEN** the notification projection consumes unread entries only up to that message
- **THEN** later unread assistant replies remain pending until they become visible
