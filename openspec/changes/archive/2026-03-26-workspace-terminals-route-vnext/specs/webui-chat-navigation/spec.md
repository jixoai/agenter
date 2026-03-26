## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell
The WebUI SHALL provide a workspace-scoped shell for `Chats`, `Terminals`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The top header SHALL be one unified, passive, compact surface that keeps only navigation, location, passive state signals, workspace basename, and route switching visible, while route-local actions stay inside the route body.

#### Scenario: Open a workspace shell route
- **WHEN** the user enters a workspace-scoped route
- **THEN** the page shows the current workspace context and the shell navigation for `Chats`, `Terminals`, `Devtools`, and `Settings`
- **THEN** the active route surface owns its own local notices and primary actions without pushing them into the top header
- **THEN** the top header does not repeat the workspace path or route-local notices already rendered inside the workspace shell
