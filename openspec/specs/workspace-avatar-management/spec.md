# workspace-avatar-management Specification

## Purpose
Define the durable global avatar catalog, default-avatar contract, and avatar-local collaboration credential rules.

## Requirements

### Requirement: Default avatar remains discoverable through nickname while storage stays principal-keyed
The system SHALL define `default` as the default avatar nickname in the global avatar catalog, but durable avatar storage SHALL remain principal-keyed. Global avatar discovery SHALL use nickname aliases under `by-nickname`, while the canonical root stays under `by-principal`.

#### Scenario: No explicit avatar falls back to default
- **WHEN** the user opens Avatar selection without any explicit avatar choice stored yet
- **THEN** the UI and runtime model use `default` as the selected avatar nickname
- **AND** the nickname alias resolves under `~/.agenter/avatars/by-nickname/default`
- **AND** when a principal-backed root exists, the resolved canonical directory points to `~/.agenter/avatars/by-principal/<principalId>`

#### Scenario: Default avatar stays visible as a launch seed
- **WHEN** the user opens the global `Avatars` workbench
- **THEN** the `default` avatar is visible even if it has never been customized
- **AND** the user can use it as the blank starting point for a runtime or workspace-mount flow

#### Scenario: Default avatar resolves through a nickname alias
- **WHEN** the avatar catalog resolves the default avatar
- **THEN** the nickname `default` remains visible in the catalog
- **AND** the canonical directory resolves under `~/.agenter/avatars/by-principal/<principalId>`
- **AND** the nickname alias resolves under `~/.agenter/avatars/by-nickname/default`

### Requirement: Global avatar catalog SHALL survive principal-keyed storage migration
The system SHALL keep principal-keyed storage as the canonical global avatar law, while providing a backend-owned migration bridge for legacy nickname-keyed alias paths so runtime launch does not fail on older installations.

#### Scenario: Legacy global nickname directory is normalized before runtime use
- **WHEN** runtime or session creation touches `~/.agenter/avatars/by-nickname/<nickname>` and the path is a legacy directory instead of a symlink alias
- **THEN** the backend tolerates or migrates that legacy shape into canonical `by-principal` plus `by-nickname` alias form before continuing
- **AND** frontend runtime launch does not need a storage-specific workaround

### Requirement: Avatar seat credentials SHALL live under principal-keyed canonical roots
Room and terminal credentials for an Avatar SHALL be persisted in that Avatar's canonical principal directory rather than in workspace root settings layers. Nickname paths act only as aliases that resolve to the canonical principal root.

#### Scenario: Regular workspace stores seat credentials under the workspace avatar-private directory
- **WHEN** a regular workspace Avatar receives or refreshes a room token or terminal token
- **THEN** the system writes that credential into `<workspace>/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** `<workspace>/.agenter/avatars/by-nickname/<nickname>` resolves to that same canonical root
- **AND** another workspace using the same Avatar can keep a different workspace-local seat credential

#### Scenario: Global avatar stores credentials under the global avatar directory
- **WHEN** the global avatar directory receives or refreshes a room token or terminal token for an Avatar
- **THEN** the system writes that credential into `~/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** `~/.agenter/avatars/by-nickname/<nickname>` resolves to that same canonical root
- **AND** the credential remains attached to that Avatar instead of leaking into workspace root settings files

#### Scenario: Workspace seat persistence provisions canonical root and nickname alias
- **WHEN** a workspace avatar seat is first initialized for nickname `helper`
- **THEN** the system creates or uses `<workspace>/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** it provisions `<workspace>/.agenter/avatars/by-nickname/helper` as an alias to that canonical root

#### Scenario: Global seat persistence uses the same principal-keyed law
- **WHEN** the global avatar seat for nickname `default` stores a credential
- **THEN** the system writes it under `~/.agenter/avatars/by-principal/<principalId>/settings.local.json`
- **AND** `~/.agenter/avatars/by-nickname/default` resolves to that same canonical root

#### Scenario: Invalid credential is retained with an invalid marker
- **WHEN** a stored room token or terminal token fails validation
- **THEN** the system keeps that stored credential record in place instead of deleting it automatically
- **AND** the same avatar-local file records that seat as `credential-invalid` until a fresh credential replaces it

### Requirement: Avatar catalog SHALL be global and workspace-independent
The system SHALL expose one global Avatar catalog and SHALL not require regular workspaces to own copied Avatar definitions before those Avatars can mount or operate in the workspace.

#### Scenario: Workspace consumes a global Avatar without local definition
- **WHEN** a regular workspace grants access to a global Avatar that has no workspace-local avatar directory yet
- **THEN** the Avatar can still mount that workspace and operate there
- **AND** workspace-specific data is stored in workspace public or avatar-private roots rather than in a workspace-local avatar definition copy

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

### Requirement: Global avatar management SHALL keep one fixed catalog surface and addable draft flows
The global `Avatars` destination SHALL keep one fixed `Catalog` surface for inspecting global avatar identities. Runtime sessions and creation flows SHALL open as addable tabs layered on top of that catalog rather than replacing it.

#### Scenario: Catalog remains the stable Avatars landing surface
- **WHEN** the user opens the global `Avatars` destination
- **THEN** the UI lands on the fixed `Catalog` surface
- **AND** that catalog remains reachable while runtime or creation tabs are open

#### Scenario: Multiple new-avatar drafts can coexist
- **WHEN** the user starts more than one avatar creation flow
- **THEN** each flow opens as its own closable draft tab
- **AND** closing one draft does not delete or collapse the others
