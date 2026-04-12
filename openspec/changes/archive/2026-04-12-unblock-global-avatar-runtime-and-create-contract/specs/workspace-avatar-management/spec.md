## MODIFIED Requirements

### Requirement: Global avatar catalog SHALL survive principal-keyed storage migration

The system SHALL keep principal-keyed storage as the canonical global avatar law, while providing a backend-owned migration bridge for legacy nickname-keyed alias paths so runtime launch does not fail on older installations.

#### Scenario: Legacy global nickname directory is normalized before runtime use

- **WHEN** runtime or session creation touches `~/.agenter/avatars/by-nickname/<nickname>` and the path is a legacy directory instead of a symlink alias
- **THEN** the backend tolerates or migrates that legacy shape into canonical `by-principal` plus `by-nickname` alias form before continuing
- **AND** frontend runtime launch does not need a storage-specific workaround

### Requirement: Global avatar catalog SHALL project AuthSystem-backed avatar identity

The system SHALL treat global avatar creation as AuthSystem-managed avatar principal creation. App-server and public-client catalog projections MAY expose nickname-scoped asset state, but the durable identity returned to callers SHALL be the avatar principal rather than the nickname path.

#### Scenario: Creating a global avatar returns a principal-backed catalog entry

- **WHEN** a caller creates a global avatar with `nickname` and optional public metadata such as `displayName` or nullable `classify`
- **THEN** the backend provisions a managed principal with `kind: "avatar"`
- **AND** it returns a catalog entry containing a stable avatar identity, the nickname alias, public metadata, and opaque icon projection

#### Scenario: Workspace copy or fork does not mint a new global avatar identity

- **WHEN** a caller forks or copies avatar assets into workspace scope
- **THEN** the operation materializes workspace asset state only
- **AND** it does not masquerade as creating a new global avatar identity
