# workspace-system-capabilities Specification

## MODIFIED Requirements

### Requirement: WorkspaceSystem SHALL expose runtime-local workspace ids and aliases for mounted project workspaces
Each mounted project workspace attached to one runtime SHALL carry a stable runtime-local numeric id, a mutable alias, and a default exec cwd. These fields belong to the runtime mount, not the global workspace record.

#### Scenario: Re-attach preserves runtime-local workspace identity
- **GIVEN** runtime `sess-1` previously attached workspace `/repo/frontend` with runtime-local id `1`, alias `frontend`, and exec cwd `/repo/frontend`
- **WHEN** that workspace is detached and later re-attached to the same runtime
- **THEN** the runtime reuses id `1`
- **AND** it preserves alias `frontend`
- **AND** the default exec cwd remains `/repo/frontend` unless explicitly changed

#### Scenario: Alias mutation is runtime-local
- **GIVEN** two different runtimes mount the same workspace path
- **WHEN** one runtime renames its mounted workspace alias to `frontend`
- **THEN** the other runtime does not inherit that alias automatically

### Requirement: WorkspaceSystem SHALL provide isolated workspace bash execution
`workspace_bash` SHALL execute inside one mounted project workspace only. The shell SHALL preserve that workspace’s grant law and asset/tool visibility, without inheriting root-shell runtime control-plane commands or credentials.

#### Scenario: workspace_bash stays inside one mounted workspace
- **GIVEN** one runtime holds two mounted workspaces with ids `1` and `2`
- **WHEN** the AI calls `workspace_bash` with `workspaceId=1`
- **THEN** the execution sees workspace `1`'s files, grants, public/private assets, and tool scripts
- **AND** it does not inherit workspace `2`'s authority implicitly

#### Scenario: Root-only control remains separate
- **WHEN** the AI needs runtime-local `attention` or `message` control
- **THEN** it must use `root_bash`
- **AND** `workspace_bash` is not treated as an equivalent root-control surface
