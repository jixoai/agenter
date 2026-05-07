# avatar-runtime-topology Specification

## Purpose
Define canonical AvatarRuntime identity and cross-system attachment topology.

## Requirements

### Requirement: AvatarRuntime SHALL use Avatar identity as its canonical runtime key
The system SHALL create and resolve runtime identity from Avatar identity alone. Workspace membership, room membership, terminal membership, and product-local shell session names SHALL NOT create additional runtime identities for the same Avatar.

#### Scenario: The same Avatar reuses one runtime across workspaces
- **WHEN** the same Avatar gains access to multiple workspaces
- **THEN** the system reuses the same AvatarRuntime id for that Avatar
- **AND** the attached workspaces appear as mounts on that runtime instead of as separate runtimes

#### Scenario: Different Avatars do not share runtime identity
- **WHEN** two different Avatars mount the same workspace
- **THEN** each Avatar receives its own runtime identity
- **AND** their attention, cycles, and private workspace slots remain isolated

#### Scenario: Product shell names attach resources without creating runtimes
- **WHEN** a user runs `agenter shell --session=1` and later `agenter shell --session=2`
- **THEN** both product shell names attach rooms and terminals to the same AvatarRuntime for Avatar `shell-assistant`
- **AND** neither `1` nor `2` becomes a second runtime identity axis

#### Scenario: Explicit product Avatar override still uses Avatar identity
- **WHEN** a user runs `agenter shell @default --session=1` and later `agenter shell @default --session=2`
- **THEN** both product shell names attach rooms and terminals to the same AvatarRuntime for Avatar `default`
- **AND** the explicit Avatar mention, not the product session name, selects the runtime identity

### Requirement: AvatarRuntime SHALL support dynamic attachment of system resources
AvatarRuntime SHALL support dynamic attachment and detachment of workspaces, rooms, and terminals without recreating the runtime. In addition to those dynamic attachments, every runtime SHALL keep one fixed avatar root workspace keyed by the avatar principal address.

#### Scenario: Detaching a workspace does not recreate the runtime
- **WHEN** a workspace is detached from an existing AvatarRuntime
- **THEN** the runtime id remains stable
- **AND** existing attention and cycle history on that runtime remain available

#### Scenario: Room and terminal attachments coexist with workspace mounts
- **WHEN** an AvatarRuntime attaches rooms, terminals, and workspaces at the same time
- **THEN** all attachments are visible through the same runtime surface
- **AND** none of those attachments require a second runtime identity to be created

#### Scenario: Fixed avatar root workspace survives resource churn
- **WHEN** dynamic workspaces, rooms, or terminals are attached, detached, stopped, or restored
- **THEN** the fixed avatar root workspace remains attached to the same runtime identity
- **AND** the runtime does not need to recreate its identity to regain that private root

### Requirement: Avatar catalog SHALL be global
The system SHALL expose a global Avatar catalog rooted in the user's global avatar directory, and each avatar's canonical private runtime home SHALL be the principal-address directory under that global root. Nicknames SHALL remain discoverability aliases only.

#### Scenario: Workspace launch consumes a global Avatar definition
- **WHEN** a workspace launches or mounts an Avatar that exists only in the global avatar catalog
- **THEN** the workspace uses that global Avatar definition directly
- **AND** the workspace does not need to create a workspace-local avatar copy before the runtime can start

#### Scenario: Principal-address root is canonical and nickname is alias
- **WHEN** avatar `frontend` resolves to principal `0xabc...`
- **THEN** its canonical private root is `~/.agenter/avatars/by-principal/0xabc...`
- **AND** any nickname-based path points to that canonical root through aliasing instead of becoming a second source of truth
