## MODIFIED Requirements

### Requirement: Session notifications SHALL surface through running-session navigation entry points
Unread session notifications SHALL be visible on the application's running-session navigation surfaces so users can discover background replies without opening the Workspaces view first.

#### Scenario: Desktop sidebar running-session entry shows unread state
- **WHEN** a running session has unread assistant replies
- **THEN** its running-session entry in the desktop application sidebar shows an unread badge or count derived from the notification projection

#### Scenario: Mobile navigation drawer running-session entry shows unread state
- **WHEN** the mobile navigation drawer is opened and one or more sessions have unread assistant replies
- **THEN** the corresponding running-session entries show the unread state for those sessions
