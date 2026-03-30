## MODIFIED Requirements

### Requirement: Workspace routes SHALL provide a scoped application shell

The WebUI SHALL provide a workspace-scoped shell for `Chats`, `Terminals`, `Devtools`, and `Settings`, and it SHALL provide a separate global `Settings` route for user-level settings and avatar management. The top header SHALL be one unified, passive, compact surface that keeps only navigation, location, passive state signals, workspace basename, and route switching visible, while route-local actions stay inside the route body.

#### Scenario: Selecting a tab does not mutate semantic focus

- **WHEN** the user switches between chat tabs or terminal tabs
- **THEN** the UI only changes the visible detail pane
- **AND** runtime focus remains unchanged until the user explicitly presses focus or unfocus
