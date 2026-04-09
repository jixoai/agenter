# workspace-resource-ownership Specification

## Purpose
Define the durable ownership model for shared workspace resources, global room and terminal references, and warm resource reuse across workspace and runtime surfaces.

## Requirements

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

### Requirement: Session-scoped workspace resources SHALL be owned by lifecycle handles instead of route-local component state
Global room catalogs, global terminal catalogs, workspace settings graphs, workspace avatar catalogs, and current session attachment projections SHALL be owned by shared lifecycle handles instead of route-local component state. Workspace and running-avatar surfaces SHALL only own selection, bindings, and projection state.

#### Scenario: Workspaces welcome re-enters after the avatar catalog is warm
- **GIVEN** the current workspace context has already loaded its avatar catalog and current attachment projections
- **WHEN** the user leaves `Workspaces` and later returns to the same workspace or global workspace detail
- **THEN** the surface reuses the shared resource snapshots instead of creating a new cold bootstrap
- **THEN** the user does not lose the already-loaded avatar and orchestration context

#### Scenario: Running-avatar detail reuses shared room and terminal bindings
- **GIVEN** the application has already loaded global room or terminal resources referenced by a running avatar
- **WHEN** the user opens that avatar's runtime detail shell
- **THEN** the shell consumes the same shared resource snapshots plus session bindings
- **THEN** it does not create a second authority for the same room or terminal resources

### Requirement: Shared workspace resources SHALL distinguish cold ensure from warm refresh
Workspace and resource APIs SHALL expose `ensure` semantics for cold ownership and SHALL preserve warm data during explicit refresh flows for workspace settings graphs, workspace avatar catalogs, and QuickStart picker resources such as rooms and terminals.

#### Scenario: Ensuring a cold workspace avatar catalog
- **GIVEN** the selected workspace has no cached avatar catalog yet
- **WHEN** the Workspaces surface requests that catalog with `ensure`
- **THEN** the resource enters a cold loading state once
- **THEN** the loaded snapshot is published into shared runtime state for later reuse

#### Scenario: Refreshing a warm terminal picker resource
- **GIVEN** the Welcome orchestration surface already has a loaded terminal picker snapshot
- **WHEN** the user refreshes that picker after creating or editing terminals elsewhere
- **THEN** the previously loaded data remains visible while the refresh runs
- **THEN** the resource reports a warm refresh state instead of reverting to a cold empty-loading state

### Requirement: Workspace settings route entry SHALL use warm ensure semantics
Workspace settings route entry SHALL avoid treating already-loaded settings graphs as a first load every time the user re-enters `Settings`, including the special global workspace rooted at `~/`.

#### Scenario: Global workspace settings re-enters after layers are loaded
- **GIVEN** the global workspace settings graph has already been loaded
- **WHEN** the user leaves and later returns to the global workspace `Settings` tab
- **THEN** the route uses ensure semantics for the same semantic workspace target
- **THEN** existing layers remain available without replaying the first-load empty state

#### Scenario: Regular workspace settings re-enters after layers are loaded
- **GIVEN** a regular workspace settings graph has already been loaded
- **WHEN** the user leaves and later returns to that workspace's `Settings` tab
- **THEN** the route uses ensure semantics for that workspace path
- **THEN** existing layers remain available without replaying the first-load empty state

### Requirement: Workspace shell SHALL treat room and terminal selections as global-resource references
Saved room selections, terminal selections, and default-avatar selections surfaced through `Welcome` or runtime shell flows SHALL be modeled as references to global resources rather than as workspace-owned room or terminal topology.

#### Scenario: Saved selections do not imply workspace ownership
- **WHEN** the Workspaces surface shows saved room or terminal selections for an avatar launch flow
- **THEN** those selections are presented as references to global room or terminal ids
- **THEN** the shell does not imply that the current workspace owns those resources

#### Scenario: Global resources can span multiple workspaces
- **WHEN** avatars from multiple different workspaces join the same room or attach to the same terminal
- **THEN** the shell can reference that one global resource from each relevant launch or runtime surface
- **THEN** the system does not require a separate per-workspace copy of the room or terminal
