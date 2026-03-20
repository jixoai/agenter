## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chat`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The app header MUST remain global and passive by keeping only application-level location, navigation, and passive runtime state visible, while workspace route switching and route-local actions stay inside the workspace shell or route surfaces.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chat`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the global header
- **THEN** the global app header does not repeat the workspace path or route-local notices already rendered inside the workspace shell

#### Scenario: Open global settings outside the workspace shell
- **WHEN** the user activates the global settings entry from application chrome
- **THEN** the application navigates to a dedicated global settings route
- **THEN** the route is not rendered inside the workspace shell tabs

### Requirement: The application SHALL provide stable primary and secondary session navigation
The WebUI SHALL render a stable primary navigation that only exposes `Quick Start` and `Workspaces`, and it SHALL render running-session entry points through a secondary running-session section inside the application sidebar model instead of adding dynamic session shortcuts to the primary sidebar or header.

#### Scenario: Primary navigation stays fixed
- **WHEN** the application renders its global navigation
- **THEN** the primary sidebar shows `Quick Start` and `Workspaces` as the only primary entries

#### Scenario: Running sessions use a sidebar secondary section
- **WHEN** one or more sessions are running
- **THEN** the application exposes those sessions through a secondary running-session section in the sidebar on desktop and in the shared navigation drawer on mobile
- **THEN** the application does not add separate session shortcuts to the primary navigation or dedicate a header-only session switcher to them
