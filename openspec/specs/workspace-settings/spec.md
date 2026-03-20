## Purpose

Define workspace-scoped settings access and per-layer editing behavior independent of session selection.
## Requirements
### Requirement: Workspace settings SHALL remain workspace-scoped while global settings stay separate
The system SHALL keep workspace settings inspection and per-layer editing scoped to a `workspacePath`, while user-level settings and avatar catalog management SHALL be exposed through a separate global settings surface that does not require an active session.

#### Scenario: Inspect workspace settings without a session
- **WHEN** a client requests workspace settings layers for a workspace path that has no active session
- **THEN** the server returns the effective merged settings and the discovered workspace-scoped source layers for that workspace

#### Scenario: Open global settings without entering a workspace shell
- **WHEN** the client opens the dedicated global settings route
- **THEN** the server returns user-level settings and avatar-catalog data without requiring `workspacePath` or `sessionId`
- **THEN** workspace layer editing remains in the workspace settings surface only

### Requirement: Workspace settings SHALL preserve per-layer editing semantics
The system SHALL expose individual settings layers with editability metadata, and it SHALL allow saving only editable layers while keeping the effective merged result read-only.

#### Scenario: Save an editable workspace layer
- **WHEN** a client saves an editable settings layer for a workspace
- **THEN** the server persists that layer and returns the refreshed effective merged settings for the same workspace

#### Scenario: Reject a readonly workspace layer save
- **WHEN** a client attempts to save a readonly workspace layer for a workspace
- **THEN** the server rejects the save and reports that the layer is readonly

### Requirement: Workspace settings SHALL adapt layer detail presentation by viewport class
The WebUI SHALL present workspace setting layers as a split pane on expanded or landscape viewports and as a right-side detail sheet on compact or medium portrait viewports.

#### Scenario: Desktop or landscape settings uses split layer detail
- **WHEN** the user opens workspace Settings on an expanded viewport or any landscape viewport and activates the `Layer Sources` view
- **THEN** the sources list and layer editor are visible side by side
- **THEN** selecting a source updates the in-page editor pane

#### Scenario: Portrait compact settings uses right-sheet layer detail
- **WHEN** the user opens workspace Settings on a compact or medium portrait viewport, activates `Layer Sources`, and selects a source
- **THEN** the layer editor opens in a right-side sheet
- **THEN** the sources list remains the primary in-page panel behind that sheet

