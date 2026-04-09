# avatar-runtime-topology Specification

## Purpose
Define canonical AvatarRuntime identity and cross-system attachment topology.

## Requirements

### Requirement: AvatarRuntime SHALL use Avatar identity as its canonical runtime key
The system SHALL create and resolve runtime identity from Avatar identity alone. Workspace membership, room membership, and terminal membership SHALL NOT create additional runtime identities for the same Avatar.

#### Scenario: The same Avatar reuses one runtime across workspaces
- **WHEN** the same Avatar gains access to multiple workspaces
- **THEN** the system reuses the same AvatarRuntime id for that Avatar
- **AND** the attached workspaces appear as mounts on that runtime instead of as separate runtimes

#### Scenario: Different Avatars do not share runtime identity
- **WHEN** two different Avatars mount the same workspace
- **THEN** each Avatar receives its own runtime identity
- **AND** their attention, cycles, and private workspace slots remain isolated

### Requirement: AvatarRuntime SHALL support dynamic attachment of system resources
AvatarRuntime SHALL support dynamic attachment and detachment of workspaces, rooms, and terminals without recreating the runtime.

#### Scenario: Detaching a workspace does not recreate the runtime
- **WHEN** a workspace is detached from an existing AvatarRuntime
- **THEN** the runtime id remains stable
- **AND** existing attention and cycle history on that runtime remain available

#### Scenario: Room and terminal attachments coexist with workspace mounts
- **WHEN** an AvatarRuntime attaches rooms, terminals, and workspaces at the same time
- **THEN** all attachments are visible through the same runtime surface
- **AND** none of those attachments require a second runtime identity to be created

### Requirement: Avatar catalog SHALL be global
The system SHALL expose a global Avatar catalog rooted in the user's global avatar directory. Workspaces SHALL consume that catalog through mounts and workspace asset slots instead of defining independent workspace-local avatar definitions.

#### Scenario: Workspace launch consumes a global Avatar definition
- **WHEN** a workspace launches or mounts an Avatar that exists only in the global avatar catalog
- **THEN** the workspace uses that global Avatar definition directly
- **AND** the workspace does not need to create a workspace-local avatar copy before the runtime can start
