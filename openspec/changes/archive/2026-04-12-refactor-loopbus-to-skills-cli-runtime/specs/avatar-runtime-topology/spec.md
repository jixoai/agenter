## MODIFIED Requirements

### Requirement: AvatarRuntime SHALL support dynamic attachment of system resources
AvatarRuntime SHALL support dynamic attachment and detachment of workspaces, rooms, and terminals without recreating the runtime. In addition to those dynamic attachments, every runtime SHALL keep one fixed avatar root workspace keyed by the avatar principal address.

#### Scenario: Fixed avatar root workspace survives resource churn
- **WHEN** dynamic workspaces, rooms, or terminals are attached, detached, stopped, or restored
- **THEN** the fixed avatar root workspace remains attached to the same runtime identity
- **AND** the runtime does not need to recreate its identity to regain that private root

### Requirement: Avatar catalog SHALL be global
The system SHALL expose a global Avatar catalog rooted in the user's global avatar directory, and each avatar's canonical private runtime home SHALL be the principal-address directory under that global root. Nicknames SHALL remain discoverability aliases only.

#### Scenario: Principal-address root is canonical and nickname is alias
- **WHEN** avatar `frontend` resolves to principal `0xabc...`
- **THEN** its canonical private root is `~/.agenter/avatars/by-principal/0xabc...`
- **AND** any nickname-based path points to that canonical root through aliasing instead of becoming a second source of truth
