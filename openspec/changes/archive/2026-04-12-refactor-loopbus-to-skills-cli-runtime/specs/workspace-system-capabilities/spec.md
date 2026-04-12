## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL manage dynamic mounts and path grants independent of Avatar definitions
The system SHALL model workspaces as independently mountable resources, while also attaching one fixed avatar root workspace for every runtime. Avatar runtimes SHALL receive project workspace access only through explicit workspace mounts and path-level grants, and the fixed avatar root workspace SHALL exist in addition to those dynamic mounts.

#### Scenario: Runtime always includes one fixed avatar root workspace
- **WHEN** an avatar runtime starts
- **THEN** WorkspaceSystem attaches the avatar's principal-address root workspace as a fixed mount
- **AND** that mount remains available even if no project workspace is currently attached

#### Scenario: Dynamic project workspaces remain explicit
- **WHEN** an avatar runtime needs access to a project workspace
- **THEN** that workspace still requires an explicit mount and grant set
- **AND** the fixed avatar root workspace does not implicitly grant access to unrelated project paths

### Requirement: WorkspaceSystem SHALL provide sandboxed bash execution
WorkspaceSystem SHALL expose non-interactive sandboxed bash execution backed by the fixed avatar root workspace plus any currently granted dynamic workspaces. The shell SHALL use real absolute path semantics for mounted roots while still restricting access to mounted authorities only.

#### Scenario: Root workspace bash uses real mounted paths
- **WHEN** the AI runs `pwd` or `ls` in root workspace bash
- **THEN** the shell reports the real absolute mount paths, such as `~/.agenter/avatars/<principal>` or an explicitly mounted project root
- **AND** it does not expose synthetic prompt-facing mount aliases such as `/workspace`

#### Scenario: Unmounted paths remain inaccessible
- **WHEN** root workspace bash tries to access a filesystem path that is not the fixed avatar root workspace and is not under a currently granted workspace mount
- **THEN** the execution is rejected or the path is not found inside the shell sandbox
- **AND** the runtime does not silently widen filesystem authority

#### Scenario: One-shot bash can verify loopback URLs like a terminal
- **WHEN** the runtime starts a local HTTP service on `127.0.0.1` through a granted terminal
- **THEN** `root_workspace_bash` can still verify that URL with one-shot network commands such as `curl`
- **AND** AI does not need to abandon the shell verification step just because the service is local
