## MODIFIED Requirements

### Requirement: Terminal detail SHALL restore durable activity after refresh
Refreshing the terminal route SHALL restore previously renderable terminal evidence from durable backend state, including the latest terminal snapshot, transport endpoint, renderer metadata, absolute cwd, and recent terminal activity. After hydration, the route SHALL continue receiving live updates without requiring a second manual refresh.

#### Scenario: Refresh terminal detail
- **WHEN** the browser refreshes while viewing a terminal
- **THEN** the transcript/activity pane reloads previously available terminal activity rather than appearing empty
- **THEN** subsequent live terminal events continue updating the selected terminal in place

#### Scenario: Refresh restores renderable terminal viewport
- **WHEN** the selected terminal was previously running and had renderable output
- **THEN** the route restores a renderable terminal viewport from durable snapshot truth before or while live transport reconnects
- **THEN** the page does not regress to a permanently blank terminal surface

#### Scenario: Absolute cwd display
- **WHEN** terminal metadata includes the current working directory
- **THEN** the UI displays the absolute path rather than a workspace-relative shorthand such as `.`

## ADDED Requirements

### Requirement: Terminal-system route SHALL keep mutation results live without manual refresh

The terminal route SHALL reflect post-mutation terminal state from the shared live state model so actor access changes, call-as options, and activity updates remain immediately usable after the operator mutates the selected terminal.

#### Scenario: Call-as options update after seat change

- **WHEN** the operator grants or revokes a seat for the selected terminal
- **THEN** the `call as` selector updates from the same live terminal state without requiring a page refresh
- **THEN** subsequent tool invocations can use the new seat immediately
