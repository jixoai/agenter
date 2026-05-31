## MODIFIED Requirements

### Requirement: Workspace mounts SHALL not transfer ownership of global rooms or terminals

WorkspaceSystem SHALL treat rooms and terminals as attached cross-system resources rather than as workspace-owned topology. `public-workspace` and `avatar-root` are workspace instance surfaces whose available private capabilities are determined by explicit env/capability projection, not by blanket ownership transfer. Mounting or selecting one fixed avatar-root workspace or one ordinary shared workspace SHALL NOT imply that a global terminal inherits ownership, identity, avatar-private CLI, user-home semantics, or `AVATAR_HOME` from that workspace root.

#### Scenario: Shared room spans multiple workspaces

- **WHEN** avatars from different workspaces attach to the same room
- **THEN** each workspace mount references that one global room id
- **AND** the system does not create a second per-workspace room copy

#### Scenario: Shared terminal spans multiple workspaces

- **WHEN** avatars from different workspaces attach to the same terminal
- **THEN** each workspace mount references that one global terminal id
- **AND** workspace ownership rules do not imply the terminal belongs to any one workspace root

#### Scenario: Terminal semantics do not transfer from one workspace root

- **WHEN** a shared terminal is launched from or later visits one mounted workspace root, including the fixed avatar-root workspace
- **THEN** that workspace root does not become the terminal's owner
- **AND** terminal environment semantics such as `HOME`, `AVATAR_HOME`, and private CLI projection are not silently rewritten from that workspace root

#### Scenario: Visible bash surface naming remains outside ownership transfer

- **WHEN** the runtime exposes existing bash tool names such as `root_bash` or `workspace_bash`
- **THEN** those names do not transfer ownership of rooms or terminals
- **AND** this change does not require renaming or removing those visible tool names

#### Scenario: Durable shell world does not claim shared terminal ownership

- **WHEN** the runtime keeps one durable shell world for an avatar-private workspace instance
- **THEN** that singleton world remains an implementation detail of that workspace instance surface
- **AND** it does not reclassify shared terminals as root-owned resources
