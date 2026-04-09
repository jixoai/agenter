## ADDED Requirements

### Requirement: Workspace assets SHALL distinguish public and avatar-private ownership
WorkspaceSystem SHALL distinguish shared public workspace assets from avatar-private workspace assets as separate durable ownership domains.

#### Scenario: Public workspace asset is shared
- **WHEN** one avatar writes a skill, memory, tool, or archive artifact into the workspace public root
- **THEN** another avatar mounting the same workspace can read that artifact through WorkspaceSystem
- **AND** the artifact is not reclassified as owned by the second avatar

#### Scenario: Avatar-private workspace asset remains isolated
- **WHEN** an avatar writes a skill, memory, tool, or archive artifact into its workspace avatar-private root
- **THEN** another avatar mounting the same workspace does not see that artifact in its own private root
- **AND** WorkspaceSystem continues to attribute that artifact to the owning avatar only

### Requirement: Workspace mounts SHALL not transfer ownership of global rooms or terminals
WorkspaceSystem SHALL treat rooms and terminals as attached cross-system resources rather than as workspace-owned topology.

#### Scenario: Shared room spans multiple workspaces
- **WHEN** avatars from different workspaces attach to the same room
- **THEN** each workspace mount references that one global room id
- **AND** the system does not create a second per-workspace room copy

#### Scenario: Shared terminal spans multiple workspaces
- **WHEN** avatars from different workspaces attach to the same terminal
- **THEN** each workspace mount references that one global terminal id
- **AND** workspace ownership rules do not imply the terminal belongs to any one workspace root
