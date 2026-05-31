# workspace-env-capability-projection Specification

## Purpose

Define workspace instance env as the authority for private capability projection, including `AVATAR_HOME` parsing and typed accessors.

## Requirements

### Requirement: Workspace instance env SHALL be the authority for workspace capabilities

WorkspaceSystem SHALL model capability-bearing environment on the workspace instance rather than deriving private capabilities from hard-coded root/project workspace categories. A workspace instance MAY inherit the Avatar root workspace path into `AVATAR_HOME`, MAY override it with another absolute path list, or MAY leave it empty to indicate that avatar-private capabilities are unavailable.

Process launch env, exec-profile env, and per-command env overlays SHALL NOT be the durable authority for whether system CLIs are registered into the workspace instance. Those env layers MAY affect the spawned process, but the workspace instance capability projection MUST be computed from the workspace instance env.

#### Scenario: Workspace instance inherits avatar-private capability

- **GIVEN** a workspace instance is created with inherited avatar home paths
- **WHEN** WorkspaceSystem computes its capability projection
- **THEN** `workspace.getAvatarHome()` returns the inherited absolute paths
- **AND** systems that require avatar-private capability may evaluate that workspace for CLI injection

#### Scenario: Workspace instance has no avatar-private capability

- **GIVEN** a workspace instance is created without `AVATAR_HOME`
- **WHEN** WorkspaceSystem computes its capability projection
- **THEN** `workspace.getAvatarHome()` returns an empty array
- **AND** systems that require avatar-private capability MUST NOT register private CLIs into that workspace

#### Scenario: Command env overlay does not grant durable capability

- **GIVEN** a workspace instance has empty `AVATAR_HOME`
- **WHEN** a one-shot bash command passes `AVATAR_HOME=/avatar/private` in its per-command env overlay
- **THEN** that process may see the variable as process env
- **AND** WorkspaceSystem does not persist avatar-private capability for the workspace instance
- **AND** private system CLI registration is not retroactively enabled by that one-shot overlay

### Requirement: AVATAR_HOME SHALL be a pure ordered absolute path list

`AVATAR_HOME` SHALL be parsed and serialized as an ordered path list. The canonical write delimiter SHALL be `;` on every platform. Readers SHALL always understand `;`; on non-Windows platforms readers SHALL also understand the OS path delimiter `:` as a compatibility delimiter. Non-empty entries MUST be absolute paths. Empty or missing env values SHALL parse as an empty list, which means no avatar-private capability.

The merge law SHALL be last-wins: later entries are more specific overlays than earlier entries. Duplicate normalized paths SHALL keep the last occurrence.

#### Scenario: Empty AVATAR_HOME means no private capability

- **WHEN** `parseEnvAvatarHome(undefined)` or `parseEnvAvatarHome("")` is evaluated
- **THEN** it returns `[]`
- **AND** no filesystem read, write, or directory creation occurs

#### Scenario: Canonical serialization uses semicolon

- **GIVEN** avatar homes `["/avatar/base", "/avatar/user"]`
- **WHEN** WorkspaceSystem writes `AVATAR_HOME`
- **THEN** it serializes the env value as `/avatar/base;/avatar/user`
- **AND** it does not write platform-specific delimiters

#### Scenario: Non-Windows reader accepts colon compatibility

- **GIVEN** the runtime platform is non-Windows
- **WHEN** `parseEnvAvatarHome("/avatar/base:/avatar/user")` is evaluated
- **THEN** it returns `["/avatar/base", "/avatar/user"]`
- **AND** later resource merge conflicts are resolved in favor of `/avatar/user`

#### Scenario: Relative AVATAR_HOME entry is rejected

- **GIVEN** `AVATAR_HOME` contains `relative/avatar`
- **WHEN** WorkspaceSystem parses the env value for capability projection
- **THEN** the parse is rejected before any capability is projected
- **AND** the system does not fall back to current working directory or root workspace

#### Scenario: Duplicate AVATAR_HOME entries keep the last occurrence

- **GIVEN** `AVATAR_HOME` is `/avatar/a;/avatar/b;/avatar/a`
- **WHEN** the parser normalizes the value
- **THEN** the resulting order preserves the last occurrence of `/avatar/a`
- **AND** merge behavior treats `/avatar/a` as the most specific of those duplicate entries

### Requirement: Workspace SHALL expose typed Avatar home accessors

WorkspaceSystem SHALL expose `workspace.getAvatarHome(): string[]` and `workspace.setAvatarHome(paths: string[])` on workspace instances. The getter SHALL return the parsed normalized `AVATAR_HOME` list. The setter SHALL validate absolute paths, deduplicate with last-wins order, and write canonical `;`-delimited env without filesystem side effects beyond persisting the workspace instance env.

#### Scenario: setAvatarHome writes canonical env

- **GIVEN** a workspace instance receives `setAvatarHome(["/avatar/base", "/avatar/user"])`
- **WHEN** the workspace instance env is persisted
- **THEN** its `AVATAR_HOME` value is `/avatar/base;/avatar/user`
- **AND** `getAvatarHome()` returns `["/avatar/base", "/avatar/user"]`

#### Scenario: setAvatarHome rejects relative paths

- **WHEN** a caller invokes `setAvatarHome(["/avatar/base", "relative/avatar"])`
- **THEN** the setter rejects the request
- **AND** the previous workspace instance env remains unchanged

### Requirement: WorkspaceSystem bash capability projection SHALL not require root_bash renaming

The bottom-level primary tool for the runtime SHALL remain WorkspaceSystem bash. This change SHALL define runtime-private CLI availability through workspace instance capabilities, but it SHALL NOT require removing or renaming the existing `root_bash` visible tool surface in the first apply. Visible bash tool names are product/runtime command-surface compatibility concerns; capability authority belongs to workspace instance env.

#### Scenario: Private CLI availability follows env capability

- **GIVEN** two workspace instances exist
- **AND** only the second instance has non-empty `AVATAR_HOME`
- **WHEN** WorkspaceSystem projects available bash CLIs
- **THEN** avatar-private CLIs are available only in the second workspace instance
- **AND** the projection does not ask whether either workspace path is named root or project

#### Scenario: Existing root_bash name is not changed by this apply

- **GIVEN** the runtime currently exposes `root_bash`
- **WHEN** this Env-first capability projection change is applied
- **THEN** the change does not require renaming or removing `root_bash`
- **AND** future bash-surface convergence must be proposed as a separate explicit product/runtime law
