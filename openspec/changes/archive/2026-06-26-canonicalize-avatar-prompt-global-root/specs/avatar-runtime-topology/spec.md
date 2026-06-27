# avatar-runtime-topology Specification

## MODIFIED Requirements

### Requirement: Avatar catalog SHALL be global
The system SHALL expose a global Avatar catalog rooted in the user's global avatar directory, and each avatar's canonical private runtime home SHALL be the principal-address directory under that global root. Nicknames SHALL remain discoverability aliases only. Avatar-authored prompt truth SHALL be loaded from that global principal-address root, not from a regular workspace-local avatar copy.

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
