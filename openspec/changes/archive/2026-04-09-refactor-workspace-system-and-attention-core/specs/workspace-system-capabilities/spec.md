## ADDED Requirements

### Requirement: WorkspaceSystem SHALL manage dynamic mounts and path grants independent of Avatar definitions
The system SHALL model workspaces as independently mountable resources. Avatar runtimes SHALL receive workspace access only through explicit workspace mounts and path-level grants, not through implicit avatar-directory inheritance.

#### Scenario: One Avatar runtime mounts multiple workspaces concurrently
- **WHEN** one Avatar runtime mounts two different workspaces at the same time
- **THEN** both mounts remain attached to the same runtime identity
- **AND** each mount keeps its own grant set and workspace metadata

#### Scenario: Path grants enforce read-only and writable boundaries
- **GIVEN** a workspace mount grants `/src` as read-only and `/tmp` as writable
- **WHEN** workspace bash execution attempts to write under `/src`
- **THEN** the execution is rejected as a permission violation
- **AND** writes under `/tmp` remain allowed

### Requirement: WorkspaceSystem SHALL expose public and avatar-private asset roots
Each mounted workspace SHALL expose one shared public asset root and one avatar-private asset root. Public assets SHALL be shared across avatars using that workspace, while avatar-private assets SHALL remain isolated by Avatar identity.

#### Scenario: Workspace public assets are shared across avatars
- **WHEN** one avatar writes a memory, skill, tool, or archive artifact into the workspace public root
- **THEN** another avatar mounting the same workspace can read that artifact through WorkspaceSystem
- **AND** the artifact is not copied into each avatar-private root

#### Scenario: Avatar-private workspace assets stay isolated
- **WHEN** one avatar writes a memory, skill, tool, or archive artifact into its workspace avatar-private root
- **THEN** a different avatar mounting the same workspace does not see that artifact in its own private root
- **AND** the artifact remains addressable through the owning avatar's private workspace slot only

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution
WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by mount-aware workspace grants. Each execution SHALL start with isolated shell session state while preserving filesystem side effects across executions.

#### Scenario: Filesystem effects persist while shell session state does not
- **WHEN** the first workspace bash execution creates a file and exports an environment variable
- **THEN** a later execution can read the created file
- **AND** the later execution does not inherit the previous shell environment, functions, or current working directory implicitly

#### Scenario: Workspace tools become callable command helpers
- **WHEN** a workspace public or avatar-private `tools/` directory contains an executable script with a supported shebang
- **THEN** WorkspaceSystem exposes that script through a `tool_*` command in workspace bash execution
- **AND** the command runs under the same workspace grant and sandbox rules as other workspace bash calls
