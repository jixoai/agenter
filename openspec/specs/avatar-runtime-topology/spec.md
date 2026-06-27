# avatar-runtime-topology Specification

## Purpose
Define canonical AvatarRuntime identity and cross-system attachment topology.

## Requirements

### Requirement: AvatarRuntime SHALL use Avatar identity as its canonical runtime key
The system SHALL create and resolve runtime identity from Avatar identity alone. Workspace membership, room membership, terminal membership, and app-local shell session names SHALL NOT create additional runtime identities for the same Avatar.

#### Scenario: The same Avatar reuses one runtime across workspaces
- **WHEN** the same Avatar gains access to multiple workspaces
- **THEN** the system reuses the same AvatarRuntime id for that Avatar
- **AND** the attached workspaces appear as mounts on that runtime instead of as separate runtimes

#### Scenario: Different Avatars do not share runtime identity
- **WHEN** two different Avatars mount the same workspace
- **THEN** each Avatar receives its own runtime identity
- **AND** their attention, cycles, and private workspace slots remain isolated

#### Scenario: App shell names attach resources without creating runtimes
- **WHEN** a user runs `agenter shell --session=1` and later `agenter shell --session=2`
- **THEN** both app shell names attach rooms and terminals to the same AvatarRuntime for Avatar `shell-assistant`
- **AND** neither `1` nor `2` becomes a second runtime identity axis

#### Scenario: Explicit app Avatar override still uses Avatar identity
- **WHEN** a user runs `agenter shell @default --session=1` and later `agenter shell @default --session=2`
- **THEN** both app shell names attach rooms and terminals to the same AvatarRuntime for Avatar `default`
- **AND** the explicit Avatar mention, not the app session name, selects the runtime identity

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

### Requirement: AvatarRuntime SHALL support app runtime-session clears without multiplying runtime identity

AvatarRuntime identity SHALL remain keyed by Avatar identity alone. App startup may clear a selected Avatar's current runtime session context, but the clear operation SHALL NOT make app shell names, CLI flags, or workspace-local labels part of the runtime identity.

#### Scenario: Clear flag does not create session-key runtime identity
- **WHEN** a user runs `agenter shell --session=4 --avatar=review-4 --clear-avatar`
- **THEN** `review-4` selects the AvatarRuntime identity
- **AND** `shell-4` remains a app terminal/room resource key
- **AND** the replacement runtime does not include `shell-4` as an identity axis

#### Scenario: Same Avatar still reuses Avatar identity after clear
- **GIVEN** Avatar `review-4` was cleared and relaunched
- **WHEN** the user later runs `agenter shell --session=5 --avatar=review-4`
- **THEN** the app attaches `shell-5` resources to the same AvatarRuntime identity for Avatar `review-4`
- **AND** it does not create a separate runtime identity because the app shell name changed

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

#### Scenario: Workspace-local prompt residue cannot shadow global Avatar prompt
- **GIVEN** `~/.agenter/avatars/by-principal/0xabc.../AGENTER.mdx` exists
- **AND** `<workspace>/.agenter/avatars/by-principal/0xabc.../AGENTER.mdx` also exists
- **WHEN** the Avatar runtime resolves the prompt source for principal `0xabc...`
- **THEN** it reads `~/.agenter/avatars/by-principal/0xabc.../AGENTER.mdx`
- **AND** it does not read the workspace-local `AGENTER.mdx` as runtime prompt truth
