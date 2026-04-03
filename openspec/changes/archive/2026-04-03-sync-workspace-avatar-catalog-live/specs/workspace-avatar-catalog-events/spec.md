## ADDED Requirements

### Requirement: Workspace avatar catalogs SHALL publish live invalidation events
The system SHALL publish avatar catalog invalidation events whenever the global avatar root or a workspace-local avatar root changes in a way that affects the effective avatar catalog for an inspected workspace.

#### Scenario: Copying an avatar invalidates the inspected workspace catalog
- **WHEN** the operator copies or forks an avatar into a workspace
- **THEN** the server emits an avatar catalog change event for that workspace
- **THEN** subscribed clients reload or reconcile the affected workspace avatar catalog without requiring a full page refresh

#### Scenario: External filesystem edits invalidate the effective catalog
- **WHEN** an avatar directory is created, removed, or renamed under the global avatar root or a watched workspace avatar root
- **THEN** the server emits catalog change events for the affected workspaces
- **THEN** subscribed clients update the visible avatar catalog to match the filesystem truth
