## ADDED Requirements

### Requirement: Client runtime store SHALL expose typed workspace CLI catalog queries
The client runtime store SHALL expose typed methods for the workspace CLI catalog instead of requiring the Workspace route to call raw transport clients directly.

#### Scenario: Workspace route reads the CLI catalog through typed store methods
- **WHEN** the Workspace workbench needs the current workspace/avatar command catalog
- **THEN** it can obtain that catalog through typed runtime store methods
- **AND** the route does not instantiate its own ad hoc transport layer

#### Scenario: Typed facade preserves grouped catalog truth
- **WHEN** the runtime store returns the workspace CLI catalog
- **THEN** the returned groups and entries match the app-server command catalog contract exactly
- **AND** the store does not flatten or reinterpret the command surface into an incompatible local shape
