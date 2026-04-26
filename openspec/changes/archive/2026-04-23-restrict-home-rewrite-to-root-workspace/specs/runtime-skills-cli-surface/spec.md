## MODIFIED Requirements

### Requirement: Runtime SHALL expose explicit workspace primitives as model tools
Each AI model round SHALL receive `workspace_list`, `root_bash`, and `workspace_bash` as the only direct tools. Message, terminal, workspace, and attention system operations SHALL be performed through CLI commands inside `root_bash` instead of through direct model tool injection. `root_bash` SHALL execute as the fixed `root-workspace` shell surface and MAY rewrite `HOME` to the avatar root workspace while mounting root-exclusive runtime CLI/env. `workspace_bash` SHALL stay a pure `public-workspace` shell selected by `workspaceId` and SHALL NOT synthesize avatar-root `HOME` or mount root-workspace-exclusive CLI helpers.

#### Scenario: Model receives only the explicit workspace direct tools
- **WHEN** the runtime prepares a model call
- **THEN** the direct tool list contains `workspace_list`, `root_bash`, and `workspace_bash`
- **AND** it does not include `attention_*`, `message_*`, or `terminal_*` direct tools

#### Scenario: Root bash keeps avatar-root home semantics
- **WHEN** the AI executes `root_bash`
- **THEN** the shell runs inside the fixed avatar-root workspace
- **AND** `HOME` resolves to that avatar-root workspace

#### Scenario: Root bash exposes root-exclusive runtime CLI
- **WHEN** the AI executes `root_bash`
- **THEN** runtime-local CLI commands such as `attention`, `message`, `workspace`, `terminal`, `skill`, and `tool` are available inside that shell
- **AND** those commands are treated as root-workspace-only shell affordances rather than public-workspace defaults

#### Scenario: Workspace bash does not inherit root-workspace semantics
- **WHEN** the AI executes `workspace_bash` for a mounted project workspace
- **THEN** the shell runs with that workspace authority and selected cwd
- **AND** the runtime does not silently rewrite `HOME` to the avatar-root workspace
- **AND** root-workspace-exclusive CLI helpers are not mounted inside that shell
