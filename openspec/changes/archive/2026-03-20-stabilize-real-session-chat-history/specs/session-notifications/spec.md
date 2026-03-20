## MODIFIED Requirements

### Requirement: Session notifications SHALL be consumed by visible chat
The app-server SHALL clear unread notifications for a session when the client reports that the session's Chat view is visible and has consumed messages up to a specific message id, including when that Chat history is paged or virtualized.

#### Scenario: Consume unread notifications for a session
- **WHEN** the client consumes notifications for a session up to a visible assistant message id
- **THEN** the session's unread count is reduced to exclude consumed entries and those entries no longer appear in the notification list

#### Scenario: Paged history consumes only replies that actually became visible
- **WHEN** the Chat route prepends older pages or remeasures a virtualized history
- **THEN** unread notifications are consumed only up to the last assistant reply that was actually visible in the viewport
- **THEN** later unread assistant replies remain pending until the viewport truly reaches them

## ADDED Requirements

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
