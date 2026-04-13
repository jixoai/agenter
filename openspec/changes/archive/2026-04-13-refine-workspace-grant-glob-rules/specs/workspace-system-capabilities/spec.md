## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL manage dynamic mounts and path grants independent of Avatar definitions
The system SHALL model workspaces as independently mountable resources, while also attaching one fixed avatar root workspace for every runtime. Avatar runtimes SHALL receive project workspace access only through explicit workspace mounts and ordered grant rules, and the fixed avatar root workspace SHALL exist in addition to those dynamic mounts.

#### Scenario: One Avatar runtime mounts multiple workspaces concurrently
- **WHEN** one Avatar runtime mounts two different workspaces at the same time
- **THEN** both mounts remain attached to the same runtime identity
- **AND** each mount keeps its own ordered grant rule set and workspace metadata

#### Scenario: Ordered grant rules are evaluated last-match-wins
- **GIVEN** a workspace mount applies `/src` as `ro` and later applies `/src/generated` as `rw`
- **WHEN** workspace bash writes under `/src/generated`
- **THEN** the later `rw` rule wins and the write succeeds
- **AND** writes under `/src/manual` still fail because the broader `ro` rule remains in effect there

### Requirement: Path grants enforce read-only and writable boundaries
Each mounted workspace SHALL evaluate grant rules as ordered workspace-root-relative glob patterns. Rule evaluation SHALL be default-deny and last-match-wins.

#### Scenario: Path grants enforce read-only and writable boundaries
- **GIVEN** a workspace mount grants `/src` as read-only and `/tmp` as writable
- **WHEN** workspace bash execution attempts to write under `/src`
- **THEN** the execution is rejected as a permission violation
- **AND** writes under `/tmp` remain allowed

#### Scenario: Ungranted paths stay unreadable
- **GIVEN** a workspace mount grants `/src/**/*.ts` as read-only
- **WHEN** workspace bash or root workspace bash attempts to read `/docs/roadmap.md`
- **THEN** the read is rejected because no rule grants that path
- **AND** directory listings only expose paths that remain readable or traversable under the same rule set
