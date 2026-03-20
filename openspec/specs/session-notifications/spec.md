## Purpose

Define the unread session notification projection and its WebUI entry points.
## Requirements
### Requirement: Session notifications SHALL project unread assistant replies
The app-server SHALL maintain an ephemeral unread-notification projection for assistant replies that are intended for the user and arrive while that session's Chat view is not visibly consumed.

#### Scenario: Hidden chat reply creates unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is not visible and focused
- **THEN** the notification projection records an unread entry for that session and increments its unread count

#### Scenario: Visible chat reply does not create unread notification
- **WHEN** a running session emits an assistant message with `channel = to_user` while its Chat view is visible and the app window is focused
- **THEN** the notification projection does not create or increment an unread notification for that message

### Requirement: Session notifications SHALL be consumed by visible chat
The app-server SHALL clear unread notifications for a session when the client reports that the session's Chat view is visible and has consumed messages up to a specific message id, including when that Chat history is paged or virtualized.

#### Scenario: Consume unread notifications for a session
- **WHEN** the client consumes notifications for a session up to a visible assistant message id
- **THEN** the session's unread count is reduced to exclude consumed entries and those entries no longer appear in the notification list

#### Scenario: Paged history consumes only replies that actually became visible
- **WHEN** the Chat route prepends older pages or remeasures a virtualized history
- **THEN** unread notifications are consumed only up to the last assistant reply that was actually visible in the viewport
- **THEN** later unread assistant replies remain pending until the viewport truly reaches them

### Requirement: Session notifications SHALL be ephemeral runtime state
The system SHALL treat session notifications as application runtime state instead of durable session history.

#### Scenario: Notification projection starts empty on restart
- **WHEN** the app-server process starts without any newly observed unread messages
- **THEN** the notification snapshot is empty until new unread assistant replies are observed

### Requirement: Session notifications SHALL surface through running-session navigation entry points
Unread session notifications SHALL be visible on the application's running-session navigation surfaces so users can discover background replies without opening the Workspaces view first.

#### Scenario: Desktop sidebar running-session entry shows unread state
- **WHEN** a running session has unread assistant replies
- **THEN** its running-session entry in the desktop application sidebar shows an unread badge or count derived from the notification projection

#### Scenario: Mobile navigation drawer running-session entry shows unread state
- **WHEN** the mobile navigation drawer is opened and one or more sessions have unread assistant replies
- **THEN** the corresponding running-session entries show the unread state for those sessions

### Requirement: Session notifications SHALL remain stable across real-session history hydration
Unread projection behavior SHALL remain correct when the client hydrates a persisted session history after the route opens or after a session is resumed from Quick Start or the running-session rail.

#### Scenario: Hydrating persisted history does not falsely consume unread replies
- **WHEN** a session route hydrates persisted chat history before the assistant reply boundary has been rendered into view
- **THEN** unread notifications are not consumed early merely because the route became active
- **THEN** consumption waits for the visible-chat boundary reported by the viewport

#### Scenario: Resumed session can immediately consume the visible unread reply boundary
- **WHEN** the user resumes a running session and the Chat viewport renders unread assistant replies into view
- **THEN** the notification projection consumes only the replies up to that visible boundary
- **THEN** the running-session unread badge reflects the remaining unread replies, if any

