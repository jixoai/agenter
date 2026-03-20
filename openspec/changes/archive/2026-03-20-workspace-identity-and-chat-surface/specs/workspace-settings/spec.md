## MODIFIED Requirements

### Requirement: Workspace settings SHALL be available without an active session
The system SHALL allow clients to inspect workspace settings layers and effective merged settings by `workspacePath` without starting or selecting a session, and that workspace-scoped surface SHALL remain separate from global user settings and avatar management.

#### Scenario: Inspect settings before any session exists
- **WHEN** a client requests settings layers for a workspace path that has no active session
- **THEN** the server returns the effective merged settings and the discovered source layers for that workspace

#### Scenario: Workspace settings excludes global avatar management
- **WHEN** the user opens a workspace settings surface
- **THEN** the surface shows only workspace-scoped settings layers and effective values
- **THEN** global user profile and avatar management are not edited from this surface

### Requirement: Workspace settings SHALL preserve per-layer editing semantics
The system SHALL expose individual settings layers with editability metadata, and it SHALL allow saving only editable layers while keeping the effective merged result read-only.

#### Scenario: Save an editable workspace layer
- **WHEN** a client saves an editable settings layer for a workspace
- **THEN** the server persists that layer and returns the refreshed effective merged settings for the same workspace

#### Scenario: Reject a readonly workspace layer save
- **WHEN** a client attempts to save a readonly workspace layer for a workspace
- **THEN** the server rejects the save and reports that the layer is readonly
