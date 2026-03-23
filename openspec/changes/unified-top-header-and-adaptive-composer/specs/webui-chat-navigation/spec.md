## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The application header SHALL be one unified top surface that keeps app-level facts on its first row and workspace-level route controls on its second row.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into a second header
- **THEN** the unified top header does not repeat the workspace path or route-local notices already rendered inside the route surface

#### Scenario: Open global settings outside the workspace shell
- **WHEN** the user activates the global settings entry from application chrome
- **THEN** the application navigates to a dedicated global settings route
- **THEN** the route is not rendered inside the workspace shell tabs

### Requirement: Workspace shell chrome SHALL preserve a fixed hierarchy
The WebUI SHALL preserve a fixed shell hierarchy where the left application sidebar owns the outermost navigation chrome, the main shell owns the unified top header and route region, and the workspace route surface owns only route content plus route-local notices/actions.

#### Scenario: Workspace route content is not wrapped by duplicate padding stacks
- **WHEN** a workspace route renders Chat, Devtools, or Settings content
- **THEN** the outer application shell does not inject a second competing content padding layer inside the workspace scaffold
- **THEN** the workspace route keeps visual priority over surrounding shell chrome
