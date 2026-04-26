## MODIFIED Requirements

### Requirement: Workspace mounts SHALL not transfer ownership of global rooms or terminals
WorkspaceSystem SHALL treat rooms and terminals as attached cross-system resources rather than as workspace-owned topology. `public-workspace` and `terminal` are collaboration surfaces, while `root-workspace` is a special env/CLI profile rather than a blanket ownership wall. Mounting or selecting one fixed avatar-root workspace or one ordinary shared workspace SHALL NOT imply that a global terminal inherits ownership, identity, root-exclusive CLI, or user-home semantics from that workspace root.

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
- **AND** terminal environment semantics such as `HOME` and root-exclusive CLI are not silently rewritten from that workspace root

#### Scenario: Root-workspace specialness does not imply an absolute no-sharing rule
- **WHEN** the system distinguishes `root-workspace` from collaboration-oriented `public-workspace` and shared terminals
- **THEN** that distinction is expressed through env/CLI semantics rather than by claiming that root-workspace can never be visited or shared
- **AND** ownership and grant law remain separate from the root-workspace labeling itself
