## MODIFIED Requirements

### Requirement: Terminal-system SHALL present global terminals as a standalone app surface
The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, renders the selected terminal transcript, and provides terminal-specific actions and user/access management without requiring workspace ownership.

#### Scenario: Global terminal navigation
- **WHEN** the operator opens the terminal-system route
- **THEN** they can browse and select global terminals directly

#### Scenario: Terminal detail layout
- **WHEN** a terminal is selected
- **THEN** the route shows the terminal transcript plus a side panel with separate Actions and Users tabs
- **THEN** the bottom tool panel lets the operator invoke terminal actions as an explicit seat

### Requirement: Terminal detail SHALL restore durable activity after refresh
Refreshing the terminal route SHALL restore transcript/activity evidence and terminal metadata from durable backend state, and the route SHALL continue receiving live updates after hydration.

#### Scenario: Refresh terminal detail
- **WHEN** the browser refreshes while viewing a terminal
- **THEN** the transcript/activity pane reloads previously available terminal activity rather than appearing empty
- **THEN** subsequent live terminal events continue updating the selected terminal in place

#### Scenario: Absolute cwd display
- **WHEN** terminal metadata includes the current working directory
- **THEN** the UI displays the absolute path rather than a workspace-relative shorthand such as `.`

### Requirement: Terminal-system route SHALL reflect seat and approval changes live
The terminal-system route SHALL react to terminal activity, grant changes, approval changes, and seat focus changes without requiring page refresh or timer-based polling to reveal those facts.

#### Scenario: Activity and seat state update in place
- **WHEN** a write, read, or seat focus action occurs for the selected terminal
- **THEN** the Actions and Users panes update in place from the live terminal event stream
- **THEN** `call as` options remain consistent with the latest visible grants

#### Scenario: Approval queue updates in place
- **WHEN** a terminal approval request is created, approved, or denied
- **THEN** the Users pane reflects that approval state without manual refresh
- **THEN** the current administrator can act on the latest approval queue immediately
