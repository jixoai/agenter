## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL manage dynamic mounts and path grants independent of Avatar definitions

The system SHALL model workspaces as independently mountable resources, while also attaching one fixed avatar root workspace for every runtime. Avatar runtimes SHALL receive project workspace access only through explicit workspace mounts and ordered grant rules, and the fixed avatar root workspace SHALL exist in addition to those dynamic mounts. A project workspace is a tool surface for cwd, mounts, grants, workbench browsing, explicit private overlays, and one-shot execution; it SHALL NOT become the default owner for Avatar identity, app-owned assistant prompt truth, or app-owned assistant memory-pack truth.

#### Scenario: Runtime always includes one fixed avatar root workspace

- **WHEN** an avatar runtime starts
- **THEN** WorkspaceSystem attaches the avatar's principal-address root workspace as a fixed mount
- **AND** that mount remains available even if no project workspace is currently attached

#### Scenario: Dynamic project workspaces remain explicit

- **WHEN** an avatar runtime needs access to a project workspace
- **THEN** that workspace still requires an explicit mount and grant set
- **AND** the fixed avatar root workspace does not implicitly grant access to unrelated project paths
- **AND** the project workspace does not become an Avatar identity or app-owned memory root merely because it was used as cwd

#### Scenario: One Avatar runtime mounts multiple workspaces concurrently

- **WHEN** one Avatar runtime mounts two different workspaces at the same time
- **THEN** both mounts remain attached to the same runtime identity
- **AND** each mount keeps its own ordered grant rule set and workspace metadata
- **AND** app-owned assistant memory remains addressed by the same global Avatar principal root

#### Scenario: Ordered grant rules are evaluated last-match-wins

- **GIVEN** a workspace mount applies `/src` as `ro` and later applies `/src/generated` as `rw`
- **WHEN** workspace bash writes under `/src/generated`
- **THEN** the later `rw` rule wins and the write succeeds
- **AND** writes under `/src/manual` still fail because the broader `ro` rule remains in effect there

#### Scenario: Path grants enforce read-only and writable boundaries

- **GIVEN** a workspace mount grants `/src` as read-only and `/tmp` as writable
- **WHEN** workspace bash execution attempts to write under `/src`
- **THEN** the execution is rejected as a permission violation
- **AND** writes under `/tmp` remain allowed
