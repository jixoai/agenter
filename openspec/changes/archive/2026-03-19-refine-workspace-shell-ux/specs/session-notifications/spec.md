## ADDED Requirements

### Requirement: Session notifications SHALL surface through running-session navigation entry points
Unread session notifications SHALL be visible on the application's running-session navigation surfaces so users can discover background replies without opening the Workspaces view first.

#### Scenario: Desktop running-session rail shows unread state
- **WHEN** a running session has unread assistant replies
- **THEN** its secondary rail entry shows an unread badge or count derived from the notification projection

#### Scenario: Compact running-session switcher shows unread state
- **WHEN** a compact running-session switcher is opened and one or more sessions have unread assistant replies
- **THEN** the corresponding switcher entries show the unread state for those sessions
