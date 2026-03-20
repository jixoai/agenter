## MODIFIED Requirements

### Requirement: Workspace settings SHALL remain workspace-scoped while global settings stay separate
The system SHALL keep workspace settings inspection and per-layer editing scoped to a `workspacePath`, while user-level settings and avatar catalog management SHALL be exposed through a separate global settings surface that does not require an active session.

#### Scenario: Inspect workspace settings without a session
- **WHEN** a client requests workspace settings layers for a workspace path that has no active session
- **THEN** the server returns the effective merged settings and the discovered workspace-scoped source layers for that workspace

#### Scenario: Open global settings without entering a workspace shell
- **WHEN** the client opens the dedicated global settings route
- **THEN** the server returns user-level settings and avatar-catalog data without requiring `workspacePath` or `sessionId`
- **THEN** workspace layer editing remains in the workspace settings surface only
