## ADDED Requirements

### Requirement: Terminal-system SHALL present global terminals as a standalone app surface
The WebUI SHALL expose a dedicated terminal-system route that lists global terminals, renders the selected terminal transcript, and provides terminal-specific actions and user/access management without requiring workspace ownership.

#### Scenario: Global terminal navigation
- **WHEN** the operator opens the terminal-system route
- **THEN** they can browse and select global terminals directly

#### Scenario: Terminal detail layout
- **WHEN** a terminal is selected
- **THEN** the route shows the terminal transcript plus a side panel with separate Actions and Users tabs

### Requirement: Terminal tool actions SHALL require an explicit acting actor
Terminal read/write or other tool-call actions initiated from the UI SHALL let the operator choose which auth-backed actor performs the action.

#### Scenario: Tool call with actor selection
- **WHEN** the operator selects an actor and invokes a terminal tool action
- **THEN** the request is sent using that actor selection rather than an implicit global identity

#### Scenario: Actor authority missing
- **WHEN** the chosen actor lacks valid terminal authority
- **THEN** the UI surfaces the failure as a credential/access problem and does not silently fall back

### Requirement: Terminal users SHALL own focus state per seat
Terminal focus behavior in the UI SHALL be modeled per user seat rather than as one terminal-global toggle.

#### Scenario: User-specific focus
- **WHEN** the operator focuses one user for a terminal
- **THEN** that user's seat state changes without implicitly focusing every other user

#### Scenario: No terminal-global focus affordance
- **WHEN** the terminal detail renders
- **THEN** focus/unfocus controls are available in the user list instead of as one page-level terminal action

### Requirement: Terminal detail SHALL restore durable activity after refresh
Refreshing the terminal route SHALL restore transcript/activity evidence and terminal metadata from durable backend state.

#### Scenario: Refresh terminal detail
- **WHEN** the browser refreshes while viewing a terminal
- **THEN** the transcript/activity pane reloads previously available terminal activity rather than appearing empty

#### Scenario: Absolute cwd display
- **WHEN** terminal metadata includes the current working directory
- **THEN** the UI displays the absolute path rather than a workspace-relative shorthand such as `.`
