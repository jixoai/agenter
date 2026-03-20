## ADDED Requirements

### Requirement: Session notifications SHALL project unread assistant replies
The app-server SHALL maintain an ephemeral unread-notification projection for assistant replies that are intended for the user and arrive while that session's Chat view is not visibly consumed.

#### Scenario: Hidden chat reply creates unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is not visible and focused
- **THEN** the notification projection records an unread entry for that session and increments its unread count

#### Scenario: Visible chat reply does not create unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is visible and the app window is focused
- **THEN** the notification projection does not create or increment an unread notification for that message

### Requirement: Session notifications SHALL be consumed by visible chat
The app-server SHALL clear unread notifications for a session when the client reports that the session's Chat view is visible and has consumed messages up to a specific message id.

#### Scenario: Consume unread notifications for a session
- **WHEN** the client consumes notifications for a session up to a visible assistant message id
- **THEN** the session's unread count is reduced to exclude consumed entries and those entries no longer appear in the notification list

### Requirement: Session notifications SHALL be ephemeral runtime state
The system SHALL treat session notifications as application runtime state instead of durable session history.

#### Scenario: Notification projection starts empty on restart
- **WHEN** the app-server process starts without any newly observed unread messages
- **THEN** the notification snapshot is empty until new unread assistant replies are observed
