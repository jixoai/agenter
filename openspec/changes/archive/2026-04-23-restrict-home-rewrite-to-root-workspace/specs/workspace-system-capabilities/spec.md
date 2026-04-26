## ADDED Requirements

### Requirement: WorkspaceSystem SHALL distinguish `root-workspace` and `public-workspace` shell semantics
WorkspaceSystem SHALL treat the fixed avatar-root mount as the `root-workspace` shell surface and SHALL treat ordinary mounted project workspaces as `public-workspace` shell surfaces. `root-workspace` MAY mount avatar-exclusive env and CLI helpers. `public-workspace` SHALL remain collaboration-oriented by default and SHALL NOT inherit root-workspace-exclusive env or CLI merely because the runtime also owns a root-workspace. A `public-workspace` MAY still contain avatar-private workspace asset roots inside its file tree; that does not change its shell semantics.

#### Scenario: Fixed avatar mount is the root-workspace surface
- **WHEN** a runtime starts
- **THEN** its fixed avatar-root mount is treated as `root-workspace`
- **AND** root-workspace-exclusive env or CLI is only legal on that shell surface by default

#### Scenario: Mounted project workspace is a public-workspace surface
- **WHEN** a runtime mounts an ordinary project workspace
- **THEN** that mount is treated as a `public-workspace` shell surface
- **AND** the presence of workspace avatar-private subtrees does not upgrade it into `root-workspace`

#### Scenario: Public-workspace shell excludes root-exclusive CLI
- **WHEN** the operator or AI executes a shell against a `public-workspace`
- **THEN** root-workspace-exclusive CLI helpers are not auto-mounted into that shell
- **AND** the shell remains collaboration-safe by default
