## MODIFIED Requirements

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
